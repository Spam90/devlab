import type { EngineId } from '@/lib/interpreter/capabilities'

export type ExampleCategory = 'basics' | 'control' | 'functions' | 'algorithms' | 'errors'

export interface LabExample {
  id: string
  category: ExampleCategory
  title: { es: string; en: string }
  summary: { es: string; en: string }
  explanation: { es: string; en: string }
  code: string
  expectedOutput: string
  engines: EngineId[]
}

/**
 * Biblioteca de ejemplos editables.
 *
 * Todos los ejemplos funcionan en ambos motores: el motor educativo
 * implementa el subconjunto necesario y Pyodide ejecuta Python real.
 */
export const EXAMPLES: LabExample[] = [
  {
    id: 'variables-y-tipos',
    category: 'basics',
    title: { es: 'Variables y tipos', en: 'Variables and types' },
    summary: {
      es: 'Asigna valores, cambia su tipo y observa el inspector de variables.',
      en: 'Assign values, change their type and watch the variable inspector.',
    },
    explanation: {
      es: 'En Python el nombre de una variable se liga a un objeto. Reasignar `edad` no crea una copia del valor anterior: cambia la ligadura. `type()` devuelve el nombre de la clase del valor.',
      en: 'In Python a variable name is bound to an object. Reassigning `edad` does not copy the previous value: it changes the binding. `type()` returns the class name of the value.',
    },
    code: `nombre = "Ada"
edad = 36
altura = 1.72
es_activa = True
sin_valor = None

print(nombre, edad, altura)
print(type(edad), type(altura), type(es_activa), type(sin_valor))

edad = 37
print("edad ahora:", edad)

total = edad + 1
print("el próximo cumpleaños será", total)`,
    expectedOutput: `Ada 36 1.72
<class 'int'> <class 'float'> <class 'bool'> <class 'NoneType'>
edad ahora: 37
el próximo cumpleaños será 38`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'condicionales',
    category: 'control',
    title: { es: 'Condicionales', en: 'Conditionals' },
    summary: {
      es: 'Decide que camino sigue el programa segun una condicion.',
      en: 'Decide which path the program takes based on a condition.',
    },
    explanation: {
      es: '`if` evalua una expresion y solo ejecuta su bloque si es verdadera. `elif` permite encadenar alternativas y `else` cubre el resto. La indentacion define los bloques.',
      en: '`if` evaluates an expression and only runs its block when it is true. `elif` chains alternatives and `else` covers the rest. Indentation defines the blocks.',
    },
    code: `nota = 7

if nota >= 9:
    print("Sobresaliente")
elif nota >= 7:
    print("Notable")
elif nota >= 5:
    print("Aprobado")
else:
    print("Suspenso")`,
    expectedOutput: 'Notable',
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'bucle-while',
    category: 'control',
    title: { es: 'Bucle while', en: 'While loop' },
    summary: {
      es: 'Repite un bloque mientras se cumpla una condicion.',
      en: 'Repeats a block while a condition holds.',
    },
    explanation: {
      es: 'Un `while` vuelve a evaluar su condicion en cada vuelta. Si la condicion nunca se hace falsa, el bucle no termina: por eso existen los limites de ejecucion de DevLab.',
      en: 'A `while` re-evaluates its condition on every turn. If the condition never becomes false the loop never ends: that is why DevLab enforces execution limits.',
    },
    code: `i = 1
total = 0

while i <= 5:
    total = total + i
    print("vuelta", i, "acumulado", total)
    i = i + 1

print("total final:", total)`,
    expectedOutput: `vuelta 1 acumulado 1
vuelta 2 acumulado 3
vuelta 3 acumulado 6
vuelta 4 acumulado 10
vuelta 5 acumulado 15
total final: 15`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'bucle-for',
    category: 'control',
    title: { es: 'Bucle for', en: 'For loop' },
    summary: {
      es: 'Recorre los elementos de una lista o de un rango.',
      en: 'Walks through the items of a list or a range.',
    },
    explanation: {
      es: '`for` toma un iterable, en este caso una lista creada con `range`, y asigna cada elemento a la variable del bucle. `break` sale del bucle y `continue` salta a la siguiente vuelta.',
      en: '`for` takes an iterable, here a list built with `range`, and assigns each element to the loop variable. `break` exits the loop and `continue` jumps to the next turn.',
    },
    code: `for numero in range(1, 10):
    if numero % 3 == 0:
        continue
    if numero > 7:
        break
    print(numero)`,
    expectedOutput: `1
2
4
5
7`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'funciones',
    category: 'functions',
    title: { es: 'Funciones', en: 'Functions' },
    summary: {
      es: 'Define una función, recibe parámetros y devuelve un resultado.',
      en: 'Define a function, take parameters and return a result.',
    },
    explanation: {
      es: '`def` crea un objeto función en el ámbito donde se define. Los parámetros son variables locales; el `return` devuelve un valor y termina la ejecucion de la funcion.',
      en: '`def` creates a function object in the scope where it is defined. Parameters are local variables; `return` yields a value and ends the function execution.',
    },
    code: `def area_rectangulo(base, altura):
    return base * altura

def describir(base, altura):
    area = area_rectangulo(base, altura)
    if area > 100:
        return "grande"
    return "pequeño"

print(area_rectangulo(4, 5))
print(describir(4, 5))
print(describir(12, 9))`,
    expectedOutput: `20
pequeño
grande`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'recursividad',
    category: 'functions',
    title: { es: 'Recursividad', en: 'Recursion' },
    summary: {
      es: 'Una funcion que se llama a si misma hasta alcanzar un caso base.',
      en: 'A function that calls itself until reaching a base case.',
    },
    explanation: {
      es: 'Cada llamada crea un ámbito local con sus propios parámetros. La recursión termina cuando se cumple el caso base. DevLab limita la profundidad para evitar desbordar la pila.',
      en: 'Each call creates a local scope with its own parameters. The recursion ends when the base case is met. DevLab limits the depth to avoid overflowing the stack.',
    },
    code: `def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

for i in range(10):
    print(i, "->", fibonacci(i))`,
    expectedOutput: `0 -> 0
1 -> 1
2 -> 1
3 -> 2
4 -> 3
5 -> 5
6 -> 8
7 -> 13
8 -> 21
9 -> 34`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'listas',
    category: 'basics',
    title: { es: 'Listas', en: 'Lists' },
    summary: {
      es: 'Crea, modifica y recorre una lista de valores.',
      en: 'Create, modify and walk through a list of values.',
    },
    explanation: {
      es: 'Las listas son mutables: `append` anade al final, `insert` coloca en una posicion y `pop` extrae un elemento. El indice empieza en 0 y los negativos cuentan desde el final.',
      en: 'Lists are mutable: `append` adds at the end, `insert` places at a position and `pop` removes an element. Indexes start at 0 and negatives count from the end.',
    },
    code: `numeros = [10, 20, 30]
numeros.append(40)
numeros.insert(0, 5)

print(numeros)
print("longitud:", len(numeros))
print("primero:", numeros[0], "último:", numeros[-1])

numeros[1] = 99
print(numeros)

suma = 0
for numero in numeros:
    suma = suma + numero
print("suma:", suma)`,
    expectedOutput: `[5, 10, 20, 30, 40]
longitud: 5
primero: 5 último: 40
[5, 99, 20, 30, 40]
suma: 194`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'busqueda-lineal',
    category: 'algorithms',
    title: { es: 'Busqueda lineal', en: 'Linear search' },
    summary: {
      es: 'Recorre la lista elemento a elemento hasta encontrar el objetivo.',
      en: 'Walks the list element by element until it finds the target.',
    },
    explanation: {
      es: 'La busqueda lineal no exige ningun orden previo y funciona con cualquier lista. Su coste es O(n): en el peor caso compara con todos los elementos.',
      en: 'Linear search requires no particular order and works with any list. Its cost is O(n): in the worst case it compares against every element.',
    },
    code: `def buscar_lineal(lista, objetivo):
    for indice in range(len(lista)):
        if lista[indice] == objetivo:
            return indice
    return -1

datos = [4, 8, 15, 16, 23, 42]
print("posicion de 23:", buscar_lineal(datos, 23))
print("posicion de 99:", buscar_lineal(datos, 99))`,
    expectedOutput: `posicion de 23: 4
posicion de 99: -1`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'busqueda-binaria',
    category: 'algorithms',
    title: { es: 'Busqueda binaria', en: 'Binary search' },
    summary: {
      es: 'Divide la lista a la mitad en cada paso: mucho mas rapida, pero exige orden.',
      en: 'Halves the list at each step: much faster, but it requires order.',
    },
    explanation: {
      es: 'La busqueda binaria solo funciona sobre una lista ordenada. En cada paso descarta la mitad de los candidatos, de ahi su coste O(log n).',
      en: 'Binary search only works on a sorted list. Each step discards half of the candidates, which is why its cost is O(log n).',
    },
    code: `def buscar_binaria(lista, objetivo):
    izquierda = 0
    derecha = len(lista) - 1

    while izquierda <= derecha:
        medio = (izquierda + derecha) // 2
        if lista[medio] == objetivo:
            return medio
        if lista[medio] < objetivo:
            izquierda = medio + 1
        else:
            derecha = medio - 1
    return -1

datos = [4, 8, 15, 16, 23, 42]
print("posicion de 23:", buscar_binaria(datos, 23))
print("posicion de 99:", buscar_binaria(datos, 99))`,
    expectedOutput: `posicion de 23: 4
posicion de 99: -1`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'ordenamiento-burbuja',
    category: 'algorithms',
    title: { es: 'Ordenamiento por burbuja', en: 'Bubble sort' },
    summary: {
      es: 'Ordena una lista comparando e intercambiando elementos vecinos.',
      en: 'Sorts a list by comparing and swapping neighbouring elements.',
    },
    explanation: {
      es: 'El ordenamiento por burbuja es didactico, no efficient: su coste es O(n^2). Cada pasada lleva el mayor valor restante hasta su posicion final.',
      en: 'Bubble sort is didactic, not efficient: its cost is O(n^2). Each pass moves the largest remaining value to its final position.',
    },
    code: `def burbuja(lista):
    copia = []
    for elemento in lista:
        copia.append(elemento)

    for i in range(len(copia)):
        for j in range(len(copia) - 1 - i):
            if copia[j] > copia[j + 1]:
                temporal = copia[j]
                copia[j] = copia[j + 1]
                copia[j + 1] = temporal
    return copia

print(burbuja([5, 1, 4, 2, 8]))`,
    expectedOutput: '[1, 2, 4, 5, 8]',
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'fibonacci-iterativo',
    category: 'algorithms',
    title: { es: 'Fibonacci iterativo', en: 'Iterative Fibonacci' },
    summary: {
      es: 'La misma serie de Fibonacci calculada sin recursion.',
      en: 'The same Fibonacci sequence computed without recursion.',
    },
    explanation: {
      es: 'La versión iterativa guarda el último valor y evita la pila de llamadas: usa O(1) memoria frente a O(n) de la version recursiva.',
      en: 'The iterative version keeps the last value and avoids the call stack: it uses O(1) memory against O(n) for the recursive one.',
    },
    code: `def fibonacci_iterativo(n):
    anterior = 0
    actual = 1
    for i in range(n):
        siguiente = anterior + actual
        anterior = actual
        actual = siguiente
    return anterior

for i in range(10):
    print(i, "->", fibonacci_iterativo(i))`,
    expectedOutput: `0 -> 0
1 -> 1
2 -> 1
3 -> 2
4 -> 3
5 -> 5
6 -> 8
7 -> 13
8 -> 21
9 -> 34`,
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'error-nombre',
    category: 'errors',
    title: { es: 'Error: nombre no definido', en: 'Error: undefined name' },
    summary: {
      es: 'Usa una variable que nunca has creado y observa el error.',
      en: 'Use a variable you never created and observe the error.',
    },
    explanation: {
      es: 'Python lanza `NameError` cuando no encuentra un nombre en ninguno de los ambitos visibles. El mensaje indica el nombre exacto que falta.',
      en: 'Python raises `NameError` when it cannot find a name in any visible scope. The message points at the exact missing name.',
    },
    code: `saludo = "Hola"
print(saludo)
print(saludo_mundo)`,
    expectedOutput: "Hola\nNameError: name 'saludo_mundo' is not defined",
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'error-tipo',
    category: 'errors',
    title: { es: 'Error: tipos incompatibles', en: 'Error: incompatible types' },
    summary: {
      es: 'Suma un numero y una cadena y observa el mensaje de TypeError.',
      en: 'Add a number and a string and observe the TypeError message.',
    },
    explanation: {
      es: 'Python es tipado de forma dinamica pero no permisivo: sumar un `int` y un `str` es un `TypeError`. El mensaje indica los tipos concretos.',
      en: 'Python is dynamically typed but not permissive: adding an `int` and a `str` is a `TypeError`. The message states the concrete types.',
    },
    code: `cantidad = 3
precio = 9.5
etiqueta = "USD"

print(cantidad * precio)
print(cantidad + etiqueta)`,
    expectedOutput: '28.5\nTypeError: unsupported operand type(s) for +: \'int\' and \'str\'',
    engines: ['devlab', 'pyodide'],
  },
  {
    id: 'error-indice',
    category: 'errors',
    title: { es: 'Error: indice fuera de rango', en: 'Error: index out of range' },
    summary: {
      es: 'Accede a una posicion que no existe en la lista.',
      en: 'Access a position that does not exist in the list.',
    },
    explanation: {
      es: 'Una lista tiene `len()` elementos, con índices del 0 al `len() - 1`. Acceder fuera de ese rango produce un `IndexError`.',
      en: 'A list has `len()` elements, with indexes from 0 to `len() - 1`. Going outside that range raises an `IndexError`.',
    },
    code: `tareas = ["estudiar", "descansar", "repetir"]
print("primera:", tareas[0])
print("tercera:", tareas[2])
print("cuarta:", tareas[3])`,
    expectedOutput:
      "primera: estudiar\ntercera: repetir\nIndexError: list index out of range",
    engines: ['devlab', 'pyodide'],
  },
]

export function examplesByCategory(): Record<ExampleCategory, LabExample[]> {
  const grouped: Record<ExampleCategory, LabExample[]> = {
    basics: [],
    control: [],
    functions: [],
    algorithms: [],
    errors: [],
  }
  for (const example of EXAMPLES) grouped[example.category].push(example)
  return grouped
}
