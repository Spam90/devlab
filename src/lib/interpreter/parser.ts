import { SyntaxErrorLike } from './errors'
import { tokenize } from './tokenizer'
import type {
  AssignTarget,
  Expression,
  Parameter,
  Position,
  Program,
  Statement,
  Token,
} from './types'

const AUGMENTED_OPERATORS = new Set(['+=', '-=', '*=', '/=', '//=', '%=', '**='])
const COMPARE_OPERATORS = new Set(['==', '!=', '<', '<=', '>', '>='])
const BINARY_PRECEDENCE: Record<string, number> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  in: 3,
  'not in': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '//': 5,
  '%': 5,
}

/**
 * Parser descendente recursivo con climbed de precedencia para expresiones.
 *
 * Subconjunto aceptado (documentado en docs/CAPABILITIES.md):
 * - Sentencias: expresion, asignación, asignación aumentada, if/elif/else,
 *   while, for, def, return, break, continue, pass.
 * - Expresiones: literales, nombres, listas, operadores aritmeticos y
 *   logicos, comparaciones, llamadas, atributos, indexado y expresion
 *   condicional (`a if cond else b`).
 */
export class Parser {
  private readonly tokens: Token[]
  private current = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  // -- utilidades ----------------------------------------------------------

  private peek(offset = 0): Token {
    const token = this.tokens[this.current + offset]
    if (!token) {
      return {
        type: 'eof',
        value: '',
        start: { line: 0, column: 0, offset: 0 },
        end: { line: 0, column: 0, offset: 0 },
      }
    }
    return token
  }

  private advance(): Token {
    const token = this.peek()
    if (this.current < this.tokens.length - 1) this.current += 1
    return token
  }

  private check(type: Token['type'], value?: string): boolean {
    const token = this.peek()
    if (token.type !== type) return false
    if (value !== undefined && token.value !== value) return false
    return true
  }

  private match(type: Token['type'], value?: string): boolean {
    if (!this.check(type, value)) return false
    this.advance()
    return true
  }

  private expect(type: Token['type'], value?: string, message?: string): Token {
    if (this.check(type, value)) return this.advance()
    const token = this.peek()
    const found = token.type === 'eof' ? 'fin de archivo' : `'${token.value}'`
    throw new SyntaxErrorLike(
      message ?? `Se esperaba ${value ? `'${value}'` : type} pero se encontró ${found}.`,
      token.start,
    )
  }

  private position(): Position {
    return this.peek().start
  }

  // -- programa ------------------------------------------------------------

  parseProgram(): Program {
    const body: Statement[] = []
    while (!this.check('eof')) {
      body.push(this.parseStatement())
    }
    return { body }
  }

  private parseBlock(): Statement[] {
    this.expect('operator', ':', "Se esperaba ':' al final de la cabecera.")
    if (!this.match('newline')) {
      // Bloque en una sola línea: `if x: print(1)`
      const statement = this.parseSimpleStatement()
      return [statement]
    }
    if (!this.check('indent')) {
      const token = this.peek()
      throw new SyntaxErrorLike('Se esperaba un bloque indentado.', token.start)
    }
    this.advance() // consume INDENT
    const statements: Statement[] = []
    while (!this.check('dedent') && !this.check('eof')) {
      statements.push(this.parseStatement())
    }
    if (this.check('dedent')) this.advance()
    return statements
  }

  private parseStatement(): Statement {
    if (this.check('keyword', 'if')) return this.parseIf()
    if (this.check('keyword', 'while')) return this.parseWhile()
    if (this.check('keyword', 'for')) return this.parseFor()
    if (this.check('keyword', 'def')) return this.parseFunction()
    return this.parseSimpleStatement()
  }

  private parseSimpleStatement(): Statement {
    const token = this.peek()
    const pos = token.start

    if (this.match('keyword', 'return')) {
      if (this.check('newline') || this.check('eof')) {
        this.expectLineEnd()
        return { kind: 'return', value: null, pos }
      }
      const value = this.parseExpression()
      this.expectLineEnd()
      return { kind: 'return', value, pos }
    }

    if (this.match('keyword', 'break')) {
      this.expectLineEnd()
      return { kind: 'break', pos }
    }

    if (this.match('keyword', 'continue')) {
      this.expectLineEnd()
      return { kind: 'continue', pos }
    }

    if (this.match('keyword', 'pass')) {
      this.expectLineEnd()
      return { kind: 'pass', pos }
    }

    const expression = this.parseExpression()

    // Asignación aumentada: `x += 1`
    const augmented = this.peek()
    if (augmented.type === 'operator' && AUGMENTED_OPERATORS.has(augmented.value)) {
      this.advance()
      const value = this.parseExpression()
      this.expectLineEnd()
      const target = this.toAssignTarget(expression)
      return { kind: 'augmented', target, op: augmented.value.slice(0, -1), value, pos }
    }

    // Asignación (posiblemultiple: `a = b = valor`)
    if (this.check('operator', '=')) {
      const targets: AssignTarget[] = []
      targets.push(this.toAssignTarget(expression))
      while (this.match('operator', '=')) {
        const next = this.parseExpression()
        if (this.check('operator', '=')) {
          targets.push(this.toAssignTarget(next))
          continue
        }
        this.expectLineEnd()
        return { kind: 'assignment', targets, value: next, pos }
      }
      this.expectLineEnd()
      return { kind: 'assignment', targets, value: expression, pos }
    }

    this.expectLineEnd()
    return { kind: 'expression', expr: expression, pos }
  }

  private expectLineEnd(): void {
    if (this.match('newline')) return
    if (this.check('eof')) return
    const token = this.peek()
    throw new SyntaxErrorLike(
      `Se esperaba el final de la línea pero se encontró '${token.value}'.`,
      token.start,
    )
  }

  private toAssignTarget(expression: Expression): AssignTarget {
    if (expression.kind === 'name') {
      return { kind: 'name', id: expression.id ?? '', pos: expression.pos }
    }
    if (expression.kind === 'index') {
      const object = expression.object
      const index = expression.index
      if (!object || !index) {
        throw new SyntaxErrorLike('Indexación incompleta en la asignación.', expression.pos)
      }
      return { kind: 'index', object, index, pos: expression.pos }
    }
    throw new SyntaxErrorLike(
      'No se puede asignar a esta expresión; solo se admiten nombres e índices.',
      expression.pos,
    )
  }

  private parseIf(): Statement {
    const pos = this.position()
    this.advance() // if
    const test = this.parseExpression()
    const body = this.parseBlock()
    let orelse: Statement[] = []
    if (this.check('keyword', 'elif')) {
      orelse = [this.parseIf()]
    } else if (this.match('keyword', 'else')) {
      orelse = this.parseBlock()
    }
    return { kind: 'if', test, body, orelse, pos }
  }

  private parseWhile(): Statement {
    const pos = this.position()
    this.advance() // while
    const test = this.parseExpression()
    const body = this.parseBlock()
    return { kind: 'while', test, body, pos }
  }

  private parseFor(): Statement {
    const pos = this.position()
    this.advance() // for
    const nameToken = this.expect('name', undefined, 'Se esperaba un nombre de variable.')
    this.expect('keyword', 'in', "Se esperaba 'in' en el bucle for.")
    const iter = this.parseExpression()
    const body = this.parseBlock()
    const target: AssignTarget = { kind: 'name', id: nameToken.value, pos: nameToken.start }
    return { kind: 'for', target, iter, body, pos }
  }

  private parseFunction(): Statement {
    const pos = this.position()
    this.advance() // def
    const nameToken = this.expect('name', undefined, 'Se esperaba el nombre de la función.')
    this.expect('operator', '(', "Se esperaba '(' tras el nombre de la función.")
    const params: Parameter[] = []
    if (!this.check('operator', ')')) {
      do {
        const param = this.expect('name', undefined, 'Se esperaba un nombre de parámetro.')
        params.push({ name: param.value, pos: param.start })
      } while (this.match('operator', ','))
    }
    this.expect('operator', ')', "Se esperaba ')' tras los parámetros.")
    const body = this.parseBlock()
    return { kind: 'function', name: nameToken.value, params, body, pos }
  }

  // -- expresiones ----------------------------------------------------------

  parseExpression(): Expression {
    return this.parseConditional()
  }

  private parseConditional(): Expression {
    const consequent = this.parseBinary(1)
    if (!this.check('keyword', 'if')) return consequent
    this.advance()
    const test = this.parseBinary(1)
    this.expect('keyword', 'else', "Se esperaba 'else' en la expresion condicional.")
    const alternate = this.parseConditional()
    return {
      kind: 'conditional',
      test,
      consequent,
      alternate,
      pos: consequent.pos,
    }
  }

  private peekBinaryOperator(): { op: string; token: Token } | null {
    const token = this.peek()
    if (token.type === 'operator' && BINARY_PRECEDENCE[token.value] !== undefined) {
      return { op: token.value, token }
    }
    if (token.type === 'keyword' && token.value === 'and') {
      return { op: 'and', token }
    }
    if (token.type === 'keyword' && token.value === 'or') {
      return { op: 'or', token }
    }
    if (token.type === 'keyword' && token.value === 'in') {
      return { op: 'in', token }
    }
    if (
      token.type === 'keyword' &&
      token.value === 'not' &&
      this.peek(1).type === 'keyword' &&
      this.peek(1).value === 'in'
    ) {
      return { op: 'not in', token }
    }
    return null
  }

  private consumeBinaryOperator(op: string): void {
    this.advance()
    if (op === 'not in') this.advance()
  }

  private static isComparison(op: string): boolean {
    return (
      op === '==' ||
      op === '!=' ||
      op === '<' ||
      op === '<=' ||
      op === '>' ||
      op === '>=' ||
      op === 'in' ||
      op === 'not in'
    )
  }

  private parseBinary(minPrecedence: number): Expression {
    let left = this.parseUnary()
    for (;;) {
      const operator = this.peekBinaryOperator()
      if (operator === null) return left
      const precedence = BINARY_PRECEDENCE[operator.op]
      if (precedence === undefined || precedence < minPrecedence) return left
      if (Parser.isComparison(operator.op)) {
        left = this.parseComparisonFrom(left)
        continue
      }
      this.consumeBinaryOperator(operator.op)

      const right = this.parseBinary(operator.op === '**' ? precedence : precedence + 1)
      left = this.buildBinary(operator.op, left, right, operator.token.start)
    }
  }

  /**
   * Encadena comparaciones al estilo Python: `a < b < c` equivale a
   * `a < b and b < c`.
   */
  private parseComparisonFrom(first: Expression): Expression {
    const operands: Expression[] = [first]
    const operators: { op: string; token: Token }[] = []

    for (;;) {
      const operator = this.peekBinaryOperator()
      if (operator === null || !Parser.isComparison(operator.op)) break
      this.consumeBinaryOperator(operator.op)
      operators.push(operator)
      operands.push(this.parseBinary(4))
    }

    const comparisons = operators.map((operator, index) => {
      const left = operands[index]
      const right = operands[index + 1]
      if (left === undefined || right === undefined) return first
      return this.buildBinary(operator.op, left, right, operator.token.start)
    })

    let result = comparisons[0] ?? first
    for (let index = 1; index < comparisons.length; index += 1) {
      const comparison = comparisons[index]
      if (!comparison) break
      result = {
        kind: 'logical',
        op: 'and',
        left: result,
        right: comparison,
        pos: comparison.pos,
      }
    }
    return result
  }

  private buildBinary(
    op: string,
    left: Expression,
    right: Expression,
    pos: Position,
  ): Expression {
    if (op === 'and' || op === 'or') {
      return { kind: 'logical', op, left, right, pos }
    }
    if (op === 'in' || op === 'not in') {
      return { kind: 'compare', op, left, right, pos }
    }
    if (COMPARE_OPERATORS.has(op)) {
      return { kind: 'compare', op, left, right, pos }
    }
    return { kind: 'binary', op, left, right, pos }
  }

  private parseUnary(): Expression {
    const token = this.peek()
    if (token.type === 'operator' && (token.value === '-' || token.value === '+')) {
      this.advance()
      const operand = this.parseUnary()
      return { kind: 'unary', op: token.value, operand, pos: token.start }
    }
    if (token.type === 'keyword' && token.value === 'not') {
      this.advance()
      const operand = this.parseUnary()
      return { kind: 'unary', op: 'not', operand, pos: token.start }
    }
    return this.parsePower()
  }

  private parsePower(): Expression {
    const base = this.parsePostfix()
    const token = this.peek()
    if (token.type === 'operator' && token.value === '**') {
      this.advance()
      const exponent = this.parseUnary()
      return { kind: 'binary', op: '**', left: base, right: exponent, pos: token.start }
    }
    return base
  }

  private parsePostfix(): Expression {
    let expression = this.parseAtom()
    for (;;) {
      if (this.check('operator', '(')) {
        const pos = this.position()
        this.advance()
        const args: Expression[] = []
        if (!this.check('operator', ')')) {
          do {
            args.push(this.parseExpression())
          } while (this.match('operator', ','))
        }
        this.expect('operator', ')', "Se esperaba ')' tras los argumentos.")
        expression = { kind: 'call', callee: expression, args, pos }
        continue
      }
      if (this.check('operator', '[')) {
        const pos = this.position()
        this.advance()
        if (this.check('operator', ':')) {
          this.advance()
          const end = this.check('operator', ']') ? undefined : this.parseExpression()
          this.expect('operator', ']', "Se esperaba ']' tras el segmento.")
          expression = { kind: 'index', object: expression, sliceEnd: end, isSlice: true, pos }
          continue
        }
        const index = this.parseExpression()
        if (this.check('operator', ':')) {
          this.advance()
          const end = this.check('operator', ']') ? undefined : this.parseExpression()
          this.expect('operator', ']', "Se esperaba ']' tras el segmento.")
          expression = {
            kind: 'index',
            object: expression,
            sliceStart: index,
            sliceEnd: end,
            isSlice: true,
            pos,
          }
          continue
        }
        this.expect('operator', ']', "Se esperaba ']' tras el indice.")
        expression = { kind: 'index', object: expression, index, pos }
        continue
      }
      if (this.check('operator', '.')) {
        const pos = this.position()
        this.advance()
        const name = this.expect('name', undefined, "Se esperaba el nombre del atributo.")
        expression = { kind: 'attribute', object: expression, name: name.value, pos }
        continue
      }
      return expression
    }
  }

  private parseAtom(): Expression {
    const token = this.peek()
    const pos = token.start

    switch (token.type) {
      case 'number': {
        this.advance()
        const isInt = !/[.eE]/.test(token.value)
        return {
          kind: 'number',
          value: Number(token.literal ?? token.value),
          isFloat: !isInt,
          pos,
        }
      }
      case 'string': {
        this.advance()
        return { kind: 'string', value: String(token.literal ?? token.value), pos }
      }
      case 'name': {
        this.advance()
        return { kind: 'name', id: token.value, pos }
      }
      case 'keyword': {
        if (token.value === 'True' || token.value === 'False') {
          this.advance()
          return { kind: 'boolean', value: token.value === 'True', pos }
        }
        if (token.value === 'None') {
          this.advance()
          return { kind: 'none', pos }
        }
        if (token.value === 'not') {
          this.advance()
          const operand = this.parseUnary()
          return { kind: 'unary', op: 'not', operand, pos }
        }
        break
      }
      case 'operator': {
        if (token.value === '(') {
          this.advance()
          const inner = this.parseExpression()
          this.expect('operator', ')', "Se esperaba ')'.")
          return inner
        }
        if (token.value === '[') {
          this.advance()
          const elements: Expression[] = []
          if (!this.check('operator', ']')) {
            do {
              if (this.check('operator', ']')) break
              elements.push(this.parseExpression())
            } while (this.match('operator', ','))
          }
          this.expect('operator', ']', "Se esperaba ']' tras la lista.")
          return { kind: 'list', elements, pos }
        }
        break
      }
      default:
        break
    }

    if (token.type === 'eof') {
      throw new SyntaxErrorLike('El programa termina de forma inesperada.', pos)
    }
    throw new SyntaxErrorLike(`Sintaxis inválida cerca de '${token.value}'.`, pos)
  }
}

/** Analiza un programa fuente completo. */
export function parse(source: string): Program {
  const tokens = tokenize(source)
  const parser = new Parser(tokens)
  return parser.parseProgram()
}
