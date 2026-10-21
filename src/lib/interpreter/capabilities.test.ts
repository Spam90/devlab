import { describe, expect, it } from 'vitest'
import { ENGINES, engineSupports, featureUnavailableReason } from '@/lib/interpreter/capabilities'
import type { LabFeature } from '@/lib/interpreter/capabilities'
import { runProgram } from '@/lib/interpreter'

const FEATURES: LabFeature[] = [
  'run',
  'pause',
  'restart',
  'stepForward',
  'stepBackward',
  'jumpToStart',
  'jumpToEnd',
  'inspectVariables',
  'inspectCallStack',
  'inspectOutput',
  'cancel',
  'stepMetrics',
  'timingMetrics',
]

describe('matriz de capacidades', () => {
  it('describe los dos motores', () => {
    expect(ENGINES.devlab.name).toBe('DevLab Engine')
    expect(ENGINES.pyodide.name).toContain('Pyodide')
  })

  it('el motor educativo permite stepping y retroceso', () => {
    expect(engineSupports('devlab', 'stepForward')).toBe(true)
    expect(engineSupports('devlab', 'stepBackward')).toBe(true)
    expect(engineSupports('devlab', 'inspectCallStack')).toBe(true)
    expect(engineSupports('devlab', 'stepMetrics')).toBe(true)
  })

  it('Pyodide no ofrece stepping reversible', () => {
    expect(engineSupports('pyodide', 'stepForward')).toBe(false)
    expect(engineSupports('pyodide', 'stepBackward')).toBe(false)
    expect(engineSupports('pyodide', 'inspectCallStack')).toBe(false)
    expect(engineSupports('pyodide', 'stepMetrics')).toBe(false)
  })

  it('Pyodide si ofrece cancelacion y metricas de tiempo', () => {
    expect(engineSupports('pyodide', 'cancel')).toBe(true)
    expect(engineSupports('pyodide', 'timingMetrics')).toBe(true)
  })

  it('explica el motivo de una funcion no disponible', () => {
    expect(featureUnavailableReason('pyodide', 'stepBackward')).toContain('Pyodide')
    expect(featureUnavailableReason('pyodide', 'stepBackward').length).toBeGreaterThan(10)
  })

  it('la matriz coincide con el comportamiento real del interprete', () => {
    // El motor educativo registra pasos y pila de llamadas: la matriz lo dice.
    const result = runProgram('def f():\n    return 1\nf()')
    expect(result.steps.some((step) => step.kind === 'call')).toBe(true)
    expect(result.steps.some((step) => step.frames.length > 0)).toBe(true)
    // Pyodide no se ejecuta aqui, pero la matriz declara que no hay stepping.
    expect(ENGINES.pyodide.stepInspection).toBe(false)
  })

  it('todas las funciones tienen una capacidad asociada', () => {
    for (const feature of FEATURES) {
      expect(typeof engineSupports('devlab', feature)).toBe('boolean')
    }
  })
})
