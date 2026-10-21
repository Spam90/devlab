# Capacidades de los motores

Este documento define **exactamente** qué puede hacer cada motor. La interfaz usa esta
información (`src/lib/interpreter/capabilities.ts`) para habilitar o deshabilitar funciones, y las
pruebas verifican que la tabla coincide con el comportamiento real.

## 1. Matriz de capacidades

| Capacidad | DevLab Engine | Pyodide |
| --- | :---: | :---: |
| Subconjunto documentado de Python | Sí | — |
| Python completo | — | Sí (CPython 3.14 en WebAssembly) |
| Ejecución paso a paso | Sí | No |
| Retroceder en el historial | Sí | No |
| Inspeccionar variables | Sí (en cualquier paso) | Sí (solo al final) |
| Pila de llamadas | Sí | No |
| Salida estándar y errores | Sí | Sí |
| Métricas de pasos instrumentados | Sí | No |
| Métricas de tiempo | No (determinista) | Sí |
| Cancelación de la ejecución | No | Sí (termina el worker) |
| Se ejecuta en el navegador | Sí | Sí |
| Requiere red | No | Solo la primera carga del runtime |

**Regla de oro:** cuando un motor no admite una acción, el botón aparece **deshabilitado con una
explicación** (`featureUnavailableReason`). Nunca se ejecuta código en otro motor en silencio.

## 2. Subconjunto de Python del DevLab Engine

### 2.1 Sentencias admitidas

| Sentencia | Notas |
| --- | --- |
| `x = valor` | Asignación simple. |
| `a = b = valor` | Asignación encadenada. |
| `x += 1` (y `-=`, `*=`, `/=`, `//=`, `%=`, `**=`) | Asignación aumentada. |
| `lista[0] = valor` | Asignación por índice. |
| `expresion` | Sentencia de expresión. |
| `if` / `elif` / `else` | Condicionales con indentación. |
| `while` | Bucle condicional. |
| `for x in iterable` | Recorre listas, cadenas y `range()`. |
| `def f(a, b):` | Definición de funciones con parámetros posicionales. |
| `return` | Devuelve un valor (o `None`). |
| `break` / `continue` | Control de bucle. |
| `pass` | Sentencia vacía. |

### 2.2 Expresiones admitidas

- Literales: enteros, flotantes, cadenas (comillas simples, dobles y triples), `True`, `False`,
  `None`.
- Nombres y asignación.
- Listas: `[1, 2, 3]`.
- Aritmética: `+`, `-`, `*`, `/`, `//`, `%`, `**`, y los unarios `+` y `-`.
- Lógica: `and`, `or`, `not`.
- Comparaciones: `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not in` y comparaciones encadenadas
  (`1 < 2 < 3`).
- Indexado: `lista[i]`, `cadena[i]`, índices negativos.
- Segmentos: `lista[ini:fin]`, `lista[:fin]`, `lista[ini:]`, `lista[:]`, con índices negativos.
- Llamadas: `f(x)`, `f()`.
- Atributos: `lista.append(...)`, `cadena.upper()`.
- Condicional: `a if cond else b`.

### 2.3 Funciones incorporadas

`print`, `len`, `range`, `str`, `repr`, `int`, `float`, `bool`, `abs`, `min`, `max`, `sum`,
`sorted`, `list`, `type`, `round`.

`range` se materializa como lista, por lo que `range(10**9)` agota el límite de longitud de lista.

### 2.4 Métodos

- **Lista**: `append`, `extend`, `pop`, `insert`, `remove`, `clear`, `index`, `count`, `reverse`,
  `sort`.
- **Cadena**: `upper`, `lower`, `strip`, `split`, `replace`, `startswith`, `endswith`, `find`,
  `join`.

### 2.5 Lo que **no** se admite

Cada elemento de esta lista produce un error claro (no un comportamiento silencioso):

| Construcción | Error |
| --- | --- |
| `import`, `class`, `try`, `with`, `lambda`, `yield`, `global`, `nonlocal`, `del` | `SyntaxError` con la posición. |
| Diccionarios `{...}`, conjuntos, tuplas literales | `SyntaxError`. |
| Funciones con valores por defecto, `*args`, `**kwargs`, argumentos por palabra clave | `SyntaxError` o `TypeError`. |
| `del`, `global`, `nonlocal` | `SyntaxError`. |
| Comprensiones de listas y generadores | `SyntaxError`. |
| Excepciones (`try/except`) | `SyntaxError`. |
| Multilínea con `\` y entre paréntesis | Solo se admite `\` como continuación de línea. |
| Tabuladores para indentación | `SyntaxError` explícito. |
| slicing con paso (`lista[::2]`) | Se trata como segmento sin paso. |

### 2.6 Diferencias documentadas respecto a CPython

| Caso | DevLab Engine | CPython |
| --- | --- | --- |
| `True == 1` | `False` | `True` |
| Lectura de variable local antes de asignarla | Resuelve al ámbito exterior | `UnboundLocalError` |
| `type(1)` | `"<class 'int'>"` (cadena) | `<class 'int'>` (tipo) |
| `range` | Lista materializada | Objeto perezoso |
| Asignación dentro de una función | Siempre local (sin `global`) | Local, salvo `global` |
| Identidad de objetos (`is`) | No implementado | Implementado |

## 3. Pyodide

Pyodide es CPython compilado a WebAssembly. Ofrece **Python completo**, con las salvedades
propias de un runtime en el navegador:

- No hay acceso a la red ni al sistema de ficheros del host (salvo `pyodide.http` y el sistema de
  ficheros en memoria).
- Los paquetes disponibles son los que Pyodide distribuye (numpy, pandas, scipy, scikit-learn…);
  se pueden instalar más con `micropip` si hay red.
- El consumo de recursos es el del dispositivo: Pyodide **no** es un aislamiento perfecto frente
  a un programa que consuma toda la memoria. Los límites del laboratorio (pasos, tiempo) se aplican
  al motor educativo; en Pyodide la protección real es el cancelación por worker y el cuidado del
  propio usuario.
- **No hay historial paso a paso**: esa capacidad pertenece al intérprete propio. La interfaz lo
  indica y deshabilita los controles correspondientes.

## 4. Comparación de métricas

Las métricas de los dos motores **no son comparables entre sí**:

- El DevLab Engine mide *pasos instrumentados* (statements y llamadas) y no tiempo, porque su
  ejecución es determinista.
- Pyodide mide *tiempo de pared* de la ejecución real y no puede contar pasos del intérprete de
  CPython sin instrumentar el código del usuario.

Cuando la página de comparación muestra resultados, ambos lados se ejecutan **con el mismo
motor**, y así se indica de forma explícita.
