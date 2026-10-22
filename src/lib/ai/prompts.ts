import type { AiMessage } from './provider'

/**
 * Construcción de los prompts del asistente.
 *
 * El prompt exige explicitar la separación entre hechos observados
 * (salida real, error real) e interpretación del modelo, para que una
 * explicación generada nunca se confunda con el resultado de la ejecución.
 */

export type AiTask =
  | 'explain-code'
  | 'explain-error'
  | 'summarize-algorithm'
  | 'suggest-improvements'
  | 'compare-implementations'

export interface ExplanationInput {
  task: AiTask
  locale: 'es' | 'en'
  code: string
  facts?: string
  question?: string
  extra?: string
}

const TASK_INSTRUCTIONS: Record<AiTask, { es: string; en: string }> = {
  'explain-code': {
    es: 'Explica que hace este código Python, paso a paso y con claridad para alguien que está aprendiendo.',
    en: 'Explain what this Python code does, step by step, clearly for someone learning.',
  },
  'explain-error': {
    es: 'Explica la causa de este error de Python y como corregirlo.',
    en: 'Explain the cause of this Python error and how to fix it.',
  },
  'summarize-algorithm': {
    es: 'Resume el algoritmo, su precondiciones y su complejidad.',
    en: 'Summarise the algorithm, its preconditions and its complexity.',
  },
  'suggest-improvements': {
    es: 'Sugiere mejoras concretas y explica su impacto.',
    en: 'Suggest concrete improvements and explain their impact.',
  },
  'compare-implementations': {
    es: 'Compara las dos implementaciones y explica cuando conviene cada una.',
    en: 'Compare the two implementations and explain when each one is preferable.',
  },
}

export function buildExplanationMessages(input: ExplanationInput): AiMessage[] {
  const language = input.locale === 'es' ? 'espanol' : 'English'
  const task = TASK_INSTRUCTIONS[input.task]

  const system = [
    `Responde siempre en ${language}.`,
    task[input.locale],
    'Estructura la respuesta en dos apartados: "Hechos observados" y "Interpretacion".',
    'En "Hechos observados" solo puedes afirmar lo que aparece en el código, en la salida real o en los datos de ejecucion proporcionados.',
    'No inventes resultados de ejecucion, valores, medidas ni conclusiones que no esten justificados.',
    'Si careces de informacion, dilo explicitamente en lugar de suponerla.',
    'Sé conciso: como máximo 250 palabras.',
  ].join(' ')

  const userParts: string[] = []
  userParts.push('Codigo:')
  userParts.push('```python')
  userParts.push(input.code)
  userParts.push('```')

  if (input.facts && input.facts.trim().length > 0) {
    userParts.push('Datos reales de la ejecucion (no los modifiques):')
    userParts.push(input.facts.trim())
  }

  if (input.extra && input.extra.trim().length > 0) {
    userParts.push('Contexto adicional:')
    userParts.push(input.extra.trim())
  }

  if (input.question && input.question.trim().length > 0) {
    userParts.push(`Pregunta: ${input.question.trim()}`)
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: userParts.join('\n\n') },
  ]
}
