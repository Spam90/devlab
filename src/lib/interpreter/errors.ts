import type { Position } from './types'

/**
 * Errores del interprete educativo.
 *
 * Los mensajes imitan el estilo de Python para que el alumno relacione el
 * error del laboratorio con el error real del interprete de CPython.
 */
export class InterpreterError extends Error {
  readonly type: string
  readonly position: Position | null

  constructor(type: string, message: string, position: Position | null = null) {
    super(message)
    this.name = 'InterpreterError'
    this.type = type
    this.position = position
  }
}

export class SyntaxErrorLike extends InterpreterError {
  constructor(message: string, position: Position | null = null) {
    super('SyntaxError', message, position)
    this.name = 'SyntaxErrorLike'
  }
}

export class RuntimeErrorLike extends InterpreterError {
  constructor(type: string, message: string, position: Position | null = null) {
    super(type, message, position)
    this.name = 'RuntimeErrorLike'
  }
}

export class LimitError extends InterpreterError {
  constructor(message: string, position: Position | null = null) {
    super('LimitExceeded', message, position)
    this.name = 'LimitError'
  }
}

export function isInterpreterError(error: unknown): error is InterpreterError {
  return error instanceof InterpreterError
}

/**
 * Error lanzado por la semántica del lenguaje (builtins, operadores).
 *
 * `pyType` es el nombre del error tal y como lo veria el alumno en Python
 * (`TypeError`, `ValueError`, `IndexError`, ...).
 */
export class PyRuntimeError extends Error {
  readonly pyType: string
  readonly position: Position | null

  constructor(pyType: string, message: string, position: Position | null = null) {
    super(message)
    this.name = 'PyRuntimeError'
    this.pyType = pyType
    this.position = position
  }
}

/** Normaliza cualquier error inesperado a un error de interprete legible. */
export function toInterpreterError(error: unknown): InterpreterError {
  if (isInterpreterError(error)) return error
  if (error instanceof PyRuntimeError) {
    return new RuntimeErrorLike(error.pyType, error.message, error.position)
  }
  if (error instanceof Error) {
    return new RuntimeErrorLike('RuntimeError', error.message)
  }
  return new RuntimeErrorLike('RuntimeError', String(error))
}
