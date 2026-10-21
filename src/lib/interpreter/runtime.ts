import {
  LIST_METHODS,
  STRING_METHODS,
  callListMethod,
  callStringMethod,
  createBuiltins,
} from './builtins'
import { describeStatement } from './describe'
import {
  LimitError,
  PyRuntimeError,
  RuntimeErrorLike,
  toInterpreterError,
} from './errors'
import {
  boolValue,
  compareValues,
  contains,
  createList,
  floatValue,
  intValue,
  isTruthy,
  lookup,
  repr,
  resolveAssignmentScope,
  stringValue,
  toSnapshot,
  typeName,
  valuesEqual,
} from './values'
import type {
  AssignTarget,
  BuiltinContext,
  CallFrame,
  Expression,
  Position,
  Program,
  RuntimeValue,
  RunResult,
  Scope,
  SnapshotFrame,
  SnapshotValue,
  StepKind,
  StepSnapshot,
  Statement,
} from './types'

export interface InterpreterLimits {
  /** Número máximo de pasos registrados en el historial. */
  maxSteps: number
  /** Número máximo de instrucciones evaluadas. */
  maxInstructions: number
  /** Profundidad maxima de llamadas a funciones. */
  maxCallDepth: number
  /** Longitud maxima de una lista. */
  maxListLength: number
  /** Número máximo de caracteres de salida acumulada. */
  maxOutputBytes: number
  /** Tiempo máximo de ejecución en milisegundos. */
  timeoutMs: number
  /** Longitud maxima del código fuente. */
  maxSourceLength: number
}

export const DEFAULT_LIMITS: InterpreterLimits = {
  maxSteps: 20_000,
  maxInstructions: 2_000_000,
  maxCallDepth: 64,
  maxListLength: 5_000,
  maxOutputBytes: 200_000,
  timeoutMs: 5_000,
  maxSourceLength: 100_000,
}

class ReturnSignal {
  constructor(readonly value: RuntimeValue | null) {}
}

class BreakSignal {}

class ContinueSignal {}

/**
 * Interprete educativo de Python.
 *
 * Caracteristicas:
 * - Determinista: la misma entrada produce exactamente el mismo historial.
 * - Paso a paso: cada sentencia y llamada genera un paso inspeccionable.
 * - Reversible: el historial permite avanzar y retroceder sin reejecutar,
 *   porque cada paso guarda una instantanea del estado.
 *
 * Limitaciones documentadas en docs/CAPABILITIES.md: no es un Python
 * completo. No se usa `eval`, `new Function` ni ejecución arbitraria.
 */
export class Interpreter {
  private readonly program: Program
  private readonly limits: InterpreterLimits
  private readonly globalScope: Scope
  private readonly frames: CallFrame[] = []
  private readonly output: string[] = []
  private readonly steps: StepSnapshot[] = []
  private readonly builtins: Map<string, RuntimeValue>

  private instructions = 0
  private outputLength = 0
  private scopesDirty = true
  private framesDirty = true
  private lastGlobals: { name: string; value: SnapshotValue }[] = []
  private lastFrames: SnapshotFrame[] = []
  private scopeId = 1
  private status: RunResult['status'] = 'completed'
  private error: RunResult['error']
  private limitReason: RunResult['limitReason']
  private startedAt = 0

  constructor(program: Program, limits: Partial<InterpreterLimits> = {}) {
    this.program = program
    this.limits = { ...DEFAULT_LIMITS, ...limits }
    this.globalScope = { id: this.nextScopeId(), name: 'global', vars: new Map(), parent: null }
    this.builtins = createBuiltins({
      print: (text) => this.write(text),
      position: () => ({ line: 0, column: 0, offset: 0 }),
    })
  }

  // -- API pública ---------------------------------------------------------

  run(): RunResult {
    this.startedAt = Date.now()
    this.recordStep('start', { line: 1, column: 1, offset: 0 }, 'Inicio')

    try {
      this.executeBlock(this.program.body, this.globalScope)
    } catch (error) {
      this.handleError(error)
    }

    return {
      status: this.status,
      steps: this.steps,
      output: [...this.output],
      error: this.error,
      instructions: this.instructions,
      limitReason: this.limitReason,
    }
  }

  // -- infraestructura -----------------------------------------------------

  private nextScopeId(): number {
    const id = this.scopeId
    this.scopeId += 1
    return id
  }

  private write(text: string): void {
    this.outputLength += text.length
    if (this.outputLength > this.limits.maxOutputBytes) {
      throw new LimitError('Se ha superado el límite de salida acumulada.')
    }
    this.output.push(text)
  }

  private tick(position: Position): void {
    this.instructions += 1
    if (this.instructions > this.limits.maxInstructions) {
      throw new LimitError('Se ha superado el límite de instrucciones ejecutadas.', position)
    }
    if (this.instructions % 512 === 0 && Date.now() - this.startedAt > this.limits.timeoutMs) {
      throw new LimitError('Se ha superado el tiempo máximo de ejecución.', position)
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof LimitError) {
      this.status = 'limit'
      this.limitReason = this.inferLimitReason(error.message)
      this.error = {
        type: error.type,
        message: error.message,
        line: error.position?.line ?? 0,
        column: error.position?.column ?? 0,
      }
      this.safeRecordStep(
        'exception',
        error.position ?? { line: 0, column: 0, offset: 0 },
        error.message,
        this.error,
      )
      return
    }
    const interpreterError = toInterpreterError(error)
    this.status = 'error'
    this.error = {
      type: interpreterError.type,
      message: interpreterError.message,
      line: interpreterError.position?.line ?? 0,
      column: interpreterError.position?.column ?? 0,
    }
    this.safeRecordStep(
      'exception',
      interpreterError.position ?? { line: 0, column: 0, offset: 0 },
      interpreterError.message,
      this.error,
    )
  }

  private inferLimitReason(message: string): RunResult['limitReason'] {
    if (message.includes('instrucciones')) return 'instructions'
    if (message.includes('tiempo')) return 'time'
    if (message.includes('recursion') || message.includes('profundidad')) return 'call-depth'
    if (message.includes('salida')) return 'output'
    return 'steps'
  }

  // -- historial ------------------------------------------------------------

  private recordStep(
    kind: StepKind,
    position: Position,
    label: string,
    error?: RunResult['error'],
  ): void {
    if (this.steps.length >= this.limits.maxSteps) {
      throw new LimitError('Se ha superado el límite de pasos registrados.', position)
    }

    if (this.scopesDirty) {
      this.lastGlobals = [...this.globalScope.vars.entries()].map(([name, value]) => ({
        name,
        value: toSnapshot(value),
      }))
      this.scopesDirty = false
    }

    if (this.framesDirty) {
      this.lastFrames = this.frames.map((frame) => ({
        name: frame.name,
        line: frame.line,
        locals: [...frame.locals.entries()].map(([name, value]) => ({
          name,
          value: toSnapshot(value),
        })),
      }))
      this.framesDirty = false
    }

    this.steps.push({
      index: this.steps.length,
      kind,
      line: position.line,
      column: position.column,
      label,
      globals: this.lastGlobals,
      frames: this.lastFrames,
      outputLength: this.output.length,
      error,
    })
  }

  /**
   * Registra un paso sin propagar el error de limite de pasos.
   *
   * Se usa en los caminos de error: si ya se alcanzo el máximo de pasos,
   * anadir uno más no debe reemplazar el error original por otro.
   */
  private safeRecordStep(
    kind: StepKind,
    position: Position,
    label: string,
    error?: RunResult['error'],
  ): void {
    try {
      this.recordStep(kind, position, label, error)
    } catch {
      // El limite de pasos ya se ha alcanzado: se conserva el error original.
    }
  }

  // -- ejecución de sentencias --------------------------------------------

  private executeBlock(statements: Statement[], scope: Scope): void {
    for (const statement of statements) {
      try {
        this.executeStatement(statement, scope)
      } catch (error) {
        if (
          error instanceof ReturnSignal ||
          error instanceof BreakSignal ||
          error instanceof ContinueSignal
        ) {
          this.safeRecordStep('statement', statement.pos, describeStatement(statement))
          throw error
        }
        throw error
      }
      this.recordStep('statement', statement.pos, describeStatement(statement))
    }
  }

  private executeStatement(statement: Statement, scope: Scope): void {
    this.tick(statement.pos)
    switch (statement.kind) {
      case 'expression':
        this.evaluate(statement.expr, scope)
        return
      case 'assignment': {
        const value = this.evaluate(statement.value, scope)
        for (const target of statement.targets) {
          this.assign(target, value, scope)
        }
        return
      }
      case 'augmented': {
        const current = this.readTarget(statement.target, scope)
        const value = this.evaluate(statement.value, scope)
        const result = this.binaryOp(statement.op, current, value, statement.pos)
        this.assign(statement.target, result, scope)
        return
      }
      case 'if': {
        const test = this.evaluate(statement.test, scope)
        if (isTruthy(test)) {
          this.executeBlock(statement.body, scope)
        } else if (statement.orelse.length > 0) {
          this.executeBlock(statement.orelse, scope)
        }
        return
      }
      case 'while': {
        for (;;) {
          this.tick(statement.pos)
          const test = this.evaluate(statement.test, scope)
          if (!isTruthy(test)) break
          try {
            this.executeBlock(statement.body, scope)
          } catch (error) {
            if (error instanceof BreakSignal) break
            if (error instanceof ContinueSignal) continue
            throw error
          }
        }
        return
      }
      case 'for': {
        const iterable = this.evaluate(statement.iter, scope)
        const items = this.iterate(iterable, statement.pos)
        for (const item of items) {
          this.tick(statement.pos)
          this.assign(statement.target, item, scope)
          try {
            this.executeBlock(statement.body, scope)
          } catch (error) {
            if (error instanceof BreakSignal) break
            if (error instanceof ContinueSignal) continue
            throw error
          }
        }
        return
      }
      case 'function': {
        const functionScope = scope
        functionScope.vars.set(statement.name, {
          type: 'function',
          name: statement.name,
          params: statement.params,
          body: statement.body,
          closure: functionScope,
          pos: statement.pos,
        })
        this.scopesDirty = true
        return
      }
      case 'return':
        throw new ReturnSignal(
          statement.value ? this.evaluate(statement.value, scope) : null,
        )
      case 'break':
        throw new BreakSignal()
      case 'continue':
        throw new ContinueSignal()
      case 'pass':
        return
      default: {
        const unknownStatement = statement as { kind: string; pos: Position }
        throw new RuntimeErrorLike(
          'NotImplementedError',
          `Sentencia no soportada: ${unknownStatement.kind}`,
          unknownStatement.pos,
        )
      }
    }
  }

  private iterate(value: RuntimeValue, position: Position): RuntimeValue[] {
    if (value.type === 'list') {
      if (value.items.length > this.limits.maxListLength) {
        throw new LimitError('Se ha superado el límite de elementos de una lista.', position)
      }
      return [...value.items]
    }
    if (value.type === 'string') {
      return [...value.value].map((char) => stringValue(char))
    }
    throw new PyRuntimeError(
      'TypeError',
      `'${typeName(value)}' object is not iterable`,
    )
  }

  // -- asignaciones ---------------------------------------------------------

  private assign(target: AssignTarget, value: RuntimeValue, scope: Scope): void {
    if (target.kind === 'name') {
      const name = target.id
      const targetScope = resolveAssignmentScope(scope, name)
      targetScope.vars.set(name, value)
      this.scopesDirty = true
      return
    }
    const container = this.evaluate(target.object, scope)
    if (container.type !== 'list') {
      throw new PyRuntimeError(
        'TypeError',
        `'${typeName(container)}' object does not support item assignment`,
        target.pos,
      )
    }
    const indexValue = this.evaluate(target.index, scope)
    if (indexValue.type !== 'number') {
      throw new PyRuntimeError(
        'TypeError',
        'list índices must be integers',
        target.pos,
      )
    }
    const index = Math.trunc(indexValue.value)
    const normalized = index < 0 ? container.items.length + index : index
    if (normalized < 0 || normalized >= container.items.length) {
      throw new PyRuntimeError('IndexError', 'list assignment index out of range', target.pos)
    }
    container.items[normalized] = value
    this.scopesDirty = true
  }

  private readTarget(target: AssignTarget, scope: Scope): RuntimeValue {
    if (target.kind === 'name') {
      const name = target.id
      const found = lookup(scope, name)
      if (found === undefined) {
        throw new PyRuntimeError('NameError', `name '${name}' is not defined`, target.pos)
      }
      return found
    }
    const container = this.evaluate(target.object, scope)
    const indexValue = this.evaluate(target.index, scope)
    if (container.type === 'list') {
      if (indexValue.type !== 'number') {
        throw new PyRuntimeError('TypeError', 'list índices must be integers', target.pos)
      }
      const index = Math.trunc(indexValue.value)
      const normalized = index < 0 ? container.items.length + index : index
      const item = container.items[normalized]
      if (item === undefined) {
        throw new PyRuntimeError('IndexError', 'list index out of range', target.pos)
      }
      return item
    }
    if (container.type === 'string') {
      if (indexValue.type !== 'number') {
        throw new PyRuntimeError('TypeError', 'string índices must be integers', target.pos)
      }
      const index = Math.trunc(indexValue.value)
      const normalized = index < 0 ? container.value.length + index : index
      const char = container.value[normalized]
      if (char === undefined) {
        throw new PyRuntimeError('IndexError', 'string index out of range', target.pos)
      }
      return stringValue(char)
    }
    throw new PyRuntimeError(
      'TypeError',
      `'${typeName(container)}' object is not subscriptable`,
      target.pos,
    )
  }

  // -- expresiones ----------------------------------------------------------

  private evaluate(expression: Expression, scope: Scope): RuntimeValue {
    this.tick(expression.pos)
    switch (expression.kind) {
      case 'number': {
        const raw = typeof expression.value === 'number' ? expression.value : 0
        return expression.isFloat ? floatValue(raw) : intValue(raw)
      }
      case 'string':
        return stringValue(String(expression.value ?? ''))
      case 'boolean':
        return boolValue(Boolean(expression.value))
      case 'none':
        return { type: 'null' }
      case 'name': {
        const name = expression.id ?? ''
        const found = lookup(scope, name)
        if (found === undefined) {
          if (this.builtins.has(name)) {
            const builtin = this.builtins.get(name)
            if (builtin) return builtin
          }
          throw new PyRuntimeError('NameError', `name '${name}' is not defined`, expression.pos)
        }
        return found
      }
      case 'list': {
        const items = (expression.elements ?? []).map((element) =>
          this.evaluate(element, scope),
        )
        if (items.length > this.limits.maxListLength) {
          throw new LimitError(
            'Se ha superado el límite de elementos de una lista.',
            expression.pos,
          )
        }
        return createList(items)
      }
      case 'unary': {
        const operand = this.evaluate(expression.operand ?? expression, scope)
        if (expression.op === 'not') return boolValue(!isTruthy(operand))
        if (expression.op === '-') {
          if (operand.type !== 'number') {
            throw new PyRuntimeError(
              'TypeError',
              `bad operand type for unary -: '${typeName(operand)}'`,
              expression.pos,
            )
          }
          return { type: 'number', value: -operand.value, isInt: operand.isInt }
        }
        if (expression.op === '+') {
          if (operand.type !== 'number') {
            throw new PyRuntimeError(
              'TypeError',
              `bad operand type for unary +: '${typeName(operand)}'`,
              expression.pos,
            )
          }
          return operand
        }
        throw new RuntimeErrorLike(
          'SyntaxError',
          `Operador unario no soportado: ${expression.op ?? ''}`,
          expression.pos,
        )
      }
      case 'binary': {
        const left = this.evaluate(expression.left ?? expression, scope)
        const right = this.evaluate(expression.right ?? expression, scope)
        return this.binaryOp(expression.op ?? '+', left, right, expression.pos)
      }
      case 'logical': {
        const left = this.evaluate(expression.left ?? expression, scope)
        if (expression.op === 'and') {
          return isTruthy(left) ? this.evaluate(expression.right ?? expression, scope) : left
        }
        return isTruthy(left) ? left : this.evaluate(expression.right ?? expression, scope)
      }
      case 'compare': {
        const left = this.evaluate(expression.left ?? expression, scope)
        const right = this.evaluate(expression.right ?? expression, scope)
        return this.compareOp(expression.op ?? '==', left, right, expression.pos)
      }
      case 'conditional': {
        const test = this.evaluate(expression.test ?? expression, scope)
        return isTruthy(test)
          ? this.evaluate(expression.consequent ?? expression, scope)
          : this.evaluate(expression.alternate ?? expression, scope)
      }
      case 'attribute': {
        const object = this.evaluate(expression.object ?? expression, scope)
        return this.getAttribute(object, expression.name ?? '', expression.pos)
      }
      case 'index': {
        const container = this.evaluate(expression.object ?? expression, scope)
        if (expression.isSlice) {
          return this.getSlice(container, expression, scope)
        }
        const indexValue = this.evaluate(expression.index ?? expression, scope)
        return this.getItem(container, indexValue, expression.pos)
      }
      case 'call': {
        const callee = this.evaluate(expression.callee ?? expression, scope)
        const args = (expression.args ?? []).map((argument) =>
          this.evaluate(argument, scope),
        )
        return this.call(callee, args, expression.pos)
      }
      default:
        throw new RuntimeErrorLike(
          'NotImplementedError',
          `Expresion no soportada: ${expression.kind}`,
          expression.pos,
        )
    }
  }

  /**
   * Segmento `objeto[ini:fin]`.
   *
   * Se aplican las reglas de Python: los índices negativos cuentan desde el
   * final, los limites ausentes se recortan y el resultado es una copia.
   */
  private getSlice(
    container: RuntimeValue,
    expression: Expression,
    scope: Scope,
  ): RuntimeValue {
    const items = this.sliceableItems(container, expression.pos)
    const length = items.length

    const start = expression.sliceStart
      ? this.evaluate(expression.sliceStart, scope)
      : null
    const end = expression.sliceEnd ? this.evaluate(expression.sliceEnd, scope) : null

    const normalize = (value: RuntimeValue | null, fallback: number): number => {
      if (value === null) return fallback
      if (value.type !== 'number') {
        throw new PyRuntimeError(
          'TypeError',
          'los índices de segmento deben ser enteros',
          expression.pos,
        )
      }
      const index = Math.trunc(value.value)
      if (index < 0) return Math.max(0, length + index)
      return Math.min(index, length)
    }

    const from = normalize(start, 0)
    const to = normalize(end, length)
    const sliced = to > from ? items.slice(from, to) : []

    if (container.type === 'string') {
      return stringValue(sliced.map((item) => (item.type === 'string' ? item.value : '')).join(''))
    }
    return createList(sliced)
  }

  private sliceableItems(container: RuntimeValue, position: Position): RuntimeValue[] {
    if (container.type === 'list') return container.items
    if (container.type === 'string') {
      return [...container.value].map((char) => stringValue(char))
    }
    throw new PyRuntimeError(
      'TypeError',
      `'${typeName(container)}' object is not subscriptable`,
      position,
    )
  }

  private getItem(
    container: RuntimeValue,
    indexValue: RuntimeValue,
    position: Position,
  ): RuntimeValue {
    if (indexValue.type !== 'number') {
      throw new PyRuntimeError(
        'TypeError',
        `'${typeName(container)}' índices must be integers`,
        position,
      )
    }
    const index = Math.trunc(indexValue.value)
    if (container.type === 'list') {
      const normalized = index < 0 ? container.items.length + index : index
      const item = container.items[normalized]
      if (item === undefined) {
        throw new PyRuntimeError('IndexError', 'list index out of range', position)
      }
      return item
    }
    if (container.type === 'string') {
      const normalized = index < 0 ? container.value.length + index : index
      const char = container.value[normalized]
      if (char === undefined) {
        throw new PyRuntimeError('IndexError', 'string index out of range', position)
      }
      return stringValue(char)
    }
    throw new PyRuntimeError(
      'TypeError',
      `'${typeName(container)}' object is not subscriptable`,
      position,
    )
  }

  private getAttribute(
    object: RuntimeValue,
    name: string,
    position: Position,
  ): RuntimeValue {
    if (object.type === 'list' || object.type === 'string') {
      const method = this.bindMethod(object, name)
      if (method) return method
      throw new PyRuntimeError(
        'AttributeError',
        `'${typeName(object)}' object has no attribute '${name}'`,
        position,
      )
    }
    throw new PyRuntimeError(
      'AttributeError',
      `'${typeName(object)}' object has no attribute '${name}'`,
      position,
    )
  }

  private bindMethod(object: RuntimeValue, name: string): RuntimeValue | null {
    const supported =
      object.type === 'list'
        ? LIST_METHODS.has(name)
        : object.type === 'string'
          ? STRING_METHODS.has(name)
          : false
    if (!supported) return null
    return {
      type: 'method',
      name,
      receiver: object,
      call: (args) => {
        const result =
          object.type === 'list'
            ? callListMethod(object, name, args)
            : callStringMethod(object, name, args)
        if (result === null) {
          throw new PyRuntimeError(
            'AttributeError',
            `'${typeName(object)}' object has no attribute '${name}'`,
          )
        }
        return result
      },
    }
  }

  private call(
    callee: RuntimeValue,
    args: RuntimeValue[],
    position: Position,
  ): RuntimeValue {
    if (callee.type === 'builtin') {
      const context: BuiltinContext = {
        print: (text) => this.write(text),
        position: () => position,
      }
      const result = callee.call(args, context)
      // Un builtin puede mutar una lista (por ejemplo `append`): se marca el
      // estado como sucio para que la instantanea siguiente lo refleje.
      this.scopesDirty = true
      return result
    }
    if (callee.type === 'method') {
      const context: BuiltinContext = {
        print: (text) => this.write(text),
        position: () => position,
      }
      const result = callee.call(args, context)
      this.scopesDirty = true
      return result
    }
    if (callee.type === 'function') {
      return this.callFunction(callee, args, position)
    }
    throw new PyRuntimeError(
      'TypeError',
      `'${typeName(callee)}' object is not callable`,
      position,
    )
  }

  private callFunction(
    fn: Extract<RuntimeValue, { type: 'function' }>,
    args: RuntimeValue[],
    position: Position,
  ): RuntimeValue {
    if (args.length !== fn.params.length) {
      throw new PyRuntimeError(
        'TypeError',
        `${fn.name}() takes ${fn.params.length} positional arguments but ${args.length} were given`,
        position,
      )
    }
    if (this.frames.length >= this.limits.maxCallDepth) {
      throw new LimitError(
        'Se ha superado la profundidad máxima de recursión.',
        position,
      )
    }

    const scope: Scope = {
      id: this.nextScopeId(),
      name: fn.name,
      vars: new Map(),
      parent: fn.closure,
    }
    fn.params.forEach((param, index) => {
      const value = args[index]
      if (value !== undefined) scope.vars.set(param.name, value)
    })

    this.frames.push({ name: fn.name, line: fn.pos.line, locals: scope.vars })
    this.framesDirty = true
    this.recordStep(
      'call',
      position,
      `${fn.name}(${args.map((arg) => repr(arg)).join(', ')})`,
    )

    try {
      this.executeBlock(fn.body, scope)
      return { type: 'null' }
    } catch (error) {
      if (error instanceof ReturnSignal) {
        this.frames.pop()
        this.framesDirty = true
        this.recordStep('return', position, `fin de ${fn.name}`)
        return error.value ?? { type: 'null' }
      }
      this.frames.pop()
      this.framesDirty = true
      throw error
    }
  }

  // -- operadores -----------------------------------------------------------

  private binaryOp(
    op: string,
    left: RuntimeValue,
    right: RuntimeValue,
    position: Position,
  ): RuntimeValue {
    if (op === '+') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value + right.value, isInt: left.isInt && right.isInt }
      }
      if (left.type === 'string' && right.type === 'string') {
        return stringValue(left.value + right.value)
      }
      if (left.type === 'list' && right.type === 'list') {
        if (left.items.length + right.items.length > this.limits.maxListLength) {
          throw new LimitError(
            'Se ha superado el límite de elementos de una lista.',
            position,
          )
        }
        return createList([...left.items, ...right.items])
      }
      throw this.unsupported(op, left, right, position)
    }

    if (op === '-') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value - right.value, isInt: left.isInt && right.isInt }
      }
      throw this.unsupported(op, left, right, position)
    }

    if (op === '*') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value * right.value, isInt: left.isInt && right.isInt }
      }
      if (left.type === 'string' && right.type === 'number') {
        const times = Math.trunc(right.value)
        if (times < 0) {
          throw new PyRuntimeError('ValueError', 'negative count', position)
        }
        return stringValue(left.value.repeat(times))
      }
      if (left.type === 'number' && right.type === 'string') {
        const times = Math.trunc(left.value)
        if (times < 0) {
          throw new PyRuntimeError('ValueError', 'negative count', position)
        }
        return stringValue(right.value.repeat(times))
      }
      if (left.type === 'list' && right.type === 'number') {
        const times = Math.trunc(right.value)
        if (times < 0) {
          throw new PyRuntimeError('ValueError', 'negative count', position)
        }
        if (left.items.length * times > this.limits.maxListLength) {
          throw new LimitError(
            'Se ha superado el límite de elementos de una lista.',
            position,
          )
        }
        const items: RuntimeValue[] = []
        for (let index = 0; index < times; index += 1) items.push(...left.items)
        return createList(items)
      }
      throw this.unsupported(op, left, right, position)
    }

    if (op === '/') {
      if (left.type !== 'number' || right.type !== 'number') {
        throw this.unsupported(op, left, right, position)
      }
      if (right.value === 0) {
        throw new PyRuntimeError('ZeroDivisionError', 'division by zero', position)
      }
      return floatValue(left.value / right.value)
    }

    if (op === '//') {
      if (left.type !== 'number' || right.type !== 'number') {
        throw this.unsupported(op, left, right, position)
      }
      if (right.value === 0) {
        throw new PyRuntimeError('ZeroDivisionError', 'integer division or modulo by zero', position)
      }
      const result = Math.floor(left.value / right.value)
      return { type: 'number', value: result, isInt: left.isInt && right.isInt }
    }

    if (op === '%') {
      if (left.type !== 'number' || right.type !== 'number') {
        throw this.unsupported(op, left, right, position)
      }
      if (right.value === 0) {
        throw new PyRuntimeError('ZeroDivisionError', 'integer division or modulo by zero', position)
      }
      let result = left.value % right.value
      if (result !== 0 && result < 0 !== right.value < 0) result += right.value
      return { type: 'number', value: result, isInt: left.isInt && right.isInt }
    }

    if (op === '**') {
      if (left.type !== 'number' || right.type !== 'number') {
        throw this.unsupported(op, left, right, position)
      }
      if (left.value === 0 && right.value < 0) {
        throw new PyRuntimeError('ZeroDivisionError', '0.0 cannot be raised to a negative power', position)
      }
      const result = left.value ** right.value
      return {
        type: 'number',
        value: result,
        isInt: left.isInt && right.isInt && Number.isInteger(result),
      }
    }

    throw new RuntimeErrorLike(
      'NotImplementedError',
      `Operador no soportado: ${op}`,
      position,
    )
  }

  private unsupported(
    op: string,
    left: RuntimeValue,
    right: RuntimeValue,
    position: Position,
  ): PyRuntimeError {
    return new PyRuntimeError(
      'TypeError',
      `unsupported operand type(s) for ${op}: '${typeName(left)}' and '${typeName(right)}'`,
      position,
    )
  }

  private compareOp(
    op: string,
    left: RuntimeValue,
    right: RuntimeValue,
    position: Position,
  ): RuntimeValue {
    if (op === '==') return boolValue(valuesEqual(left, right))
    if (op === '!=') return boolValue(!valuesEqual(left, right))
    if (op === 'in') return boolValue(contains(right, left))
    if (op === 'not in') return boolValue(!contains(right, left))

    if (left.type === 'number' && right.type === 'number') {
      const result = compareValues(left, right)
      if (op === '<') return boolValue(result < 0)
      if (op === '<=') return boolValue(result <= 0)
      if (op === '>') return boolValue(result > 0)
      if (op === '>=') return boolValue(result >= 0)
    }
    if (left.type === 'string' && right.type === 'string') {
      const result = compareValues(left, right)
      if (op === '<') return boolValue(result < 0)
      if (op === '<=') return boolValue(result <= 0)
      if (op === '>') return boolValue(result > 0)
      if (op === '>=') return boolValue(result >= 0)
    }
    if (left.type === 'list' && right.type === 'list') {
      const result = compareValues(left, right)
      if (op === '<') return boolValue(result < 0)
      if (op === '<=') return boolValue(result <= 0)
      if (op === '>') return boolValue(result > 0)
      if (op === '>=') return boolValue(result >= 0)
    }

    throw new PyRuntimeError(
      'TypeError',
      `'${op}' not supported between instances of '${typeName(left)}' and '${typeName(right)}'`,
      position,
    )
  }
}
