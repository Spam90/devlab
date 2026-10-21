import { PyRuntimeError } from './errors'
import {
  boolValue,
  compareValues,
  createList,
  floatValue,
  formatFloat,
  intValue,
  repr,
  stringValue,
  toDisplayString,
  typeName,
  valuesEqual,
} from './values'
import type { BuiltinContext, RuntimeValue } from './types'

/**
 * Builtins del subconjunto soportado.
 *
 * No se implementa todo Python: la lista exacta está en
 * docs/CAPABILITIES.md. Cualquier builtin no listado produce un
 * `NameError` con una sugerencia de alternativas.
 */
export function createBuiltins(ctx: BuiltinContext): Map<string, RuntimeValue> {
  const builtins = new Map<string, RuntimeValue>()

  const define = (
    name: string,
    call: (args: RuntimeValue[]) => RuntimeValue,
  ): void => {
    builtins.set(name, { type: 'builtin', name, call: (args) => call(args) })
  }

  define('print', (args) => {
    const text = args.map((arg) => toDisplayString(arg)).join(' ')
    ctx.print(text)
    return { type: 'null' }
  })

  define('len', (args) => {
    const value = requireArg(args, 0, 'len')
    if (value.type === 'list') return intValue(value.items.length)
    if (value.type === 'string') return intValue(value.value.length)
    throw new PyRuntimeError(
      'TypeError',
      `object of type '${typeName(value)}' has no len()`,
    )
  })

  define('range', (args) => {
    if (args.length === 0 || args.length > 3) {
      throw new PyRuntimeError(
        'TypeError',
        `range expected 1 to 3 arguments, got ${args.length}`,
      )
    }
    const numbers = args.map((arg) => {
      if (arg.type !== 'number') {
        throw new PyRuntimeError(
          'TypeError',
          `'range' argument must be an integer, not ${typeName(arg)}`,
        )
      }
      return arg.value
    })
    const [first, second, third] = numbers
    let start = 0
    let stop = 0
    let step = 1
    if (numbers.length === 1) {
      stop = first ?? 0
    } else {
      start = first ?? 0
      stop = second ?? 0
      if (numbers.length === 3) step = third ?? 1
    }
    if (step === 0) {
      throw new PyRuntimeError('ValueError', 'range() arg 3 must not be zero')
    }
    const items: RuntimeValue[] = []
    if (step > 0) {
      for (let value = start; value < stop; value += step) items.push(intValue(value))
    } else {
      for (let value = start; value > stop; value += step) items.push(intValue(value))
    }
    return createList(items)
  })

  define('str', (args) => {
    const value = requireArg(args, 0, 'str')
    return stringValue(toDisplayString(value))
  })

  define('repr', (args) => {
    const value = requireArg(args, 0, 'repr')
    return stringValue(repr(value))
  })

  define('int', (args) => {
    const value = requireArg(args, 0, 'int')
    if (value.type === 'number') return intValue(Math.trunc(value.value))
    if (value.type === 'boolean') return intValue(value.value ? 1 : 0)
    if (value.type === 'string') {
      const parsed = Number(value.value.trim())
      if (value.value.trim() === '' || !Number.isFinite(parsed)) {
        throw new PyRuntimeError(
          'ValueError',
          `invalid literal for int() with base 10: '${value.value}'`,
        )
      }
      return intValue(Math.trunc(parsed))
    }
    throw new PyRuntimeError(
      'TypeError',
      `int() argument must be a string or a number, not '${typeName(value)}'`,
    )
  })

  define('float', (args) => {
    const value = requireArg(args, 0, 'float')
    if (value.type === 'number') return floatValue(value.value)
    if (value.type === 'boolean') return floatValue(value.value ? 1 : 0)
    if (value.type === 'string') {
      const parsed = Number(value.value.trim())
      if (value.value.trim() === '' || !Number.isFinite(parsed)) {
        throw new PyRuntimeError(
          'ValueError',
          `could not convert string to float: '${value.value}'`,
        )
      }
      return floatValue(parsed)
    }
    throw new PyRuntimeError(
      'TypeError',
      `float() argument must be a string or a number, not '${typeName(value)}'`,
    )
  })

  define('bool', (args) => {
    const value = requireArg(args, 0, 'bool')
    if (value.type === 'boolean') return value
    if (value.type === 'null') return boolValue(false)
    if (value.type === 'number') return boolValue(value.value !== 0)
    if (value.type === 'string') return boolValue(value.value.length > 0)
    if (value.type === 'list') return boolValue(value.items.length > 0)
    return boolValue(true)
  })

  define('abs', (args) => {
    const value = requireArg(args, 0, 'abs')
    if (value.type !== 'number') {
      throw new PyRuntimeError(
        'TypeError',
        `bad operand type for abs(): '${typeName(value)}'`,
      )
    }
    return { type: 'number', value: Math.abs(value.value), isInt: value.isInt }
  })

  define('min', (args) => extreme(args, 'min'))
  define('max', (args) => extreme(args, 'max'))

  define('sum', (args) => {
    const value = requireArg(args, 0, 'sum')
    if (value.type !== 'list') {
      throw new PyRuntimeError(
        'TypeError',
        `sum() argument must be a list, not ${typeName(value)}`,
      )
    }
    let total = 0
    let isInt = true
    for (const item of value.items) {
      if (item.type !== 'number') {
        throw new PyRuntimeError(
          'TypeError',
          `unsupported operand type(s) for +: 'int' and '${typeName(item)}'`,
        )
      }
      total += item.value
      if (!item.isInt) isInt = false
    }
    return { type: 'number', value: total, isInt }
  })

  define('sorted', (args) => {
    const value = requireArg(args, 0, 'sorted')
    if (value.type !== 'list') {
      throw new PyRuntimeError(
        'TypeError',
        `sorted() argument must be a list, not ${typeName(value)}`,
      )
    }
    const items = [...value.items]
    items.sort((a, b) => compareValues(a, b))
    return createList(items)
  })

  define('list', (args) => {
    if (args.length === 0) return createList([])
    const value = requireArg(args, 0, 'list')
    if (value.type !== 'list') {
      throw new PyRuntimeError(
        'TypeError',
        `'list' object is not callable`,
      )
    }
    return createList([...value.items])
  })

  define('type', (args) => {
    const value = requireArg(args, 0, 'type')
    return stringValue(`<class '${typeName(value)}'>`)
  })

  define('round', (args) => {
    const value = requireArg(args, 0, 'round')
    if (value.type !== 'number') {
      throw new PyRuntimeError(
        'TypeError',
        `type object doesn't define __round__ method`,
      )
    }
    const digits = args[1]
    if (digits === undefined) {
      return intValue(Math.round(value.value))
    }
    if (digits.type !== 'number') {
      throw new PyRuntimeError('TypeError', 'round() digits must be an integer')
    }
    const factor = 10 ** digits.value
    const rounded = Math.round(value.value * factor) / factor
    return digits.isInt
      ? intValue(rounded)
      : floatValue(Number(rounded.toFixed(digits.value)))
  })

  return builtins
}

function extreme(args: RuntimeValue[], kind: 'min' | 'max'): RuntimeValue {
  const value = requireArg(args, 0, kind)
  if (value.type !== 'list' || value.items.length === 0) {
    throw new PyRuntimeError(
      'ValueError',
      `${kind}() arg is an empty sequence`,
    )
  }
  let best = value.items[0]
  for (const item of value.items.slice(1)) {
    if (best === undefined) break
    const comparison = compareValues(item, best)
    if (kind === 'min' ? comparison < 0 : comparison > 0) best = item
  }
  if (best === undefined) {
    throw new PyRuntimeError('ValueError', `${kind}() arg is an empty sequence`)
  }
  return best
}

function requireArg(args: RuntimeValue[], index: number, name: string): RuntimeValue {
  const value = args[index]
  if (value === undefined) {
    throw new PyRuntimeError(
      'TypeError',
      `${name}() missing required positional argument`,
    )
  }
  return value
}

/** Metodos soportados sobre listas. */
export const LIST_METHODS = new Set([
  'append',
  'extend',
  'pop',
  'insert',
  'remove',
  'clear',
  'index',
  'count',
  'reverse',
  'sort',
])

/** Metodos soportados sobre cadenas. */
export const STRING_METHODS = new Set([
  'upper',
  'lower',
  'strip',
  'split',
  'replace',
  'startswith',
  'endswith',
  'find',
  'join',
])

/**
 * Metodos disponibles sobre listas. `null` significa "metodo no soportado".
 */
export function callListMethod(
  receiver: RuntimeValue,
  name: string,
  args: RuntimeValue[],
): RuntimeValue | null {
  if (receiver.type !== 'list') return null
  const list = receiver
  switch (name) {
    case 'append': {
      const value = requireArg(args, 0, 'append')
      list.items.push(value)
      return { type: 'null' }
    }
    case 'extend': {
      const value = requireArg(args, 0, 'extend')
      if (value.type !== 'list') {
        throw new PyRuntimeError(
          'TypeError',
          `can only extend a list with another list, not ${typeName(value)}`,
        )
      }
      list.items.push(...value.items)
      return { type: 'null' }
    }
    case 'pop': {
      if (list.items.length === 0) {
        throw new PyRuntimeError('IndexError', 'pop from empty list')
      }
      const index = args[0]
      const position =
        index === undefined
          ? list.items.length - 1
          : normalizeIndex(index, list.items.length, 'pop')
      const [removed] = list.items.splice(position, 1)
      return removed ?? { type: 'null' }
    }
    case 'insert': {
      const index = requireArg(args, 0, 'insert')
      const value = requireArg(args, 1, 'insert')
      const position = normalizeIndex(index, list.items.length + 1, 'insert')
      list.items.splice(position, 0, value)
      return { type: 'null' }
    }
    case 'remove': {
      const value = requireArg(args, 0, 'remove')
      const position = list.items.findIndex((item) => valuesEqual(item, value))
      if (position === -1) {
        throw new PyRuntimeError(
          'ValueError',
          'list.remove(x): x not in list',
        )
      }
      list.items.splice(position, 1)
      return { type: 'null' }
    }
    case 'clear': {
      list.items.length = 0
      return { type: 'null' }
    }
    case 'index': {
      const value = requireArg(args, 0, 'index')
      const position = list.items.findIndex((item) => valuesEqual(item, value))
      if (position === -1) {
        throw new PyRuntimeError('ValueError', `${repr(value)} is not in list`)
      }
      return intValue(position)
    }
    case 'count': {
      const value = requireArg(args, 0, 'count')
      return intValue(list.items.filter((item) => valuesEqual(item, value)).length)
    }
    case 'reverse': {
      list.items.reverse()
      return { type: 'null' }
    }
    case 'sort': {
      list.items.sort((a, b) => compareValues(a, b))
      return { type: 'null' }
    }
    default:
      return null
  }
}

/**
 * Metodos disponibles sobre cadenas.
 */
export function callStringMethod(
  receiver: RuntimeValue,
  name: string,
  args: RuntimeValue[],
): RuntimeValue | null {
  if (receiver.type !== 'string') return null
  const text = receiver.value
  switch (name) {
    case 'upper':
      return stringValue(text.toUpperCase())
    case 'lower':
      return stringValue(text.toLowerCase())
    case 'strip': {
      const chars = args[0]
      if (chars === undefined) return stringValue(text.trim())
      if (chars.type !== 'string') {
        throw new PyRuntimeError('TypeError', 'strip() argument must be a string')
      }
      return stringValue(trimChars(text, chars.value, true, true))
    }
    case 'split': {
      const separator = args[0]
      if (separator === undefined) {
        return createList(text.split(/\s+/).filter((part) => part.length > 0).map(stringValue))
      }
      if (separator.type !== 'string') {
        throw new PyRuntimeError('TypeError', 'split() argument must be a string')
      }
      if (separator.value === '') {
        throw new PyRuntimeError('ValueError', 'empty separator')
      }
      return createList(text.split(separator.value).map(stringValue))
    }
    case 'replace': {
      const from = requireArg(args, 0, 'replace')
      const to = requireArg(args, 1, 'replace')
      if (from.type !== 'string' || to.type !== 'string') {
        throw new PyRuntimeError(
          'TypeError',
          'replace() arguments must be strings',
        )
      }
      return stringValue(text.split(from.value).join(to.value))
    }
    case 'startswith': {
      const prefix = requireArg(args, 0, 'startswith')
      if (prefix.type !== 'string') {
        throw new PyRuntimeError('TypeError', 'startswith() argument must be a string')
      }
      return boolValue(text.startsWith(prefix.value))
    }
    case 'endswith': {
      const suffix = requireArg(args, 0, 'endswith')
      if (suffix.type !== 'string') {
        throw new PyRuntimeError('TypeError', 'endswith() argument must be a string')
      }
      return boolValue(text.endsWith(suffix.value))
    }
    case 'find': {
      const needle = requireArg(args, 0, 'find')
      if (needle.type !== 'string') {
        throw new PyRuntimeError('TypeError', 'find() argument must be a string')
      }
      return intValue(text.indexOf(needle.value))
    }
    case 'join': {
      const items = requireArg(args, 0, 'join')
      if (items.type !== 'list') {
        throw new PyRuntimeError('TypeError', 'join() argument must be a list')
      }
      const parts = items.items.map((item) => {
        if (item.type !== 'string') {
          throw new PyRuntimeError(
            'TypeError',
            'sequence item: expected str instance',
          )
        }
        return item.value
      })
      return stringValue(parts.join(text))
    }
    default:
      return null
  }
}

function trimChars(text: string, chars: string, left: boolean, right: boolean): string {
  let start = 0
  let end = text.length
  if (left) {
    while (start < end && chars.includes(text[start] ?? '')) start += 1
  }
  if (right) {
    while (end > start && chars.includes(text[end - 1] ?? '')) end -= 1
  }
  return text.slice(start, end)
}

function normalizeIndex(value: RuntimeValue, length: number, method: string): number {
  if (value.type !== 'number') {
    throw new PyRuntimeError('TypeError', `${method}() index must be an integer`)
  }
  const index = Math.trunc(value.value)
  const normalized = index < 0 ? length + index : index
  if (normalized < 0 || normalized >= length) {
    throw new PyRuntimeError('IndexError', `${method} index out of range`)
  }
  return normalized
}

export { formatFloat }
