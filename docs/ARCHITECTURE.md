# Arquitectura

Este documento explica las decisiones técnicas de DevLab: qué se construyó, por qué así y qué
límites tiene.

## 1. Vista general

DevLab es una aplicación Next.js (App Router) con renderizado en el cliente para el laboratorio y
Route Handlers para las operaciones que requieren autoridad de servidor.

```
Navegador                                Servidor (Next.js)                 Servicios
┌────────────────────────────┐           ┌──────────────────────┐          ┌────────────┐
│ Editor (Monaco, diferido)  │           │ /api/auth/callback   │          │ Supabase  │
│ DevLab Engine (TS puro)    │  ───────► │ /api/share/[token]   │ ───────► │ Auth + PG │
│ Pyodide (Web Worker)        │           │ /api/projects/import │          │ (+ RLS)   │
│ Consola / inspectores       │           │ /api/ai/explain      │ ───────► │ Proveedor │
│ Estado local (localStorage) │           │ /api/health          │          │ de IA     │
└────────────────────────────┘           └──────────────────────┘          └────────────┘
```

Regla de oro: **el código del usuario nunca se ejecuta en el servidor**. Ni el intérprete propio
ni Pyodide. El único código arbitrario que se ejecuta es el que el usuario escribe en el
navegador (Pyodide) o el que el intérprete propio modela en TypeScript.

## 2. Núcleo del intérprete educativo

`src/lib/interpreter/`

| Módulo | Responsabilidad |
| --- | --- |
| `tokenizer.ts` | Tokenización con gestión de indentación (INDENT/DEDENT), cadenas, números, comentarios. |
| `parser.ts` | Parser descendente recursivo con climbed de precedencia y soporte de comparaciones encadenadas. |
| `types.ts` | AST, modelo de valores en tiempo de ejecución e instantáneas del historial. |
| `values.ts` | Semántica de valores: `repr`, verdad, igualdad, comparación, conversión a instantánea. |
| `builtins.ts` | Funciones y métodos soportados (`print`, `len`, `range`, `sorted`...). |
| `runtime.ts` | Evaluador, ámbitos, pila de llamadas, límites y registro de pasos. |
| `describe.ts` | Etiquetas legibles de cada paso (`x = 5`, `fib(3)`). |
| `capabilities.ts` | Matriz de capacidades por motor (fuente de verdad de la interfaz). |
| `errors.ts` | Errores con mensajes al estilo de Python. |

### 2.1 Modelo de ejecución

El evaluador es un intérprete de árbol con dos señales de control (`return`, `break`/`continue`)
y un objeto `Scope` por función. El ámbito global es la raíz; las funciones leen de la cadena de
ámbitos y escriben siempre en su ámbito local (regla de Python, con la simplificación de que la
lectura previa a la asignación resuelve al ámbito exterior en lugar de lanzar `UnboundLocalError`).

### 2.2 Historial reversible

El requisito central era poder **retroceder** sin reejecutar el programa y sin que una mutación
posterior alterase un estado ya registrado.

La estrategia elegida es **instantáneas inmutables con copia profunda de lo mutable**:

- Cada paso guarda el estado como datos (`SnapshotValue`), no como referencias vivas.
- Las listas se copian de forma profunda en el momento de la instantánea: mutar una lista después
  no cambia las instantáneas anteriores.
- Los valores inmutables (números, cadenas, funciones) se comparten por referencia: no cuestan
  memoria extra.
- La instantánea se reconstruye **solo cuando el estado mutable ha cambiado** (`scopesDirty`): un
  bucle que no muta no genera copias nuevas.

Consecuencia honesta: la identidad de objeto no se conserva entre instantáneas (`a` y `b` que
apuntan a la misma lista aparecen como dos copias iguales). Como el subconjunto no implementa el
operador `is`, esa diferencia no es observable por el usuario.

Alternativas descartadas:

- *Copias completas del estado en cada instrucción*: prohibidas por el coste de memoria.
- *Reejecución determinista al retroceder*: O(n) por salto y O(n²) al recorrer un historial
  entero; además frágil frente a cualquier efecto accidental.
- *Journal de mutaciones con undo/redo*: más complejo de mantener y con casos delicados cuando
  una lista mutada está referenciada por otra.

### 2.3 Límites

Configurables desde el panel de ajustes del laboratorio:

| Límite | Valor por defecto | Motivo |
| --- | --- | --- |
| Pasos | 20 000 | Historial manejable. |
| Instrucciones | 2 000 000 | Evita bucles infinitos. |
| Profundidad de llamada | 64 | Evita desbordamiento de pila. |
| Longitud de lista | 5 000 | Evita agotar la memoria del navegador. |
| Salida acumulada | 200 000 caracteres | Evita que la consola ahogues el navegador. |
| Tiempo | 5 000 ms | Interfaz siempre responsiva. |
| Longitud del código | 100 000 caracteres | Límite de entrada. |

Si se supera un límite, la ejecución se detiene con `status: 'limit'` y un motivo explícito
(`steps`, `instructions`, `time`, `call-depth`, `output`).

## 3. Adaptador de Pyodide

`src/lib/pyodide/runner.ts` + `public/devlab/pyodide-worker.js`

- **Carga diferida**: el runtime (~10 MB) solo se descarga cuando el usuario elige el motor
  Pyodide. Las demás páginas no lo necesitan.
- **Servido desde el propio dominio**: `npm install` copia el runtime de `node_modules/pyodide` a
  `public/pyodide/`. No hay dependencia de un CDN en tiempo de ejecución.
- **Web Worker**: la ejecución no bloquea la interfaz. El worker es de tipo `module` (Pyodide no
  funciona en workers clásicos).
- **Cancelación**: se termina el worker. Pyodide no ofrece cancelación cooperativa fiable dentro
  de WASM, así que esta es la única estrategia fiable; el worker se recrea en la siguiente
  ejecución.
- **Estado limpio**: antes de cada ejecución se borran las variables globales del usuario para que
  dos ejecuciones consecutivas no se contaminen.
- **Inspección**: al terminar se recogen las variables globales con su tipo y su `repr` (truncado).
  Pyodide **no** ofrece inspección paso a paso y la interfaz lo dice explícitamente.

## 4. Estado del laboratorio

`src/lib/lab/LabProvider.tsx` — un `useReducer` con las acciones de ejecución y navegación.

- Cambiar el código marca el historial como `historyStale`: la interfaz avisa de que el historial
  anterior ya no corresponde al programa nuevo.
- Cambiar de motor reinicia el historial: mezclar capacidades de dos motores sería engañoso.
- `runSnippet(source)` permite ejecutar código arbitrario (lo usa la página de comparación) sin
  tocar el estado del laboratorio.

## 5. Datos

| Ámbito | Almacén | Cuándo |
| --- | --- | --- |
| Invitado | `localStorage` (`devlab.projects.v1`, `devlab.versions.v1`) | Siempre disponible. |
| Sesión | `sessionStorage` (`devlab.locale`, `devlab.ai.session`) | Preferencias de la pestaña. |
| Autenticado | Supabase Postgres | Proyectos, versiones, ajustes, enlaces. |

La importación de proyectos de invitado es **explícita** y no destructiva: los originales solo se
borran cuando la importación ha terminado sin errores.

## 6. Autenticación

- `@supabase/ssr` con cookies `httpOnly` gestionadas por el middleware.
- Correo + contraseña, recuperación de contraseña y GitHub OAuth.
- El callback valida el parámetro `next` para evitar *open redirects*.
- Si Supabase no está configurado, `AuthProvider` expone `configured: false` y la interfaz ofrece
  el modo invitado sin lanzar excepciones.

## 7. Internacionalización

Catálogos propios en `src/lib/i18n/dictionaries/`. El español define el tipo `Dictionary` y el
inglés se escribe contra ese tipo: **si falta una clave, el proyecto no compila**. Además, un test
comprueba que no hay cadenas vacías y que las claves coinciden.

La preferencia se guarda en `localStorage` y, si hay sesión, en `user_settings`.

## 8. IA (opcional)

`src/lib/ai/`

- `provider.ts`: adaptador de la API de chat compatible con OpenAI (`/chat/completions`).
- `validation.ts`: validación del endpoint (anti-SSRF).
- `rateLimit.ts`: límite de peticiones por IP (en memoria, con la limitación documentada de que en
  serverless es por instancia).
- `prompts.ts`: exige separar «hechos observados» de «interpretación».

La clave del usuario viaja en el cuerpo de la petición y se reenvía al proveedor: el servidor no
la almacena ni la registra.

## 9. Decisiones descartadas

- **Ejecutar Python en el servidor** (sandbox, contenedor, API externa): contradice el requisito
  de no ejecutar código arbitrario en el backend y encarece el despliegue gratuito.
- **Base de datos local (IndexedDB, SQLite en WASM)**: no permite sincronización entre dispositivos
  ni el aislamiento por usuario que exige el modelo de producto.
- **Editor propio en lugar de Monaco**: Monaco da autocompletado, plegado y resaltado real; el
  coste se asume con carga diferida y con un `textarea` de reserva si la carga falla.
- **Motor de solo un lenguaje**: la comparación entre motores es justamente lo que da valor al
  laboratorio.
