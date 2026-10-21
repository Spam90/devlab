/**
 * Copia el runtime de Pyodide desde node_modules hacia public/pyodide
 * para que la aplicación lo sirva como asset estático propio
 * (sin depender de un CDN externo en tiempo de ejecución).
 *
 * - Es idempotente: se puede ejecutar varias veces.
 * - Si el paquete no esta instalado, termina con un aviso, no con error,
 *   porque `npm install --ignore-scripts` es un escenario valido.
 */
import { createRequire } from 'node:module'
import { cp, mkdir, rm, stat, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)
const projectRoot = process.cwd()
const targetDir = path.join(projectRoot, 'public', 'pyodide')

/** Ficheros y carpetas que forman el runtime distribuible de Pyodide. */
const WANTED = [
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'pyodide.mjs',
  'pyodide-lock.json',
  'python_stdlib.zip',
]

async function findSourceDir() {
  try {
    const pkgPath = require.resolve('pyodide/package.json')
    return path.dirname(pkgPath)
  } catch {
    return null
  }
}

async function main() {
  const sourceDir = await findSourceDir()
  if (!sourceDir) {
    console.warn('[copy-pyodide] paquete "pyodide" no encontrado; se omite la copia.')
    return
  }

  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })

  const entries = await readdir(sourceDir)
  const wanted = new Set(WANTED)
  let copied = 0

  for (const entry of entries) {
    if (!wanted.has(entry)) continue
    const from = path.join(sourceDir, entry)
    const info = await stat(from)
    if (!info.isFile()) continue
    await cp(from, path.join(targetDir, entry))
    copied += 1
  }

  // Los paquetes pypi cacheados (.whl) son opcionales; se omiten para no
  // inflar el repositorio. Pyodide puede descargarlos en caliente si se piden.
  console.log(`[copy-pyodide] ${copied} ficheros copiados en public/pyodide`)
}

main().catch((error) => {
  console.error('[copy-pyodide] error:', error)
  process.exitCode = 0
})
