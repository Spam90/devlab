import { describe, expect, it } from 'vitest'
import { runProgram, validateSyntax } from '@/lib/interpreter'

function outputOf(source: string): string[] {
  const result = runProgram(source)
  return result.output
}

describe('tokenizador y parser', () => {
  it('detecta error de sintaxis', () => {
    const result = runProgram('x = (')
    expect(result.status).toBe('error')
    expect(result.error?.type).toBe('SyntaxError')
  })

  it('detecta indentacion inconsistente', () => {
    const error = validateSyntax('if True:\n    x = 1\n  y = 2')
    expect(error?.type).toBe('SyntaxError')
  })

  it('acepta un programa vacio', () => {
    const result = runProgram('')
    expect(result.status).toBe('completed')
    expect(result.output).toEqual([])
  })
})

describe('expresiones y precedencia', () => {
  it('respeta la precedencia aritmetica', () => {
    expect(outputOf('print(2 + 3 * 4)')).toEqual(['14'])
    expect(outputOf('print((2 + 3) * 4)')).toEqual(['20'])
    expect(outputOf('print(2 ** 3 ** 2)')).toEqual(['512'])
    expect(outputOf('print(-2 ** 2)')).toEqual(['-4'])
    expect(outputOf('print(7 // 2, 7 % 2, 7 / 2)')).toEqual(['3 1 3.5'])
  })

  it('soporta precedencia de comparaciones y logicos', () => {
    expect(outputOf('print(1 + 2 == 3 and 4 > 3)')).toEqual(['True'])
    expect(outputOf('print(not True or False)')).toEqual(['False'])
    expect(outputOf('print(1 < 2 < 3)')).toEqual(['True'])
    expect(outputOf('print(1 < 2 < 1)')).toEqual(['False'])
  })

  it('distingue enteros de flotantes', () => {
    expect(outputOf('print(3 / 2)')).toEqual(['1.5'])
    expect(outputOf('print(4 / 2)')).toEqual(['2.0'])
    expect(outputOf('print(type(1), type(1.0), type("a"), type([1]))')).toEqual([
      "<class 'int'> <class 'float'> <class 'str'> <class 'list'>",
    ])
  })

  it('concatena cadenas y repite con el operador estrella', () => {
    expect(outputOf('print("a" + "b")')).toEqual(['ab'])
    expect(outputOf('print("ab" * 3)')).toEqual(['ababab'])
  })
})

describe('asignaciones y ambitos', () => {
  it('asigna y reasigna variables', () => {
    const result = runProgram('x = 1\nx = x + 1\nprint(x)')
    expect(result.output).toEqual(['2'])
  })

  it('soporta asignacion aumentada', () => {
    const result = runProgram('x = 5\nx += 2\nx *= 3\nprint(x)')
    expect(result.output).toEqual(['21'])
  })

  it('resuelve nombres no definidos', () => {
    const result = runProgram('print(desconocido)')
    expect(result.status).toBe('error')
    expect(result.error?.type).toBe('NameError')
    expect(result.error?.message).toContain("name 'desconocido' is not defined")
  })

  it('mantiene el ambito local de una funcion', () => {
    const result = runProgram(
      'x = 10\ndef prueba():\n    x = 20\n    return x\nprint(prueba())\nprint(x)',
    )
    expect(result.output).toEqual(['20', '10'])
  })

  it('permite leer el ambito exterior desde una funcion', () => {
    const result = runProgram('x = 10\ndef prueba():\n    return x + 1\nprint(prueba())')
    expect(result.output).toEqual(['11'])
  })
})

describe('control de flujo', () => {
  it('ejecuta if / elif / else', () => {
    const source = [
      'x = 5',
      'if x > 10:',
      '    print("grande")',
      'elif x > 3:',
      '    print("medio")',
      'else:',
      '    print("pequeno")',
    ].join('\n')
    expect(outputOf(source)).toEqual(['medio'])
  })

  it('ejecuta while con break y continue', () => {
    const source = [
      'i = 0',
      'while True:',
      '    i += 1',
      '    if i > 5:',
      '        break',
      '    if i % 2 == 0:',
      '        continue',
      '    print(i)',
    ].join('\n')
    expect(outputOf(source)).toEqual(['1', '3', '5'])
  })

  it('recorre listas con for', () => {
    const result = runProgram('for item in [1, 2, 3]:\n    print(item)')
    expect(result.output).toEqual(['1', '2', '3'])
  })

  it('recorre range', () => {
    const result = runProgram('for i in range(3):\n    print(i)')
    expect(result.output).toEqual(['0', '1', '2'])
  })

  it('acepta range con inicio, fin y paso', () => {
    const result = runProgram('for i in range(2, 10, 3):\n    print(i)')
    expect(result.output).toEqual(['2', '5', '8'])
  })
})

describe('funciones', () => {
  it('define y llama funciones con parametros', () => {
    const source = [
      'def sumar(a, b):',
      '    return a + b',
      'print(sumar(2, 3))',
    ].join('\n')
    expect(outputOf(source)).toEqual(['5'])
  })

  it('soporta recursion', () => {
    const source = [
      'def fib(n):',
      '    if n < 2:',
      '        return n',
      '    return fib(n - 1) + fib(n - 2)',
      'print(fib(10))',
    ].join('\n')
    expect(outputOf(source)).toEqual(['55'])
  })

  it('falla si la cantidad de argumentos no coincide', () => {
    const result = runProgram('def f(a):\n    return a\nf(1, 2)')
    expect(result.status).toBe('error')
    expect(result.error?.type).toBe('TypeError')
  })

  it('limita la profundidad de recursion', () => {
    const source = ['def f(n):', '    return f(n + 1)', 'print(f(0))'].join('\n')
    const result = runProgram(source)
    expect(result.status).toBe('limit')
    expect(result.limitReason).toBe('call-depth')
  })
})

describe('listas', () => {
  it('crea, accede y modifica listas', () => {
    const source = [
      'numeros = [1, 2, 3]',
      'numeros[0] = 10',
      'numeros.append(4)',
      'print(numeros)',
      'print(numeros[-1])',
      'print(len(numeros))',
    ].join('\n')
    expect(outputOf(source)).toEqual(['[10, 2, 3, 4]', '4', '4'])
  })

  it('admite metodos de lista', () => {
    const source = [
      'numeros = [3, 1, 2]',
      'numeros.sort()',
      'print(numeros)',
      'numeros.reverse()',
      'print(numeros)',
      'print(numeros.index(2))',
      'print(numeros.pop())',
      'print(numeros)',
    ].join('\n')
    expect(outputOf(source)).toEqual(['[1, 2, 3]', '[3, 2, 1]', '1', '1', '[3, 2]'])
  })

  it('falla con indice fuera de rango', () => {
    const result = runProgram('lista = [1]\nprint(lista[5])')
    expect(result.status).toBe('error')
    expect(result.error?.type).toBe('IndexError')
  })

  it('falla al asignar sobre un tipo incompatible', () => {
    const result = runProgram('x = 1\nx = x + "a"')
    expect(result.status).toBe('error')
    expect(result.error?.type).toBe('TypeError')
  })

  it('falla al dividir entre cero', () => {
    const result = runProgram('print(1 / 0)')
    expect(result.status).toBe('error')
    expect(result.error?.type).toBe('ZeroDivisionError')
  })
})

describe('historial reversible', () => {
  it('registra un paso por sentencia y permite recorrerlo', () => {
    const result = runProgram('a = 1\nb = 2\nprint(a + b)')
    expect(result.steps.length).toBeGreaterThanOrEqual(4)
    expect(result.steps[0]?.kind).toBe('start')
    const last = result.steps[result.steps.length - 1]
    expect(last?.globals.map((entry) => entry.name).sort()).toEqual(['a', 'b'])
  })

  it('conserva el estado de pasos anteriores cuando la lista muta despues', () => {
    const result = runProgram(
      ['numeros = [1, 2]', 'numeros.append(3)', 'print(numeros)'].join('\n'),
    )
    const beforeAppend = result.steps.find(
      (step) => step.kind === 'statement' && step.label.startsWith('numeros.append'),
    )
    expect(beforeAppend).toBeDefined()
    const snapshot = beforeAppend?.globals.find((entry) => entry.name === 'numeros')
    expect(snapshot?.value.type).toBe('list')
    if (snapshot?.value.type === 'list') {
      expect(snapshot.value.items).toHaveLength(3)
    }
  })

  it('el historial de un paso anterior no cambia al mutar una lista', () => {
    const source = ['lista = [1]', 'lista.append(2)', 'lista.append(3)'].join('\n')
    const result = runProgram(source)
    const first = result.steps.find(
      (step) => step.kind === 'statement' && step.label === 'lista = [1]',
    )
    const snapshot = first?.globals.find((entry) => entry.name === 'lista')
    if (snapshot?.value.type === 'list') {
      expect(snapshot.value.items).toHaveLength(1)
    } else {
      throw new Error('No se encontro la variable lista en el historial')
    }
  })

  it('guarda la pila de llamadas durante una llamada', () => {
    const source = ['def f():\n    return 1', 'f()'].join('\n')
    const result = runProgram(source)
    const callStep = result.steps.find((step) => step.kind === 'call')
    expect(callStep).toBeDefined()
    expect(callStep?.frames.length).toBeGreaterThanOrEqual(1)
    expect(callStep?.frames[0]?.name).toBe('f')
  })

  it('es determinista: dos ejecuciones producen el mismo historial', () => {
    const source = ['x = 0', 'for i in range(5):', '    x += i', 'print(x)'].join('\n')
    const a = runProgram(source)
    const b = runProgram(source)
    expect(a.steps.map((step) => step.label)).toEqual(b.steps.map((step) => step.label))
    expect(a.output).toEqual(b.output)
    expect(a.instructions).toBe(b.instructions)
  })

  it('respeta el limite de pasos', () => {
    const result = runProgram('while True:\n    x = 1', { limits: { maxSteps: 50 } })
    expect(result.status).toBe('limit')
  })
})

describe('builtins', () => {
  it('implementa los builtins documentados', () => {
    expect(outputOf('print(len("abc"))')).toEqual(['3'])
    expect(outputOf('print(abs(-3))')).toEqual(['3'])
    expect(outputOf('print(min([3, 1, 2]), max([3, 1, 2]))')).toEqual(['1 3'])
    expect(outputOf('print(sum([1, 2, 3]))')).toEqual(['6'])
    expect(outputOf('print(sorted([3, 1, 2]))')).toEqual(['[1, 2, 3]'])
    expect(outputOf('print(int("42"), float("1.5"), str(12), bool(0))')).toEqual([
      '42 1.5 12 False',
    ])
  })

  it('soporta metodos de cadena', () => {
    expect(outputOf('print("Hola".upper())')).toEqual(['HOLA'])
    expect(outputOf('print("a,b".split(","))')).toEqual(["['a', 'b']"])
    expect(outputOf('print("abc".replace("b", "x"))')).toEqual(['axc'])
  })

  it('falla con un builtin inexistente', () => {
    const result = runProgram('print(input())')
    expect(result.status).toBe('error')
    expect(result.error?.type).toBe('NameError')
  })
})
