/**
 * Worker de Pyodide.
 *
 * Se ejecuta en un Web Worker (module) para que la interfaz no se bloquee
 * durante la ejecución. La cancelación se realiza terminateando el worker:
 * Pyodide no ofrece un cancelación cooperativa fiable dentro de WASM.
 */

let pyodide = null
let loadPromise = null

const post = (message) => self.postMessage(message)

async function ensureRuntime(indexURL) {
  if (pyodide) return pyodide
  if (!loadPromise) {
    // La ruta es absoluta: el worker vive en /devlab y el runtime en /pyodide.
    loadPromise = import('/pyodide/pyodide.mjs').then((module) =>
      module.loadPyodide({ indexURL }),
    )
  }
  pyodide = await loadPromise
  return pyodide
}

/** Recoge las variables globales del usuario (sin las privadas). */
const COLLECT_GLOBALS = `
def _devlab_collect_globals():
    result = {}
    for name, value in list(globals().items()):
        if name.startswith('_'):
            continue
        try:
            rendered = repr(value)
        except Exception:
            rendered = '<no representable>'
        if len(rendered) > 240:
            rendered = rendered[:240] + '...'
        result[name] = type(value).__name__ + ' | ' + rendered
    return result
`

async function collectGlobals(runtime) {
  try {
    await runtime.runPythonAsync(COLLECT_GLOBALS)
    const collected = runtime.globals.get('_devlab_collect_globals')
    const result = collected()
    const plain = result.toJs ? result.toJs({ dict_converter: Object.fromEntries }) : {}
    result.destroy?.()
    return plain && typeof plain === 'object' ? plain : {}
  } catch {
    return {}
  }
}

self.onmessage = async (event) => {
  const message = event.data ?? {}
  const { type, id } = message

  if (type === 'init') {
    try {
      const runtime = await ensureRuntime(message.indexURL ?? '/pyodide/')
      post({
        type: 'ready',
        id,
        versión: runtime.versión ?? 'desconocida',
        pythonVersion: runtime.runPython('import sys; sys.versión.split()[0]'),
      })
    } catch (error) {
      post({
        type: 'init-error',
        id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

  if (type === 'run') {
    const stdout = []
    const stderr = []
    try {
      const runtime = await ensureRuntime(message.indexURL ?? '/pyodide/')
      // Cada ejecución arranca con un espacio de nombres limpio para que dos
      // ejecuciones consecutivas no compartan estado.
      await runtime.runPython(`
for _devlab_name in list(globals().keys()):
    if not _devlab_name.startswith('__'):
        globals().pop(_devlab_name, None)
`)
      runtime.setStdout({ batched: (text) => stdout.push(text) })
      runtime.setStderr({ batched: (text) => stderr.push(text) })
      const startedAt = performance.now()
      let failure = null
      try {
        await runtime.runPythonAsync(message.code ?? '')
      } catch (error) {
        failure = {
          type: error?.constructor?.name ?? 'PythonError',
          message: error?.message ?? String(error),
        }
      }
      const durationMs = performance.now() - startedAt
      const globals = await collectGlobals(runtime)
      post({
        type: 'result',
        id,
        stdout,
        stderr,
        failure,
        durationMs,
        globals,
      })
    } catch (error) {
      post({
        type: 'result',
        id,
        stdout,
        stderr,
        failure: {
          type: 'RuntimeError',
          message: error instanceof Error ? error.message : String(error),
        },
        durationMs: 0,
        globals: {},
      })
    }
  }
}
