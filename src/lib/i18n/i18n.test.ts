import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_LOCALE, LOCALES, missingTranslationKeys, translate } from '@/lib/i18n'
import { dictionaries } from '@/lib/i18n'

/**
 * Recorre el codigo fuente del proyecto buscando las claves de traduccion
 * que se utilizan, tanto de forma literal (`t('lab.run')`) como dinamica
 * (`t(`lab.stepKinds.${kind}`)`).
 */
function scanSource(dir: string, result = { literals: new Set<string>(), dynamic: new Set<string>() }) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.next'].includes(entry)) continue
      scanSource(full, result)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    const content = readFileSync(full, 'utf8')

    const literal = /[^a-zA-Z0-9_]t\(\s*'([a-zA-Z0-9_.]+)'/g
    let match = literal.exec(content)
    while (match) {
      if (match[1]) result.literals.add(match[1])
      match = literal.exec(content)
    }

    // Plantillas con interpolacion: `t(`grupo.${...}`)`
    const dynamic = /[^a-zA-Z0-9_]t\(\s*`([a-zA-Z0-9_]+)\./g
    let dynamicMatch = dynamic.exec(content)
    while (dynamicMatch) {
      if (dynamicMatch[1]) result.dynamic.add(dynamicMatch[1])
      dynamicMatch = dynamic.exec(content)
    }
  }
  return result
}

/** Claves del catalogo en notacion de punto. */
function catalogKeys(dictionary: unknown, prefix = ''): string[] {
  if (typeof dictionary !== 'object' || dictionary === null) return []
  return Object.entries(dictionary).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [full] : catalogKeys(value, full)
  })
}

const source = scanSource(path.join(process.cwd(), 'src'))

describe('catálogos de traducción', () => {
  it('tiene las mismas claves en español e inglés', () => {
    for (const locale of LOCALES) {
      expect(missingTranslationKeys(locale)).toEqual([])
    }
  })

  it('no deja cadenas vacías', () => {
    for (const locale of LOCALES) {
      const walk = (value: unknown, path: string): void => {
        if (typeof value === 'string') {
          expect(value.trim(), `${locale}.${path}`).not.toBe('')
          return
        }
        if (typeof value === 'object' && value !== null) {
          for (const [key, child] of Object.entries(value)) {
            walk(child, path ? `${path}.${key}` : key)
          }
        }
      }
      walk(dictionaries[locale], '')
    }
  })

  it('traduce claves conocidas en ambos idiomas', () => {
    expect(translate('es', 'lab.run')).toBe('Ejecutar')
    expect(translate('en', 'lab.run')).toBe('Run')
    expect(translate('es', 'common.appName')).toBe('DevLab')
    expect(translate('en', 'common.appName')).toBe('DevLab')
  })

  it('interpola variables', () => {
    expect(translate('es', 'lab.stepCounter', { current: 2, total: 10 })).toBe('Paso 2 de 10')
    expect(translate('en', 'lab.stepCounter', { current: 2, total: 10 })).toBe('Step 2 of 10')
  })

  it('devuelve la clave cuando no existe la traducción', () => {
    expect(translate('es', 'no.existe')).toBe('no.existe')
  })

  it('usa el idioma por defecto cuando falta una clave', () => {
    expect(DEFAULT_LOCALE).toBe('es')
  })

  it('todas las claves usadas en el código existen en los catálogos', () => {
    const used = [...source.literals]
    expect(used.length).toBeGreaterThan(50)
    const missing = used.filter(
      (key) => translate('es', key) === key || translate('en', key) === key,
    )
    expect(missing).toEqual([])
  })

  it('no deja claves sin usar en el catálogo', () => {
    const defined = catalogKeys(dictionaries[DEFAULT_LOCALE])
    const unused = defined.filter((key) => {
      if (source.literals.has(key)) return false
      // Las claves construidas de forma dinamica (p. ej. `nav.${item.key}`)
      // se consideran usadas si el prefijo aparece en alguna plantilla.
      const prefix = key.split('.')[0] ?? key
      return !source.dynamic.has(prefix)
    })
    expect(unused).toEqual([])
  })
})
