'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import { runProgram, type InterpreterLimits } from '@/lib/interpreter'
import type { EngineId } from '@/lib/interpreter/capabilities'
import type { StepSnapshot } from '@/lib/interpreter/types'
import { PyodideRunner, type PyodideRuntimeState } from '@/lib/pyodide/runner'

export type LabStatus = 'idle' | 'running' | 'completed' | 'error' | 'limit'

/** Proyecto abierto en el laboratorio (opcional). */
export interface LabProject {
  id: string
  name: string
  /** Identificador en Supabase si el proyecto está sincronizado. */
  remoteId?: string
  /** Último código guardado: sirve para detectar cambios sin guardar. */
  savedSource: string
}

export interface LabError {
  type: string
  message: string
  line: number
  column: number
}

export interface LabResult {
  engine: EngineId
  status: 'completed' | 'error' | 'limit'
  steps: StepSnapshot[]
  output: string[]
  error?: LabError
  instructions?: number
  durationMs?: number
  /** Variables globales finales (solo en modo Pyodide). */
  globals?: Record<string, string>
}

interface LabState {
  source: string
  engine: EngineId
  status: LabStatus
  result: LabResult | null
  stepIndex: number
  /** El código cambio despues de la ultima ejecución. */
  historyStale: boolean
  limits: InterpreterLimits
  runtime: PyodideRuntimeState
  /** Proyecto abierto en el laboratorio. */
  project: LabProject | null
  /** Estado de la ultima operación de guardado. */
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  saveError: string | null
}

type Action =
  | { type: 'set-source'; source: string }
  | { type: 'set-engine'; engine: EngineId }
  | { type: 'run-start' }
  | { type: 'run-result'; result: LabResult }
  | { type: 'reset' }
  | { type: 'set-step'; index: number }
  | { type: 'set-limits'; limits: InterpreterLimits }
  | { type: 'runtime'; state: PyodideRuntimeState }
  | { type: 'open-project'; project: LabProject }
  | { type: 'close-project' }
  | { type: 'save-start' }
  | { type: 'save-done'; source: string }
  | { type: 'save-error'; message: string }

const INITIAL_RUNTIME: PyodideRuntimeState = {
  status: 'idle',
  error: null,
  version: null,
  pythonVersion: null,
}

/** Programa inicial: el laboratorio nunca se abre en blanco. */
export const WELCOME_SOURCE = `# Bienvenido a DevLab
# Pulsa "Ejecutar" y mira la consola; despues avanza paso a paso.

saludo = "Hola, DevLab"
numeros = [4, 8, 15, 16, 23, 42]

print(saludo)
for numero in numeros:
    print("numero", numero)
`

const initialState: LabState = {
  source: WELCOME_SOURCE,
  engine: 'devlab',
  status: 'idle',
  result: null,
  stepIndex: 0,
  historyStale: false,
  limits: {
    maxSteps: 20_000,
    maxInstructions: 2_000_000,
    maxCallDepth: 64,
    maxListLength: 5_000,
    maxOutputBytes: 200_000,
    timeoutMs: 5_000,
    maxSourceLength: 100_000,
  },
  runtime: INITIAL_RUNTIME,
  project: null,
  saveState: 'idle',
  saveError: null,
}

function reducer(state: LabState, action: Action): LabState {
  switch (action.type) {
    case 'set-source':
      if (action.source === state.source) return state
      return {
        ...state,
        source: action.source,
        historyStale: state.result !== null,
      }
    case 'set-engine':
      if (action.engine === state.engine) return state
      return {
        ...state,
        engine: action.engine,
        status: 'idle',
        result: null,
        stepIndex: 0,
        historyStale: false,
      }
    case 'run-start':
      return { ...state, status: 'running' }
    case 'run-result':
      return {
        ...state,
        status: action.result.status,
        result: action.result,
        stepIndex:
          action.result.engine === 'devlab'
            ? Math.max(0, action.result.steps.length - 1)
            : 0,
        historyStale: false,
      }
    case 'reset':
      return {
        ...state,
        status: 'idle',
        result: null,
        stepIndex: 0,
        historyStale: false,
      }
    case 'set-step':
      return { ...state, stepIndex: Math.max(0, action.index) }
    case 'set-limits':
      return { ...state, limits: action.limits }
    case 'runtime':
      return { ...state, runtime: action.state }
    case 'open-project':
      return {
        ...state,
        project: action.project,
        saveState: 'idle',
        saveError: null,
      }
    case 'close-project':
      return { ...state, project: null, saveState: 'idle', saveError: null }
    case 'save-start':
      return { ...state, saveState: 'saving', saveError: null }
    case 'save-done':
      return {
        ...state,
        saveState: 'saved',
        saveError: null,
        project: state.project ? { ...state.project, savedSource: action.source } : null,
      }
    case 'save-error':
      return { ...state, saveState: 'error', saveError: action.message }
    default:
      return state
  }
}

interface LabContextValue extends LabState {
  setSource: (source: string) => void
  setEngine: (engine: EngineId) => void
  setLimits: (limits: Partial<InterpreterLimits>) => void
  run: () => Promise<void>
  /** Ejecuta un fragmento de código sin tocar el estado del laboratorio. */
  runSnippet: (source: string) => Promise<LabResult>
  /** Abre un proyecto en el laboratorio. */
  openProject: (project: LabProject) => void
  /** Cierra el proyecto abierto (el código sigue en el editor). */
  closeProject: () => void
  /** Guarda el código actual en el proyecto abierto. */
  save: () => Promise<boolean>
  /** Crea un proyecto nuevo con el código actual y lo abre. */
  saveAs: (name: string) => Promise<boolean>
  /** `true` si hay cambios sin guardar. */
  dirty: boolean
  reset: () => void
  cancel: () => void
  stepForward: () => void
  stepBackward: () => void
  jumpToStart: () => void
  jumpToEnd: () => void
  setStep: (index: number) => void
  currentStep: StepSnapshot | null
  totalSteps: number
}

const LabContext = createContext<LabContextValue | null>(null)

export function LabProvider({
  children,
  initialSource = WELCOME_SOURCE,
  initialEngine = 'devlab',
}: {
  children: ReactNode
  initialSource?: string
  initialEngine?: EngineId
}) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    source: initialSource,
    engine: initialEngine,
  })
  const runnerRef = useRef<PyodideRunner | null>(null)
  const stateRef = useRef(state)

  // La referencia se actualiza despues del render: leerla durante el render
  // romperia las reglas de React y puede devolver un valor obsoleto.
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const getRunner = useCallback((): PyodideRunner => {
    if (!runnerRef.current) runnerRef.current = new PyodideRunner()
    return runnerRef.current
  }, [])

  useEffect(() => {
    const runner = getRunner()
    const unsubscribe = runner.subscribe((runtimeState) => {
      dispatch({ type: 'runtime', state: runtimeState })
    })
    return () => {
      unsubscribe()
    }
  }, [getRunner])

  useEffect(() => {
    return () => {
      runnerRef.current?.dispose()
      runnerRef.current = null
    }
  }, [])

  const setSource = useCallback((source: string) => {
    dispatch({ type: 'set-source', source })
  }, [])

  const setEngine = useCallback(
    (engine: EngineId) => {
      dispatch({ type: 'set-engine', engine })
      // Al elegir Pyodide se descarga el runtime en segundo plano: así el
      // botón de ejecución ya lo tiene listo cuando el usuario lo pulsa.
      if (engine === 'pyodide') {
        void getRunner()
          .load()
          .catch(() => undefined)
      }
    },
    [getRunner],
  )

  const setLimits = useCallback((limits: Partial<InterpreterLimits>) => {
    dispatch({
      type: 'set-limits',
      limits: { ...stateRef.current.limits, ...limits },
    })
  }, [])

  const run = useCallback(async () => {
    const current = stateRef.current
    dispatch({ type: 'run-start' })

    if (current.engine === 'devlab') {
      const startedAt = performance.now()
      const result = runProgram(current.source, { limits: current.limits })
      const durationMs = performance.now() - startedAt
      dispatch({
        type: 'run-result',
        result: {
          engine: 'devlab',
          status: result.status,
          steps: result.steps,
          output: result.output,
          error: result.error,
          instructions: result.instructions,
          durationMs,
        },
      })
      return
    }

    try {
      const runner = getRunner()
      const outcome = await runner.run(current.source)
      dispatch({
        type: 'run-result',
        result: {
          engine: 'pyodide',
          status: outcome.failure ? 'error' : 'completed',
          steps: [],
          output: [...outcome.stdout, ...outcome.stderr],
          error: outcome.failure
            ? {
                type: outcome.failure.type,
                message: outcome.failure.message,
                line: 0,
                column: 0,
              }
            : undefined,
          durationMs: outcome.durationMs,
          globals: outcome.globals,
        },
      })
    } catch (error) {
      dispatch({
        type: 'run-result',
        result: {
          engine: 'pyodide',
          status: 'error',
          steps: [],
          output: [],
          error: {
            type: 'RuntimeError',
            message: error instanceof Error ? error.message : String(error),
            line: 0,
            column: 0,
          },
        },
      })
    }
  }, [getRunner])

  const runSnippet = useCallback(
    async (source: string): Promise<LabResult> => {
      const current = stateRef.current

      if (current.engine === 'devlab') {
        const startedAt = performance.now()
        const result = runProgram(source, { limits: current.limits })
        const durationMs = performance.now() - startedAt
        return {
          engine: 'devlab',
          status: result.status,
          steps: result.steps,
          output: result.output,
          error: result.error,
          instructions: result.instructions,
          durationMs,
        }
      }

      try {
        const runner = getRunner()
        const outcome = await runner.run(source)
        return {
          engine: 'pyodide',
          status: outcome.failure ? 'error' : 'completed',
          steps: [],
          output: [...outcome.stdout, ...outcome.stderr],
          error: outcome.failure
            ? {
                type: outcome.failure.type,
                message: outcome.failure.message,
                line: 0,
                column: 0,
              }
            : undefined,
          durationMs: outcome.durationMs,
          globals: outcome.globals,
        }
      } catch (error) {
        return {
          engine: 'pyodide',
          status: 'error',
          steps: [],
          output: [],
          error: {
            type: 'RuntimeError',
            message: error instanceof Error ? error.message : String(error),
            line: 0,
            column: 0,
          },
        }
      }
    },
    [getRunner],
  )

  /**
   * Crea un proyecto nuevo con el código actual.
   *
   * - Con sesión: se crea en Supabase (el RLS autoriza al propietario).
   * - Sin sesión: se guarda en `localStorage` (modo invitado).
   */
  const saveAs = useCallback(async (name: string): Promise<boolean> => {
    const current = stateRef.current
    const trimmed = name.trim()
    if (!trimmed) return false

    dispatch({ type: 'save-start' })
    try {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client')
      const supabase = getSupabaseBrowserClient()
      const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } }
      const user = data.user

      if (user) {
        const { createProject } = await import('@/lib/projects/remote')
        const row = await createProject({
          name: trimmed,
          code: current.source,
          engine: current.engine,
        })
        dispatch({
          type: 'open-project',
          project: {
            id: row.id,
            name: row.name,
            remoteId: row.id,
            savedSource: current.source,
          },
        })
      } else {
        const { createLocalProject } = await import('@/lib/projects/local')
        const local = createLocalProject({
          name: trimmed,
          source: current.source,
          engine: current.engine,
        })
        dispatch({
          type: 'open-project',
          project: {
            id: local.id,
            name: local.name,
            savedSource: current.source,
          },
        })
      }
      dispatch({ type: 'save-done', source: current.source })
      return true
    } catch (error) {
      dispatch({
        type: 'save-error',
        message: error instanceof Error ? error.message : 'Error al guardar el proyecto.',
      })
      return false
    }
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  const openProject = useCallback((project: LabProject) => {
    dispatch({ type: 'open-project', project })
  }, [])

  const closeProject = useCallback(() => {
    dispatch({ type: 'close-project' })
  }, [])

  /**
   * Guarda el código actual.
   *
   * - Si el proyecto está en Supabase, se actualiza alli (el RLS se encarga
   *   de autorizar).
   * - Si es local, se guarda en `localStorage`.
   */
  const save = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current
    const project = current.project
    if (!project) return false

    dispatch({ type: 'save-start' })
    try {
      if (project.remoteId) {
        const { updateProject } = await import('@/lib/projects/remote')
        await updateProject(project.remoteId, { code: current.source })
      } else {
        const { updateLocalProject } = await import('@/lib/projects/local')
        updateLocalProject(project.id, { source: current.source })
      }
      dispatch({ type: 'save-done', source: current.source })
      return true
    } catch (error) {
      dispatch({
        type: 'save-error',
        message: error instanceof Error ? error.message : 'Error al guardar el proyecto.',
      })
      return false
    }
  }, [])

  const cancel = useCallback(() => {
    runnerRef.current?.cancel()
    dispatch({ type: 'reset' })
  }, [])

  const totalSteps = state.result?.steps.length ?? 0

  const stepForward = useCallback(() => {
    const current = stateRef.current
    const total = current.result?.steps.length ?? 0
    if (total === 0) return
    dispatch({ type: 'set-step', index: Math.min(total - 1, current.stepIndex + 1) })
  }, [])

  const stepBackward = useCallback(() => {
    const current = stateRef.current
    if (current.stepIndex <= 0) return
    dispatch({ type: 'set-step', index: current.stepIndex - 1 })
  }, [])

  const jumpToStart = useCallback(() => {
    dispatch({ type: 'set-step', index: 0 })
  }, [])

  const jumpToEnd = useCallback(() => {
    const current = stateRef.current
    const total = current.result?.steps.length ?? 0
    dispatch({ type: 'set-step', index: Math.max(0, total - 1) })
  }, [])

  const setStep = useCallback((index: number) => {
    const current = stateRef.current
    const total = current.result?.steps.length ?? 0
    if (total === 0) return
    dispatch({ type: 'set-step', index: Math.min(Math.max(0, index), total - 1) })
  }, [])

  const currentStep =
    state.result && state.result.steps.length > 0
      ? (state.result.steps[Math.min(state.stepIndex, state.result.steps.length - 1)] ?? null)
      : null

  const dirty = state.project !== null && state.project.savedSource !== state.source

  const value = useMemo<LabContextValue>(
    () => ({
      ...state,
      setSource,
      setEngine,
      setLimits,
      run,
      runSnippet,
      openProject,
      closeProject,
      save,
      saveAs,
      dirty,
      reset,
      cancel,
      stepForward,
      stepBackward,
      jumpToStart,
      jumpToEnd,
      setStep,
      currentStep,
      totalSteps,
    }),
    [
      state,
      setSource,
      setEngine,
      setLimits,
      run,
      runSnippet,
      openProject,
      closeProject,
      save,
      saveAs,
      dirty,
      reset,
      cancel,
      stepForward,
      stepBackward,
      jumpToStart,
      jumpToEnd,
      setStep,
      currentStep,
      totalSteps,
    ],
  )

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useLab(): LabContextValue {
  const context = useContext(LabContext)
  if (!context) throw new Error('useLab debe usarse dentro de <LabProvider>')
  return context
}
