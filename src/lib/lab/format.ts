import type { SnapshotValue } from '@/lib/interpreter/types'

/** Nombre del tipo de un valor de la instantanea. */
export function snapshotTypeName(value: SnapshotValue): string {
  switch (value.type) {
    case 'null':
      return 'None'
    case 'boolean':
      return 'bool'
    case 'number':
      return value.isInt ? 'int' : 'float'
    case 'string':
      return 'str'
    case 'list':
      return 'list'
    case 'function':
      return 'function'
    case 'builtin':
      return 'builtin'
    case 'method':
      return 'method'
    default:
      return 'object'
  }
}

/** Representación legible de un valor de la instantanea. */
export function formatSnapshotValue(value: SnapshotValue): string {
  switch (value.type) {
    case 'null':
      return 'None'
    case 'boolean':
      return value.value ? 'True' : 'False'
    case 'number':
      return value.isInt ? String(value.value) : formatNumber(value.value)
    case 'string':
      return `'${value.value}'`
    case 'list':
      return `[${value.items.map((item) => formatSnapshotValue(item)).join(', ')}]`
    case 'function':
      return `<function ${value.name}>`
    case 'builtin':
      return `<built-in ${value.name}>`
    case 'method':
      return `<method ${value.name}>`
    default:
      return '?'
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf'
  if (Number.isInteger(value)) return `${value}.0`
  return String(value)
}

/** Valor monoespaciado y recortado para la tabla de variables. */
export function compactValue(value: SnapshotValue, maxLength = 80): string {
  const text = formatSnapshotValue(value)
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

export interface VariableDiff {
  name: string
  before: string | null
  after: string | null
  kind: 'added' | 'removed' | 'changed'
}

/**
 * Calcula los cambios de variables entre dos pasos consecutivos.
 *
 * Se usa en el panel de historial para resaltar que ha cambiado en el paso
 * actual, en lugar de mostrar el estado completo otra vez.
 */
export function diffVariables(
  before: { name: string; value: SnapshotValue }[],
  after: { name: string; value: SnapshotValue }[],
): VariableDiff[] {
  const beforeMap = new Map(before.map((entry) => [entry.name, entry]))
  const afterMap = new Map(after.map((entry) => [entry.name, entry]))
  const diffs: VariableDiff[] = []

  for (const [name, entry] of afterMap) {
    const previous = beforeMap.get(name)
    if (!previous) {
      diffs.push({ name, before: null, after: formatSnapshotValue(entry.value), kind: 'added' })
      continue
    }
    const previousText = formatSnapshotValue(previous.value)
    const nextText = formatSnapshotValue(entry.value)
    if (previousText !== nextText) {
      diffs.push({ name, before: previousText, after: nextText, kind: 'changed' })
    }
  }

  for (const [name, entry] of beforeMap) {
    if (!afterMap.has(name)) {
      diffs.push({ name, before: formatSnapshotValue(entry.value), after: null, kind: 'removed' })
    }
  }

  return diffs.sort((a, b) => a.name.localeCompare(b.name))
}
