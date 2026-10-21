import type { Expression, Position, Statement } from './types'

/**
 * Renderizado compacto de expresiones y sentencias.
 *
 * Se usa para etiquetar los pasos del historial (`x = 5`, `fib(3)`) sin
 * depender del texto original, de modo que el historial sigue siendo útil
 * aunque el código se haya reeditado.
 */
export function renderExpression(expression: Expression): string {
  switch (expression.kind) {
    case 'number':
      return String(expression.value)
    case 'string':
      return `'${String(expression.value)}'`
    case 'boolean':
      return expression.value ? 'True' : 'False'
    case 'none':
      return 'None'
    case 'name':
      return expression.id ?? '?'
    case 'list':
      return `[${(expression.elements ?? []).map(renderExpression).join(', ')}]`
    case 'unary': {
      const operand = expression.operand ? renderExpression(expression.operand) : '?'
      if (expression.op === 'not') return `not ${operand}`
      return `${expression.op ?? ''}${operand}`
    }
    case 'binary':
      return `${renderExpression(expression.left ?? expression)} ${expression.op ?? ''} ${renderExpression(expression.right ?? expression)}`
    case 'logical':
      return `${renderExpression(expression.left ?? expression)} ${expression.op ?? ''} ${renderExpression(expression.right ?? expression)}`
    case 'compare':
      return `${renderExpression(expression.left ?? expression)} ${expression.op ?? ''} ${renderExpression(expression.right ?? expression)}`
    case 'call': {
      const callee = expression.callee ? renderExpression(expression.callee) : '?'
      const args = (expression.args ?? []).map(renderExpression).join(', ')
      return `${callee}(${args})`
    }
    case 'attribute':
      return `${expression.object ? renderExpression(expression.object) : '?'}.${expression.name ?? ''}`
    case 'index':
      return `${expression.object ? renderExpression(expression.object) : '?'}[${expression.index ? renderExpression(expression.index) : '?'}]`
    case 'conditional':
      return `${expression.consequent ? renderExpression(expression.consequent) : '?'} if ${expression.test ? renderExpression(expression.test) : '?'} else ${expression.alternate ? renderExpression(expression.alternate) : '?'}`
    default:
      return '<expresion>'
  }
}

/** Etiqueta corta y legible para un paso del historial. */
export function describeStatement(statement: Statement): string {
  switch (statement.kind) {
    case 'expression':
      return renderExpression(statement.expr)
    case 'assignment': {
      const targets = statement.targets
        .map((target) => (target.kind === 'name' ? (target.id ?? '?') : renderTarget(target)))
        .join(', ')
      return `${targets} = ${renderExpression(statement.value)}`
    }
    case 'augmented':
      return `${renderTarget(statement.target)} ${statement.op}= ${renderExpression(statement.value)}`
    case 'if':
      return `if ${renderExpression(statement.test)}`
    case 'while':
      return `while ${renderExpression(statement.test)}`
    case 'for':
      return `for ${renderTarget(statement.target)} in ${renderExpression(statement.iter)}`
    case 'function':
      return `def ${statement.name}(${statement.params.map((param) => param.name).join(', ')})`
    case 'return':
      return statement.value ? `return ${renderExpression(statement.value)}` : 'return'
    case 'break':
      return 'break'
    case 'continue':
      return 'continue'
    case 'pass':
      return 'pass'
    default:
      return '<sentencia>'
  }
}

function renderTarget(target: { kind: string; id?: string; object?: Expression; index?: Expression }): string {
  if (target.kind === 'name') return target.id ?? '?'
  const object = target.object ? renderExpression(target.object) : '?'
  const index = target.index ? renderExpression(target.index) : '?'
  return `${object}[${index}]`
}

export function positionLabel(position: Position): string {
  return `L${position.line}:C${position.column}`
}
