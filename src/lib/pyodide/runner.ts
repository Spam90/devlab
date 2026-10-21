'use client'

/**
 * Adaptador del runtime Pyodide.
 *
 * Responsabilidades:
 * - Carga diferida del runtime (solo cuando el usuario elige ese motor).
 * - Ejecución en un Web Worker para no bloquear la interfaz.
 * - Captura de stdout/stderr y de las variables globales finales.
 * - Cancelación por terminación del worker.
 */

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error' | 'running'

export interface PyodideResult {
  stdout: string[]
  stderr: string[]
  failure: { type: string; message: string } | null
  durationMs: number
  globals: Record<string, string>
}

export interface PyodideRuntimeState {
  status: PyodideStatus
  error: string | null
  version: string | null
  pythonVersion: string | null
}

const INDEX_URL = process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL ?? '/pyodide/'

type WorkerMessage =
  | { type: 'ready'; id: number; version: string; pythonVersion: string }
  | { type: 'init-error'; id: number; message: string }
  | {
      type: 'result'
      id: number
      stdout: string[]
      stderr: string[]
      failure: { type: string; message: string } | null
      durationMs: number
      globals: Record<string, string>
    }

export class PyodideRunner {
  private worker: Worker | null = null
  private requestId = 0
  private pending = new Map<
    number,
    {
      resolve: (result: PyodideResult) => void
      reject: (error: Error) => void
    }
  >()
  private readyPromise: Promise<PyodideRuntimeState> | null = null
  private state: PyodideRuntimeState = {
    status: 'idle',
    error: null,
    version: null,
    pythonVersion: null,
  }
  private listeners = new Set<(state: PyodideRuntimeState) => void>()

  subscribe(listener: (state: PyodideRuntimeState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state)
  }

  private update(patch: Partial<PyodideRuntimeState>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker('/devlab/pyodide-worker.js', { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      if (message.type === 'ready' || message.type === 'init-error') {
        if (message.type === 'init-error') {
          this.update({ status: 'error', error: message.message })
        }
        return
      }
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      pending.resolve({
        stdout: message.stdout,
        stderr: message.stderr,
        failure: message.failure,
        durationMs: message.durationMs,
        globals: message.globals,
      })
    }
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Error en el worker de Pyodide')
      this.update({ status: 'error', error: error.message })
      for (const [, pending] of this.pending) pending.reject(error)
      this.pending.clear()
    }
    this.worker = worker
    return worker
  }

  /** Carga el runtime. Es idempotente: solo descarga una vez. */
  load(): Promise<PyodideRuntimeState> {
    if (this.readyPromise) return this.readyPromise
    this.update({ status: 'loading', error: null })
    const worker = this.ensureWorker()
    const id = ++this.requestId
    this.readyPromise = new Promise<PyodideRuntimeState>((resolve) => {
      const handle = (event: MessageEvent<WorkerMessage>): void => {
        const message = event.data
        if (message.id !== id) return
        worker.removeEventListener('message', handle)
        if (message.type === 'ready') {
          this.update({
            status: 'ready',
            version: message.version,
            pythonVersion: message.pythonVersion,
            error: null,
          })
          resolve(this.state)
          return
        }
        if (message.type === 'init-error') {
          this.update({ status: 'error', error: message.message })
          resolve(this.state)
        }
      }
      worker.addEventListener('message', handle)
      worker.postMessage({ type: 'init', id, indexURL: INDEX_URL })
    })
    return this.readyPromise
  }

  /** Ejecuta código Python real en el navegador. */
  async run(code: string): Promise<PyodideResult> {
    await this.load()
    const worker = this.ensureWorker()
    const id = ++this.requestId
    this.update({ status: 'running' })
    return new Promise<PyodideResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ type: 'run', id, code, indexURL: INDEX_URL })
    })
  }

  /** Cancela la ejecución actual termineando el worker. */
  cancel(): void {
    if (!this.worker) return
    for (const [, pending] of this.pending) {
      pending.reject(new Error('Ejecucion cancelada por el usuario'))
    }
    this.pending.clear()
    this.worker.terminate()
    this.worker = null
    this.readyPromise = null
    this.update({ status: 'idle' })
  }

  /** Libera el runtime y la memoria asociada. */
  dispose(): void {
    this.cancel()
    this.listeners.clear()
  }
}
