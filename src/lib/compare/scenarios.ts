/**
 * Escenarios de comparación de algoritmos.
 *
 * Cada escenario incluye dos implementaciones equivalentes, su análisis de
 * complejidad (que es matematico, no una medición) y las precondiciones
 * que cada una necesita.
 */

export interface CompareScenario {
  id: string
  title: { es: string; en: string }
  summary: { es: string; en: string }
  left: { label: { es: string; en: string }; code: string }
  right: { label: { es: string; en: string }; code: string }
  /** Cuando conviene cada implementación. */
  whenToUse: {
    left: { es: string; en: string }
    right: { es: string; en: string }
  }
  preconditions: { es: string; en: string }
  complexity: {
    left: { es: string; en: string }
    right: { es: string; en: string }
  }
  difference: { es: string; en: string }
  /** Salida esperada de ambas implementaciones. */
  expectedOutput: string
}

export const SCENARIOS: CompareScenario[] = [
  {
    id: 'busqueda',
    title: {
      es: 'Busqueda lineal frente a busqueda binaria',
      en: 'Linear search versus binary search',
    },
    summary: {
      es: 'El mismo objetivo sobre una lista ordenada, resuelto con dos estrategias distintas.',
      en: 'The same target over a sorted list, solved with two different strategies.',
    },
    left: {
      label: { es: 'Busqueda lineal', en: 'Linear search' },
      code: `def buscar(lista, objetivo):
    comparaciones = 0
    for indice in range(len(lista)):
        comparaciones = comparaciones + 1
        if lista[indice] == objetivo:
            print("posicion", indice, "comparaciones", comparaciones)
            return indice
    print("no encontrado, comparaciones", comparaciones)
    return -1

datos = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
buscar(datos, 18)`,
    },
    right: {
      label: { es: 'Busqueda binaria', en: 'Binary search' },
      code: `def buscar(lista, objetivo):
    comparaciones = 0
    izquierda = 0
    derecha = len(lista) - 1
    while izquierda <= derecha:
        comparaciones = comparaciones + 1
        medio = (izquierda + derecha) // 2
        if lista[medio] == objetivo:
            print("posicion", medio, "comparaciones", comparaciones)
            return medio
        if lista[medio] < objetivo:
            izquierda = medio + 1
        else:
            derecha = medio - 1
    print("no encontrado, comparaciones", comparaciones)
    return -1

datos = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
buscar(datos, 18)`,
    },
    whenToUse: {
      left: {
        es: 'Listas pequeñas o sin ordenar, o cuando el coste de ordenar supera al de buscar.',
        en: 'Small or unsorted lists, or when sorting costs more than searching.',
      },
      right: {
        es: 'Listas grandes ya ordenadas, donde el acceso aleatorio es barato.',
        en: 'Large sorted lists where random access is cheap.',
      },
    },
    preconditions: {
      es: 'La busqueda binaria exige que la lista este ordenada de forma creciente.',
      en: 'Binary search requires the list to be sorted in ascending order.',
    },
    complexity: {
      left: { es: 'O(n) tiempo, O(1) memoria', en: 'O(n) time, O(1) space' },
      right: { es: 'O(log n) tiempo, O(1) memoria', en: 'O(log n) time, O(1) space' },
    },
    difference: {
      es: 'La busqueda lineal compara uno a uno; la binaria descarta la mitad de los candidatos en cada paso. Con 10 elementos la diferencia es pequeña, pero con 1.000.000 es enorme.',
      en: 'Linear search compares one by one; binary search discards half of the candidates at each step. With 10 items the difference is small, but with 1,000,000 it is huge.',
    },
    expectedOutput: 'posicion 8 comparaciones 9',
  },
  {
    id: 'ordenamiento',
    title: {
      es: 'Ordenamiento por burbuja frente a merge sort',
      en: 'Bubble sort versus merge sort',
    },
    summary: {
      es: 'Dos formas de ordenar la misma lista: una didactica y otra eficiente.',
      en: 'Two ways to sort the same list: a didactic one and an efficient one.',
    },
    left: {
      label: { es: 'Ordenamiento por burbuja', en: 'Bubble sort' },
      code: `def ordenar(lista):
    for i in range(len(lista)):
        for j in range(len(lista) - 1 - i):
            if lista[j] > lista[j + 1]:
                temporal = lista[j]
                lista[j] = lista[j + 1]
                lista[j + 1] = temporal
    return lista

datos = [9, 4, 7, 1, 8, 2]
print(ordenar(datos))`,
    },
    right: {
      label: { es: 'Merge sort', en: 'Merge sort' },
      code: `def fusionar(izquierda, derecha):
    resultado = []
    while izquierda and derecha:
        if izquierda[0] <= derecha[0]:
            resultado.append(izquierda.pop(0))
        else:
            resultado.append(derecha.pop(0))
    while izquierda:
        resultado.append(izquierda.pop(0))
    while derecha:
        resultado.append(derecha.pop(0))
    return resultado

def ordenar(lista):
    if len(lista) <= 1:
        return lista
    medio = len(lista) // 2
    return fusionar(ordenar(lista[:medio]), ordenar(lista[medio:]))

datos = [9, 4, 7, 1, 8, 2]
print(ordenar(datos))`,
    },
    whenToUse: {
      left: {
        es: 'Enseñanza y listas muy pequenas: es facil de seguir y de verificar.',
        en: 'Teaching and very small lists: easy to follow and to verify.',
      },
      right: {
        es: 'Listas grandes o cuando se necesita un coste garantizado O(n log n).',
        en: 'Large lists or whenever a guaranteed O(n log n) cost is needed.',
      },
    },
    preconditions: {
      es: 'Ninguna de las dos necesita datos previamente ordenados.',
      en: 'Neither implementation requires previously sorted data.',
    },
    complexity: {
      left: { es: 'O(n²) tiempo, O(1) memoria extra', en: 'O(n²) time, O(1) extra space' },
      right: { es: 'O(n log n) tiempo, O(n) memoria extra', en: 'O(n log n) time, O(n) extra space' },
    },
    difference: {
      es: 'La burbuja compara cada par de elementos vecinos, por eso crece al cuadrado. Merge sort divide la lista y la vuelve a unir de forma ordenada.',
      en: 'Bubble sort compares every pair of neighbours, so it grows quadratically. Merge sort splits the list and merges the halves back in order.',
    },
    expectedOutput: '[1, 2, 4, 7, 8, 9]',
  },
  {
    id: 'fibonacci',
    title: {
      es: 'Fibonacci recursivo frente a Fibonacci iterativo',
      en: 'Recursive Fibonacci versus iterative Fibonacci',
    },
    summary: {
      es: 'La misma serie calculada con recursion y con un bucle.',
      en: 'The same sequence computed with recursion and with a loop.',
    },
    left: {
      label: { es: 'Version recursiva', en: 'Recursive version' },
      code: `def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(15))`,
    },
    right: {
      label: { es: 'Version iterativa', en: 'Iterative version' },
      code: `def fibonacci(n):
    anterior = 0
    actual = 1
    for i in range(n):
        siguiente = anterior + actual
        anterior = actual
        actual = siguiente
    return anterior

print(fibonacci(15))`,
    },
    whenToUse: {
      left: {
        es: 'Enseñanza: se ve de inmediato que la recursion repite subproblemas.',
        en: 'Teaching: it shows at once that recursion repeats subproblems.',
      },
      right: {
        es: 'Produccion: evita la pila de llamadas y es mucho mas rapida.',
        en: 'Production: it avoids the call stack and is much faster.',
      },
    },
    preconditions: {
      es: 'Ambas versiones parten de n >= 0.',
      en: 'Both versions assume n >= 0.',
    },
    complexity: {
      left: { es: 'O(2^n) tiempo, O(n) memoria por la pila', en: 'O(2^n) time, O(n) stack space' },
      right: { es: 'O(n) tiempo, O(1) memoria', en: 'O(n) time, O(1) space' },
    },
    difference: {
      es: 'La version recursiva recalcula los mismos valores una y otra vez; la iterativa solo guarda los dos ultimos terminos.',
      en: 'The recursive version recomputes the same values over and over; the iterative one only keeps the last two terms.',
    },
    expectedOutput: '610',
  },
  {
    id: 'factorial',
    title: {
      es: 'Factorial recursivo frente a factorial iterativo',
      en: 'Recursive factorial versus iterative factorial',
    },
    summary: {
      es: 'Un ejemplo didactico de recursion frente a iteracion.',
      en: 'A didactic example of recursion versus iteration.',
    },
    left: {
      label: { es: 'Version recursiva', en: 'Recursive version' },
      code: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(10))`,
    },
    right: {
      label: { es: 'Version iterativa', en: 'Iterative version' },
      code: `def factorial(n):
    resultado = 1
    for i in range(2, n + 1):
        resultado = resultado * i
    return resultado

print(factorial(10))`,
    },
    whenToUse: {
      left: {
        es: 'Enseñanza y problemas que se decomponen de forma natural.',
        en: 'Teaching and problems that decompose naturally.',
      },
      right: {
        es: 'Produccion: la pila de llamadas se evita por completo.',
        en: 'Production: the call stack is avoided entirely.',
      },
    },
    preconditions: {
      es: 'El valor debe ser un entero no negativo.',
      en: 'The value must be a non-negative integer.',
    },
    complexity: {
      left: { es: 'O(n) tiempo, O(n) memoria por la pila', en: 'O(n) time, O(n) stack space' },
      right: { es: 'O(n) tiempo, O(1) memoria', en: 'O(n) time, O(1) space' },
    },
    difference: {
      es: 'El coste en tiempo es el mismo; la diferencia esta en la memoria: la recursion apila un marco por llamada.',
      en: 'The time cost is the same; the difference is memory: recursion stacks one frame per call.',
    },
    expectedOutput: '3628800',
  },
]
