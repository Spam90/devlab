import { en } from './dictionaries/en'
import { es } from './dictionaries/es'

export type Locale = 'es' | 'en'
export type { Dictionary } from './dictionaries/es'

export const LOCALES: Locale[] = ['es', 'en']

export const DEFAULT_LOCALE: Locale = 'es'

export const dictionaries = { es, en } satisfies Record<Locale, typeof es>

export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
}

type Leaves<T> = {
  [K in keyof T]: T[K] extends string ? K : Leaves<T[K]>
}[keyof T]

export type TranslationKey = Leaves<typeof es>

/** Resuelve una clave con notación de punto: `lab.run`. */
function resolve(dictionary: unknown, path: string[]): string | undefined {
  let current: unknown = dictionary
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === 'string' ? current : undefined
}

/**
 * Traduce una clave. Si falta, devuelve la propia clave para que el
 * problema sea visible en lugar de mostrar texto vacío.
 */
export function translate(
  locale: Locale,
  key: string,
  variables?: Record<string, string | number>,
): string {
  const template = resolve(dictionaries[locale], key.split('.'))
  if (template === undefined) {
    const fallback = resolve(dictionaries[DEFAULT_LOCALE], key.split('.'))
    if (fallback === undefined) return key
    return interpolate(fallback, variables)
  }
  return interpolate(template, variables)
}

function interpolate(
  template: string,
  variables?: Record<string, string | number>,
): string {
  if (!variables) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = variables[name]
    return value === undefined ? match : String(value)
  })
}

/** Comprueba que ambos catalogos tienen exactamente las mismas claves. */
export function missingTranslationKeys(locale: Locale): string[] {
  const reference = flattenKeys(dictionaries[DEFAULT_LOCALE])
  const target = flattenKeys(dictionaries[locale])
  const missing = reference.filter((key) => !target.includes(key))
  const extra = target.filter((key) => !reference.includes(key))
  return [...missing.map((key) => `${locale}:${key}`), ...extra.map((key) => `${locale}:${key}`)]
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return prefix ? [prefix] : []
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  )
}
