import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Guardas de calidad del codigo.
 *
 * Estas comprobaciones atrapan errores que las pruebas de comportamiento no
 * detectan, como un identificador acentuado por un cambio automatico de
 * texto (un `sys.version` convertido en `sys.versión` rompe el runtime sin
 * que ninguna prueba de la interfaz lo note).
 */

const ROOT = process.cwd()
const ACCENTED = /[áéíóúñÁÉÍÓÚÑ]/g

function collectFiles(dir: string, extension: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.next'].includes(entry)) continue
      files.push(...collectFiles(full, extension))
      continue
    }
    if (full.endsWith(extension)) files.push(full)
  }
  return files
}

/** Elimina comentarios y literales para dejar solo el codigo ejecutable. */
function stripCommentsAndLiterals(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

function offenders(files: string[], strip: (content: string) => string): string[] {
  const found: string[] = []
  for (const file of files) {
    const content = strip(readFileSync(file, 'utf8'))
    content.split('\n').forEach((line, index) => {
      const match = line.match(ACCENTED)
      if (match) {
        found.push(
          `${path.relative(ROOT, file)}:${index + 1}  ${match.join(' ')}  ${line.trim().slice(0, 80)}`,
        )
      }
    })
  }
  return found
}

describe('calidad del código', () => {
  it('no usa identificadores con tildes en el código de TypeScript', () => {
    const files = [
      ...collectFiles(path.join(ROOT, 'src'), '.ts'),
      ...collectFiles(path.join(ROOT, 'src'), '.tsx'),
    ].filter((file) => !file.includes('.test.'))
    expect(files.length).toBeGreaterThan(40)
    expect(offenders(files, stripCommentsAndLiterals)).toEqual([])
  })

  it('no usa identificadores con tildes en las migraciones SQL', () => {
    const files = collectFiles(path.join(ROOT, 'supabase'), '.sql')
    const strip = (content: string): string =>
      content.replace(/--.*$/gm, ' ').replace(/'(?:[^']|'')*'/g, "''")
    expect(offenders(files, strip)).toEqual([])
  })

  it('no usa tildes en los mensajes de error que imitan a CPython', () => {
    // Los mensajes que reproducen Python deben ser los de Python: asi el
    // alumno ve exactamente el mismo error en el laboratorio y en CPython.
    const runtime = readFileSync(path.join(ROOT, 'src/lib/interpreter/runtime.ts'), 'utf8')
    const pythonStyle = runtime.match(/'(?:list|string) [a-z ]+must be [a-z ]+'/g) ?? []
    expect(pythonStyle.length).toBeGreaterThan(0)
    for (const message of pythonStyle) {
      expect(message).not.toMatch(ACCENTED)
    }
  })
})
