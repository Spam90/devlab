import { describe, expect, it } from 'vitest'
import { runProgram } from '@/lib/interpreter'

describe('segmentos de listas y cadenas', () => {
  it('extrae segmentos con inicio y fin', () => {
    expect(runProgram('lista = [0, 1, 2, 3, 4]\nprint(lista[1:3])').output).toEqual(['[1, 2]'])
  })

  it('admite segmentos abiertos', () => {
    expect(runProgram('lista = [0, 1, 2, 3]\nprint(lista[:2])').output).toEqual(['[0, 1]'])
    expect(runProgram('lista = [0, 1, 2, 3]\nprint(lista[2:])').output).toEqual(['[2, 3]'])
    expect(runProgram('lista = [0, 1, 2, 3]\nprint(lista[:])').output).toEqual([
      '[0, 1, 2, 3]',
    ])
  })

  it('admite indices negativos', () => {
    expect(runProgram('lista = [0, 1, 2, 3]\nprint(lista[-2:])').output).toEqual(['[2, 3]'])
  })

  it('funciona con cadenas', () => {
    expect(runProgram('print("abcdef"[1:4])').output).toEqual(['bcd'])
  })

  it('devuelve una copia, no la lista original', () => {
    const result = runProgram(
      ['lista = [1, 2, 3]', 'copia = lista[:]', 'copia.append(4)', 'print(lista)'].join('\n'),
    )
    expect(result.output).toEqual(['[1, 2, 3]'])
  })

  it('permite construir una implementacion de merge sort', () => {
    const source = [
      'def fusionar(izquierda, derecha):',
      '    resultado = []',
      '    while izquierda and derecha:',
      '        if izquierda[0] <= derecha[0]:',
      '            resultado.append(izquierda.pop(0))',
      '        else:',
      '            resultado.append(derecha.pop(0))',
      '    while izquierda:',
      '        resultado.append(izquierda.pop(0))',
      '    while derecha:',
      '        resultado.append(derecha.pop(0))',
      '    return resultado',
      '',
      'def mezcla(lista):',
      '    if len(lista) <= 1:',
      '        return lista',
      '    medio = len(lista) // 2',
      '    return fusionar(mezcla(lista[:medio]), mezcla(lista[medio:]))',
      '',
      'print(mezcla([5, 2, 9, 1, 7]))',
    ].join('\n')
    const result = runProgram(source)
    expect(result.status).toBe('completed')
    expect(result.output).toEqual(['[1, 2, 5, 7, 9]'])
  })
})
