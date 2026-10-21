/**
 * Tipos del subconjunto de Python soportado por el interprete educativo de DevLab.
 *
 * El interprete NO implementa Python completo: implementa un subconjunto
 * documentado (ver `capabilities.ts` y `docs/CAPABILITIES.md`).
 */

export interface Position {
  /** Línea (1-indexada). */
  line: number
  /** Columna (1-indexada). */
  column: number
  /** Desplazamiento absoluto en el código fuente (0-indexado). */
  offset: number
}

// ---------------------------------------------------------------------------
// Lexico
// ---------------------------------------------------------------------------

export type TokenType =
  | 'number'
  | 'string'
  | 'name'
  | 'keyword'
  | 'operator'
  | 'newline'
  | 'indent'
  | 'dedent'
  | 'eof'

export interface Token {
  type: TokenType
  value: string
  start: Position
  end: Position
  /** Valor literal ya interpretado (números y cadenas). */
  literal?: number | string
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type NodeKind =
  | 'number'
  | 'string'
  | 'boolean'
  | 'none'
  | 'name'
  | 'list'
  | 'unary'
  | 'binary'
  | 'logical'
  | 'compare'
  | 'call'
  | 'attribute'
  | 'index'
  | 'conditional'

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '//'
  | '%'
  | '**'
  | 'in'
  | 'not in'

export type CompareOperator = '==' | '!=' | '<' | '<=' | '>' | '>='

export interface Parameter {
  name: string
  pos: Position
}

export type AssignTarget =
  | { kind: 'name'; id: string; pos: Position }
  | { kind: 'index'; object: Expression; index: Expression; pos: Position }

export interface Expression {
  kind: NodeKind
  pos: Position
  /** Valor literal para number/string/boolean. */
  value?: number | string | boolean
  /** `true` cuando el literal numérico es un float. */
  isFloat?: boolean
  /** Identificador para `name`. */
  id?: string
  /** Operador para unary/binary/logical/compare. */
  op?: string
  left?: Expression
  right?: Expression
  operand?: Expression
  elements?: Expression[]
  callee?: Expression
  args?: Expression[]
  object?: Expression
  index?: Expression
  /** Segmento `objeto[ini:fin]`. */
  sliceStart?: Expression
  sliceEnd?: Expression
  /** `true` cuando la expresion es un segmento y no un índice simple. */
  isSlice?: boolean
  name?: string
  targets?: AssignTarget[]
  target?: AssignTarget
  test?: Expression
  consequent?: Expression
  alternate?: Expression
}

export type Statement =
  | { kind: 'expression'; expr: Expression; pos: Position }
  | { kind: 'assignment'; targets: AssignTarget[]; value: Expression; pos: Position }
  | { kind: 'augmented'; target: AssignTarget; op: string; value: Expression; pos: Position }
  | { kind: 'if'; test: Expression; body: Statement[]; orelse: Statement[]; pos: Position }
  | { kind: 'while'; test: Expression; body: Statement[]; pos: Position }
  | { kind: 'for'; target: AssignTarget; iter: Expression; body: Statement[]; pos: Position }
  | { kind: 'function'; name: string; params: Parameter[]; body: Statement[]; pos: Position }
  | { kind: 'return'; value: Expression | null; pos: Position }
  | { kind: 'break'; pos: Position }
  | { kind: 'continue'; pos: Position }
  | { kind: 'pass'; pos: Position }

export interface Program {
  body: Statement[]
}

// ---------------------------------------------------------------------------
// Valores en tiempo de ejecución
// ---------------------------------------------------------------------------

export interface PyNull {
  type: 'null'
}

export interface PyBool {
  type: 'boolean'
  value: boolean
}

export interface PyNumber {
  type: 'number'
  value: number
  /** `true` cuando el literal era un entero (no un float). */
  isInt: boolean
}

export interface PyString {
  type: 'string'
  value: string
}

export interface PyList {
  type: 'list'
  /** Identificador estable para depuración. */
  id: number
  items: RuntimeValue[]
}

export interface PyFunction {
  type: 'function'
  name: string
  params: Parameter[]
  body: Statement[]
  /** Ámbito donde se definio la función. */
  closure: Scope
  pos: Position
}

export interface PyBuiltin {
  type: 'builtin'
  name: string
  call: (args: RuntimeValue[], ctx: BuiltinContext) => RuntimeValue
}

export interface PyMethod {
  type: 'method'
  name: string
  /** Instancia sobre la que actua el metodo. */
  receiver: RuntimeValue
  call: (args: RuntimeValue[], ctx: BuiltinContext) => RuntimeValue
}

export type RuntimeValue =
  | PyNull
  | PyBool
  | PyNumber
  | PyString
  | PyList
  | PyFunction
  | PyBuiltin
  | PyMethod

export interface Scope {
  id: number
  /** Nombre legible: `global` o el nombre de la función. */
  name: string
  vars: Map<string, RuntimeValue>
  parent: Scope | null
}

export interface CallFrame {
  /** Nombre de la función en ejecución. */
  name: string
  /** Línea actual dentro de la función. */
  line: number
  /** Argumentos y variables locales. */
  locals: Map<string, RuntimeValue>
}

export interface BuiltinContext {
  /** Devuelve el valor de salida por pantalla. */
  print: (text: string) => void
  /** Línea actual (para errores con contexto). */
  position: () => Position
}

// ---------------------------------------------------------------------------
// Instantanea de estado (historial reversible)
// ---------------------------------------------------------------------------

export type SnapshotValue =
  | { type: 'null' }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number; isInt: boolean }
  | { type: 'string'; value: string }
  | { type: 'list'; id: number; items: SnapshotValue[] }
  | { type: 'function'; name: string }
  | { type: 'builtin'; name: string }
  | { type: 'method'; name: string; receiverType: string }

export interface SnapshotFrame {
  name: string
  line: number
  locals: { name: string; value: SnapshotValue }[]
}

export type StepKind = 'start' | 'statement' | 'call' | 'return' | 'exception' | 'output'

export interface StepSnapshot {
  /** Índice global del paso (0-based). */
  index: number
  kind: StepKind
  /** Línea y columna del punto de ejecución. */
  line: number
  column: number
  /** Descripción corta del paso (p. ej. `bucle while`, `llamada a fib`). */
  label: string
  /** Variables del ámbito global en este instante. */
  globals: { name: string; value: SnapshotValue }[]
  /** Pila de llamadas en este instante. */
  frames: SnapshotFrame[]
  /** Número de fragmentos de salida acumulados hasta este paso. */
  outputLength: number
  /** Error lanzado en este paso (si lo hubo). */
  error?: { type: string; message: string; line: number; column: number }
}

export interface RunResult {
  status: 'completed' | 'error' | 'limit'
  steps: StepSnapshot[]
  /** Salida acumulada (stdout). */
  output: string[]
  error?: { type: string; message: string; line: number; column: number }
  /** Número de instrucciones ejecutadas (no de pasos). */
  instructions: number
  /** Motivo del limite, si status === 'limit'. */
  limitReason?: 'steps' | 'instructions' | 'time' | 'call-depth' | 'output'
}
