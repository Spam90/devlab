import { SyntaxErrorLike } from './errors'
import type { Position, Token, TokenType } from './types'

const KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'while',
  'for',
  'in',
  'def',
  'return',
  'break',
  'continue',
  'pass',
  'not',
  'and',
  'or',
  'True',
  'False',
  'None',
])

/**
 * Operadores soportados. El orden dentro de cada grupo es relevante:
 * se comprueban de más largo a más corto.
 */
const OPERATORS = [
  '**=',
  '//=',
  '==',
  '!=',
  '<=',
  '>=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '**',
  '//',
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '<',
  '>',
  '(',
  ')',
  '[',
  ']',
  ',',
  ':',
  '.',
]

const ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '\\': '\\',
  "'": "'",
  '"': '"',
  '0': '\0',
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

function isIdentStart(char: string): boolean {
  return /[A-Za-z_]/.test(char)
}

function isIdentPart(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char)
}

/**
 * Tokenizador del subconjunto de Python soportado.
 *
 * Reglas de simplificación deliberadas:
 * - Solo espacios para indentación (los tabuladores se rechazan).
 * - Las líneas en blanco no producen token NEWLINE.
 * - Las cadenas triples soportan saltos de línea.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  const indents: number[] = [0]
  const length = source.length
  let index = 0
  let line = 1
  let column = 1

  const position = (): Position => ({ line, column, offset: index })

  const advance = (count: number): void => {
    for (let i = 0; i < count; i += 1) {
      if (source[index] === '\n') {
        line += 1
        column = 1
      } else {
        column += 1
      }
      index += 1
    }
  }

  const push = (type: TokenType, value: string, start: Position, literal?: number | string): void => {
    const token: Token = { type, value, start, end: position() }
    if (literal !== undefined) token.literal = literal
    tokens.push(token)
  }

  /**
   * Estado de línea: `true` justo despues de un salto de línea, cuando
   * todavia no se ha leído ningun token de la nueva línea lógica.
   */
  let lineStart = true

  /** Indentación al inicio de una línea lógica. */
  const readIndentation = (): { size: number; width: number } => {
    const start = position()
    let size = 0
    let width = 0
    while (index < length) {
      const char = source[index]
      if (char === ' ') {
        size += 1
        width += 1
        advance(1)
      } else if (char === '\t') {
        throw new SyntaxErrorLike(
          'Los tabuladores no están soportados para indentación; usa espacios.',
          start,
        )
      } else {
        break
      }
    }
    return { size, width }
  }

  const handleIndentation = (): void => {
    const { width } = readIndentation()
    const current = indents[indents.length - 1] ?? 0
    if (width === current) return
    if (width > current) {
      indents.push(width)
      push('indent', '', position())
      return
    }
    while ((indents[indents.length - 1] ?? 0) > width) {
      indents.pop()
      push('dedent', '', position())
    }
    if ((indents[indents.length - 1] ?? 0) !== width) {
      throw new SyntaxErrorLike(
        'La indentación no coincide con ningún nivel de indentación externo.',
        position(),
      )
    }
  }

  while (index < length) {
    const char = source[index] ?? ''

    // --- Indentación (se resuelve antes que los espacios sueltos) -------
    if (lineStart) {
      lineStart = false
      handleIndentation()
      if (index >= length) break
      continue
    }

    // --- Espacios y líneas en blanco -------------------------------------
    if (char === ' ' || char === '\t' || char === '\r') {
      advance(1)
      continue
    }

    if (char === '\n') {
      const start = position()
      advance(1)
      lineStart = true
      // Un NEWLINE solo tiene sentido si la línea tiene contenido logico.
      const last = tokens[tokens.length - 1]
      if (last && last.type !== 'newline' && last.type !== 'indent' && last.type !== 'dedent') {
        push('newline', '\n', start)
      }
      continue
    }

    // --- Comentarios ------------------------------------------------------
    if (char === '#') {
      while (index < length && source[index] !== '\n') advance(1)
      continue
    }

    // --- Continuación de línea -------------------------------------------
    if (char === '\\' && source[index + 1] === '\n') {
      advance(2)
      continue
    }

    // --- Cadenas ----------------------------------------------------------
    if (char === '"' || char === "'") {
      const start = position()
      const quote = char
      const isTriple = source.slice(index, index + 3) === quote.repeat(3)
      const delimiter = isTriple ? quote.repeat(3) : quote
      advance(delimiter.length)
      let value = ''
      let terminated = false
      while (index < length) {
        const current = source[index] ?? ''
        if (current === '\\') {
          const next = source[index + 1]
          if (next === undefined) break
          if (next === '\n') {
            advance(2)
            continue
          }
          const escaped = ESCAPES[next]
          if (escaped === undefined) {
            throw new SyntaxErrorLike(
              `Secuencia de escape inválida: \\${next}`,
              position(),
            )
          }
          value += escaped
          advance(2)
          continue
        }
        if (source.startsWith(delimiter, index)) {
          advance(delimiter.length)
          terminated = true
          break
        }
        value += current
        advance(1)
      }
      if (!terminated) {
        throw new SyntaxErrorLike('Cadena sin cerrar (literal multilínea sin terminar).', start)
      }
      push('string', value, start, value)
      continue
    }

    // --- Numeros ----------------------------------------------------------
    if (isDigit(char) || (char === '.' && isDigit(source[index + 1] ?? ''))) {
      const start = position()
      let raw = ''
      let isFloat = false
      while (index < length) {
        const current = source[index] ?? ''
        if (isDigit(current)) {
          raw += current
          advance(1)
          continue
        }
        if (current === '_') {
          raw += current
          advance(1)
          continue
        }
        if (current === '.' && !isFloat) {
          isFloat = true
          raw += current
          advance(1)
          continue
        }
        if ((current === 'e' || current === 'E') && isFloat) {
          isFloat = true
          raw += current
          advance(1)
          const sign = source[index]
          if (sign === '+' || sign === '-') {
            raw += sign
            advance(1)
          }
          continue
        }
        break
      }
      const cleaned = raw.replace(/_/g, '')
      const numeric = Number(cleaned)
      if (!Number.isFinite(numeric)) {
        throw new SyntaxErrorLike(`Literal numérico inválido: ${raw}`, start)
      }
      push('number', cleaned, start, numeric)
      continue
    }

    // --- Identificadores y palabras clave ---------------------------------
    if (isIdentStart(char)) {
      const start = position()
      let name = ''
      while (index < length && isIdentPart(source[index] ?? '')) {
        name += source[index]
        advance(1)
      }
      push(KEYWORDS.has(name) ? 'keyword' : 'name', name, start)
      continue
    }

    // --- Operadores --------------------------------------------------------
    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index))
    if (operator) {
      const start = position()
      advance(operator.length)
      push('operator', operator, start)
      continue
    }

    throw new SyntaxErrorLike(`Carácter inválido: '${char}'`, position())
  }

  const last = tokens[tokens.length - 1]
  if (last && last.type !== 'newline' && last.type !== 'indent' && last.type !== 'dedent') {
    push('newline', '\n', position())
  }
  while (indents.length > 1) {
    indents.pop()
    push('dedent', '', position())
  }
  push('eof', '', position())

  return tokens
}
