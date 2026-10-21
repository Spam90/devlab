import type {
  PyList,
  RuntimeValue,
  Scope,
  SnapshotValue,
} from './types'

let nextListId = 1

export function createList(items: RuntimeValue[] = []): PyList {
  const list: PyList = { type: 'list', id: nextListId, items }
  nextListId += 1
  return list
}

export function nullValue(): RuntimeValue {
  return { type: 'null' }
}

export function boolValue(value: boolean): RuntimeValue {
  return { type: 'boolean', value }
}

export function intValue(value: number): RuntimeValue {
  return { type: 'number', value, isInt: true }
}

export function floatValue(value: number): RuntimeValue {
  return { type: 'number', value, isInt: false }
}

export function stringValue(value: string): RuntimeValue {
  return { type: 'string', value }
}

/** Nombre del tipo tal y como lo muestra Python. */
export function typeName(value: RuntimeValue): string {
  switch (value.type) {
    case 'null':
      return 'NoneType'
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
      return 'builtin_function_or_method'
    case 'method':
      return 'builtin_function_or_method'
    default:
      return 'object'
  }
}

/** Representación textual estilo `repr()` de Python. */
export function repr(value: RuntimeValue): string {
  switch (value.type) {
    case 'null':
      return 'None'
    case 'boolean':
      return value.value ? 'True' : 'False'
    case 'number': {
      if (value.isInt) return String(Math.trunc(value.value))
      return formatFloat(value.value)
    }
    case 'string':
      return `'${value.value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
    case 'list':
      return `[${value.items.map((item) => repr(item)).join(', ')}]`
    case 'function':
      return `<function ${value.name}>`
    case 'builtin':
      return `<built-in function ${value.name}>`
    case 'method':
      return `<built-in method ${value.name}>`
    default:
      return '<objeto>'
  }
}

/** Representación legible (`str()`), sin comillas para las cadenas. */
export function toDisplayString(value: RuntimeValue): string {
  if (value.type === 'string') return value.value
  return repr(value)
}

export function formatFloat(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf'
  if (Number.isInteger(value)) return `${value}.0`
  return String(value)
}

export function isTruthy(value: RuntimeValue): boolean {
  switch (value.type) {
    case 'null':
      return false
    case 'boolean':
      return value.value
    case 'number':
      return value.value !== 0
    case 'string':
      return value.value.length > 0
    case 'list':
      return value.items.length > 0
    default:
      return true
  }
}

export function valuesEqual(a: RuntimeValue, b: RuntimeValue): boolean {
  if (a.type === 'null' && b.type === 'null') return true
  if (a.type === 'boolean' && b.type === 'boolean') return a.value === b.value
  if (a.type === 'number' && b.type === 'number') return a.value === b.value
  if (a.type === 'string' && b.type === 'string') return a.value === b.value
  if (a.type === 'list' && b.type === 'list') {
    if (a.id === b.id) return true
    if (a.items.length !== b.items.length) return false
    return a.items.every((item, index) => {
      const other = b.items[index]
      return other !== undefined && valuesEqual(item, other)
    })
  }
  // `True == 1` en Python; aquí mantenemos la distinción para no confundir
  // al alumno, y lo documentamos en docs/CAPABILITIES.md.
  return false
}

export function compareValues(a: RuntimeValue, b: RuntimeValue): number {
  if (a.type === 'number' && b.type === 'number') {
    if (a.value < b.value) return -1
    if (a.value > b.value) return 1
    return 0
  }
  if (a.type === 'string' && b.type === 'string') {
    if (a.value < b.value) return -1
    if (a.value > b.value) return 1
    return 0
  }
  if (a.type === 'list' && b.type === 'list') {
    const length = Math.min(a.items.length, b.items.length)
    for (let index = 0; index < length; index += 1) {
      const left = a.items[index]
      const right = b.items[index]
      if (left === undefined || right === undefined) break
      const result = compareValues(left, right)
      if (result !== 0) return result
    }
    return a.items.length - b.items.length
  }
  throw new TypeError(
    `no se pueden comparar los tipos '${typeName(a)}' y '${typeName(b)}'`,
  )
}

export function contains(container: RuntimeValue, item: RuntimeValue): boolean {
  if (container.type === 'list') {
    return container.items.some((element) => valuesEqual(element, item))
  }
  if (container.type === 'string') {
    if (item.type !== 'string') {
      throw new TypeError(
        `'in <str>' requiere un operando de tipo str, no ${typeName(item)}`,
      )
    }
    return container.value.includes(item.value)
  }
  throw new TypeError(
    `el argumento de 'in' debe ser iterable, no ${typeName(container)}`,
  )
}

/**
 * Convierte un valor de ejecución en una instantanea inmutable.
 *
 * Las listas se copian de forma profunda: esto garantiza que una mutación
 * posterior no altere retroactivamente un estado ya registrado. Los valores
 * inmutables (números, cadenas, funciones) se comparten por referencia.
 */
export function toSnapshot(value: RuntimeValue): SnapshotValue {
  switch (value.type) {
    case 'null':
      return { type: 'null' }
    case 'boolean':
      return { type: 'boolean', value: value.value }
    case 'number':
      return { type: 'number', value: value.value, isInt: value.isInt }
    case 'string':
      return { type: 'string', value: value.value }
    case 'list':
      return {
        type: 'list',
        id: value.id,
        items: value.items.map((item) => toSnapshot(item)),
      }
    case 'function':
      return { type: 'function', name: value.name }
    case 'builtin':
      return { type: 'builtin', name: value.name }
    case 'method':
      return { type: 'method', name: value.name, receiverType: typeName(value.receiver) }
    default:
      return { type: 'null' }
  }
}

/** Resuelve un nombre en la cadena de ambitos. */
export function lookup(scope: Scope, name: string): RuntimeValue | undefined {
  let current: Scope | null = scope
  while (current) {
    const found = current.vars.get(name)
    if (found !== undefined) return found
    current = current.parent
  }
  return undefined
}

/**
 * Determina el ámbito donde debe crearse un binding.
 *
 * Reglas implementadas (documentadas en docs/CAPABILITIES.md):
 * - En el ámbito global, el binding se crea en el global.
 * - Dentro de una función, el binding SIEMPRE se crea en el ámbito local de
 *   la función, igual que en Python. CPython lanza `UnboundLocalError` si se
 *   lee una variable local antes de asignarla; aquí la lectura resuelve al
 *   ámbito exterior, que es una simplificación documentada.
 */
export function resolveAssignmentScope(scope: Scope, _name: string): Scope {
  return scope
}
