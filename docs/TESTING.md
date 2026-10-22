# Pruebas

## 1. Comandos

```bash
npm test                # unitarias e integración (Vitest)
npm run test:coverage   # con informe de cobertura
npm run test:e2e        # extremo a extremo (Playwright, requiere build)
npm run lint            # ESLint
npm run typecheck       # TypeScript en modo estricto
```

Los tests E2E arrancan el servidor de producción ellos mismos (`scripts/ensure-build.mjs` genera
la build si falta). Para reiterar:

```bash
npm run build && npm run test:e2e
```

## 2. Pruebas unitarias (Vitest)

### Intérprete — `src/lib/interpreter/interpreter.test.ts`

- Precedencia de operadores (`2 + 3 * 4`, `2 ** 3 ** 2`, `-2 ** 2`, `//`, `%`, `/`).
- Comparaciones encadenadas (`1 < 2 < 3`) y operadores lógicos.
- Enteros frente a flotantes (`3 / 2` → `1.5`, `4 / 2` → `2.0`, `type(1.0)`).
- Asignación, reasignación y asignación aumentada.
- Ambitos: local y global, lectura desde el ámbito exterior.
- Condiciones anidadas, `if`/`elif`/`else`.
- Bucles `while` (con `break` y `continue`) y `for` sobre listas y `range`.
- Funciones: parámetros, retorno, número incorrecto de argumentos, recursión.
- Listas: creación, acceso, índices negativos, mutación, métodos, `IndexError`.
- Errores: `SyntaxError`, `NameError`, `TypeError`, `ZeroDivisionError`.
- Límites: exceeded de pasos y de profundidad de recursión.
- Historial: un paso por sentencia, pila de llamadas, determinismo, aislamiento de estados
  anteriores frente a mutaciones posteriores.

### Segmentos — `src/lib/interpreter/slices.test.ts`

- Segmentos con inicio/fin, abiertos, negativos, sobre cadenas y sobre listas (copia, no alias).

### Capacidades — `src/lib/interpreter/capabilities.test.ts`

- La matriz declara stepping y retroceso solo en el motor educativo.
- Pyodide ofrece cancelación y métricas de tiempo, pero no stepping.
- La matriz coincide con el comportamiento real del intérprete.

### Internacionalización — `src/lib/i18n/i18n.test.ts`

- Los dos catálogos tienen exactamente las mismas claves.
- No hay cadenas vacías.
- Traducción, interpolación de variables y clave de reserva.
- **Todas las claves usadas en el código fuente existen en los catálogos**: el test recorre los
  ficheros del proyecto y falla si hay una llamada al traductor con una clave inexistente (esto
  detecta etiquetas que se degradan al texto de la clave).

### Tokens de enlace — `src/lib/share/tokens.test.ts`

- Formato, aleatoriedad (50 tokens distintos), validación, hash determinista y comparación con el
  token en claro.

### IA — `src/lib/ai/ai.test.ts`

- Rechazo de URLs no seguras (SSRF), clasificación de IPs, construcción del endpoint de chat.
- Límite de peticiones.
- Los prompts exigen separar hechos e interpretación.

### Proyectos locales — `src/lib/projects/local.test.ts`

- Alta, listado, renombrado, duplicado, borrado.
- Importación: solo se borra lo que se marcó como importado.
- Versiones numeradas de forma creciente.
- Tolerancia a datos corruptos.

### Calidad del código — `src/lib/quality.test.ts`

- **Ningún identificador con tildes** en el código de TypeScript ni en las migraciones SQL
  (comprueba el código tras eliminar comentarios y literales). Esta guarda existe porque un
  cambio automático de texto convirtió `sys.version` en `sys.versión` y rompió el runtime de
  Pyodide sin que las pruebas de interfaz lo detectaran.
- Los mensajes de error que imitan a CPython se mantienen en inglés, igual que en Python real.

## 3. Pruebas de extremo a extremo (Playwright)

Ficheros en `tests/e2e/`:

| Fichero | Cobertura |
| --- | --- |
| `lab.spec.ts` | Modo invitado: ejecutar el programa de bienvenida, ver la salida, avanzar y retroceder en el historial, inspeccionar variables, cambiar de idioma, cargar un ejemplo desde la galería y el comportamiento del recorrido inicial. |
| `pyodide.spec.ts` | Cambio de motor, carga diferida del runtime y ejecución de Python real en el navegador. |
| `projects.spec.ts` | Creación de proyectos en modo invitado, apertura en el laboratorio con el proyecto vinculado y filtrado por nombre. |
| `compare.spec.ts` | Ejecución de las dos implementaciones, métricas medidas y análisis de complejidad. |
| `lab.mobile.spec.ts` | Vista de móvil: sin desbordamiento horizontal y con los controles utilizables. |

Proyectos de Playwright:

- `chromium-desktop` (1440×900) para todas las pruebas salvo las de móvil.
- `mobile-chrome` (Pixel 7, 390×844) para `*.mobile.spec.ts`.

Las pruebas fijan el idioma a español mediante `localStorage` para que las aserciones no dependan del
idioma del navegador, y esperan a la hidratación de React antes de interactuar (un clic anterior a
la hidratación se pierde y produce falsos negativos).

## 4. Pruebas de Supabase

El flujo completo de autenticación y RLS necesita credenciales reales. La estrategia adopted es:

1. **Supabase local** (`npm run supabase:start` + `npm run supabase:reset`) para verificar que las
   migraciones se aplican y que las políticas se crean.
2. **Pruebas de aislamiento entre dos usuarios**: crear dos cuentas y comprobar con la sesión de
   cada una que no puede leer, modificar ni enumerar los proyectos de la otra. Es un guion manual
   documentado en la sección siguiente.
3. **Enlaces públicos**: crear un enlace, abrirlo en una ventana anónima, comprobar que el
   contenido es el esperado, revocarlo y comprobar que deja de resolver.

### Guion de verificación manual de RLS

Con dos cuentas (A y B) en sesiones distintas (o una normal y otra en ventana de incógnito):

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | A crea un proyecto | El proyecto aparece en `/projects` de A. |
| 2 | B intenta abrir `/projects` | La lista de B no contiene el proyecto de A. |
| 3 | B llama a la API con el UUID del proyecto de A | 404/RLS: sin datos. |
| 4 | A comparte el proyecto | Se copia el enlace. |
| 5 | Anónimo abre el enlace | Ve el contenido compartido, en solo lectura. |
| 6 | A revoca el enlace | El mismo enlace devuelve «no encontrado». |
| 7 | A borra el proyecto | El enlace deja de resolver (borrado en cascada). |

## 5. Qué no se prueba automáticamente (y por qué)

| Área | Motivo | Cómo se compensa |
| --- | --- | --- |
| Registro/inicio de sesión reales | Requiere credenciales de Supabase y correo de confirmación | Los flujos están implementados y documentados; el guion manual de la tabla anterior los cubre. |
| OAuth de GitHub | Requiere registrar la aplicación en GitHub | Documentado en `docs/SUPABASE.md`; el código del callback y la validación de `next` sí están probados por revisión. |
| Aislamiento RLS entre dos usuarios | Requiere dos sesiones reales | Guion manual documentado y políticas revisadas una a una. |
| Restricciones de cuota de los planes gratuitos | Dependen del proveedor | Límites documentados en `docs/DEPLOYMENT.md`. |
| Comportamiento a 1366 px y 1440 px exactos | El diseño es fluido y validado con las medidas de Playwright | Revisión manual con las herramientas del navegador. |

## 6. Lint y tipos

- ESLint con la configuración de Next (`eslint-config-next`) y reglas adicionales
  (`no-explicit-any` como aviso, sin objetos sueltos de `catch` vacíos).
- TypeScript en modo estricto con `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noUnusedLocals` y `noUnusedParameters`.
- `npm run build` también comprueba los tipos: la build falla si hay un error de TypeScript.
