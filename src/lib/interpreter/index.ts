import { parse } from './parser'
import { Interpreter, DEFAULT_LIMITS } from './runtime'
import type { InterpreterLimits } from './runtime'
import { toInterpreterError } from './errors'
import type { RunResult, StepSnapshot } from './types'

export { DEFAULT_LIMITS }
export type { InterpreterLimits }
export { Interpreter } from './runtime'
export { parse } from './parser'
export { tokenize } from './tokenizer'
export type * from './types'

export interface RunOptions {
  limits?: Partial<InterpreterLimits>
}

/**
 * Ejecuta un programa Python en el subconjunto soportado.
 *
 * Nunca lanza excepciones: los errores de sintaxis y de ejecución se
 * devuelven dentro del `RunResult` para que la interfaz pueda mostrarlos.
 */
export function runProgram(source: string, options: RunOptions = {}): RunResult {
  if (source.length > (options.limits?.maxSourceLength ?? DEFAULT_LIMITS.maxSourceLength)) {
    return errorResult(
      'SyntaxError',
      `El código fuente supera el limite de ${options.limits?.maxSourceLength ?? DEFAULT_LIMITS.maxSourceLength} caracteres.`,
      1,
      1,
    )
  }

  let program
  try {
    program = parse(source)
  } catch (error) {
    const interpreterError = toInterpreterError(error)
    return errorResult(
      interpreterError.type,
      interpreterError.message,
      interpreterError.position?.line ?? 1,
      interpreterError.position?.column ?? 1,
    )
  }

  const interpreter = new Interpreter(program, options.limits)
  return interpreter.run()
}

function errorResult(
  type: string,
  message: string,
  line: number,
  column: number,
): RunResult {
  const error = { type, message, line, column }
  const steps: StepSnapshot[] = [
    {
      index: 0,
      kind: 'exception',
      line,
      column,
      label: message,
      globals: [],
      frames: [],
      outputLength: 0,
      error,
    },
  ]
  return {
    status: 'error',
    steps,
    output: [],
    error,
    instructions: 0,
  }
}

/**
 * Comprueba la sintaxis sin ejecutar el programa.
 *
 * Devuelve `null` si el código es valido, o el error de sintaxis detectado.
 */
export function validateSyntax(source: string): {
  type: string
  message: string
  line: number
  column: number
} | null {
  try {
    parse(source)
    return null
  } catch (error) {
    const interpreterError = toInterpreterError(error)
    return {
      type: interpreterError.type,
      message: interpreterError.message,
      line: interpreterError.position?.line ?? 1,
      column: interpreterError.position?.column ?? 1,
    }
  }
}
