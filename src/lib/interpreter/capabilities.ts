/**
 * Matriz de capacidades por motor.
 *
 * Esta tabla es la unica fuente de verdad: la interfaz la usa para activar o
 * deshabilitar funciones, y las pruebas verifican que la tabla y el
 * comportamiento real no se contradigan.
 */

export type EngineId = 'devlab' | 'pyodide'

export interface EngineCapability {
  id: EngineId
  /** Nombre visible del motor. */
  name: string
  /** Descripción corta del modo de ejecución. */
  summary: string
  /** Ejecuta Python real completo (no un subconjunto). */
  fullPython: boolean
  /** Permite inspeccionar variables paso a paso. */
  stepInspection: boolean
  /** Permite retroceder en el historial. */
  reversible: boolean
  /** Permite ver la pila de llamadas. */
  callStack: boolean
  /** Permite cancelar una ejecución en curso. */
  cancellable: boolean
  /** Expone metricas de pasos instrumentados. */
  stepMetrics: boolean
  /** Expone tiempos de ejecución fiables. */
  timingMetrics: boolean
  /** Motor que ejecuta su propio código en el navegador. */
  runsInBrowser: boolean
}

export const ENGINES: Record<EngineId, EngineCapability> = {
  devlab: {
    id: 'devlab',
    name: 'DevLab Engine',
    summary:
      'Interprete propio de un subconjunto de Python con inspeccion paso a paso y historial reversible.',
    fullPython: false,
    stepInspection: true,
    reversible: true,
    callStack: true,
    cancellable: false,
    stepMetrics: true,
    timingMetrics: false,
    runsInBrowser: true,
  },
  pyodide: {
    id: 'pyodide',
    name: 'Pyodide (Python real)',
    summary:
      'CPython compilado a WebAssembly que se ejecuta en el navegador. Python completo, sin historial paso a paso.',
    fullPython: true,
    stepInspection: false,
    reversible: false,
    callStack: false,
    cancellable: true,
    stepMetrics: false,
    timingMetrics: true,
    runsInBrowser: true,
  },
}

/** Funciones de la interfaz que dependen de una capacidad concreta. */
export type LabFeature =
  | 'run'
  | 'pause'
  | 'restart'
  | 'stepForward'
  | 'stepBackward'
  | 'jumpToStart'
  | 'jumpToEnd'
  | 'inspectVariables'
  | 'inspectCallStack'
  | 'inspectOutput'
  | 'cancel'
  | 'stepMetrics'
  | 'timingMetrics'

const FEATURE_REQUIRES: Record<LabFeature, keyof EngineCapability> = {
  run: 'runsInBrowser',
  pause: 'stepInspection',
  restart: 'runsInBrowser',
  stepForward: 'stepInspection',
  stepBackward: 'reversible',
  jumpToStart: 'stepInspection',
  jumpToEnd: 'stepInspection',
  inspectVariables: 'stepInspection',
  inspectCallStack: 'callStack',
  inspectOutput: 'runsInBrowser',
  cancel: 'cancellable',
  stepMetrics: 'stepMetrics',
  timingMetrics: 'timingMetrics',
}

/** Indica si el motor admite una función concreta de la interfaz. */
export function engineSupports(engine: EngineId, feature: LabFeature): boolean {
  const capability = ENGINES[engine]
  if (!capability) return false
  return Boolean(capability[FEATURE_REQUIRES[feature]])
}

/** Explicación en texto de por qué una función no está disponible. */
export function featureUnavailableReason(engine: EngineId, feature: LabFeature): string {
  const capability = ENGINES[engine]
  const required = FEATURE_REQUIRES[feature]
  const labels: Record<string, string> = {
    stepInspection: 'la inspección paso a paso',
    reversible: 'la navegación hacia atrás',
    callStack: 'la pila de llamadas',
    cancellable: 'la cancelación',
    stepMetrics: 'las metricas de pasos',
    timingMetrics: 'las metricas de tiempo',
    runsInBrowser: 'la ejecución en el navegador',
  }
  const label = labels[required] ?? required
  return `${capability?.name ?? engine} no ofrece ${label}.`
}
