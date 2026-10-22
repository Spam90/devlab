# DevLab

**Laboratorio interactivo de ejecución, depuración y análisis de algoritmos.**

DevLab es una aplicación web para aprender, inspeccionar y comparar algoritmos mediante la
ejecución visual del código. No es un editor de código genérico: es una herramienta de ingeniería
que muestra qué ocurre *dentro* de un programa mientras se ejecuta.

- **Dos motores de ejecución reales**, con capacidades distintas y documentadas:
  - `DevLab Engine`: intérprete propio en TypeScript con historial paso a paso reversible.
  - `Pyodide`: CPython compilado a WebAssembly ejecutándose en el navegador.
- **Inspección del estado**: variables, tipos, ámbitos, pila de llamadas, salida y errores.
- **Comparación de algoritmos** con resultados medidos, no inventados.
- **Cuentas reales** con Supabase (PostgreSQL + Auth + RLS), proyectos, versiones y enlaces
  públicos revocables.
- **Modo invitado** sin registro, con almacenamiento local y migración explícita a la cuenta.
- **Interfaz completa en español e inglés**.
- **Atajos de teclado**: `Ctrl/⌘ + Enter` ejecuta, `F10` avanza un paso, `Shift + F10` retrocede y
  `Ctrl/⌘ + S` guarda el proyecto.

---

## Índice

- [Inicio rápido](#inicio-rápido)
- [Comandos disponibles](#comandos-disponibles)
- [Arquitectura](#arquitectura)
- [Motores de ejecución](#motores-de-ejecución)
- [Supabase](#supabase)
- [IA opcional](#ia-opcional)
- [Despliegue](#despliegue)
- [Pruebas](#pruebas)
- [Documentación](#documentación)

---

## Inicio rápido

```bash
npm install          # instala dependencias y copia el runtime de Pyodide a public/
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

Sin configurar `.env.local` la aplicación **arranca igual** y funciona en modo invitado: el
laboratorio, los ejemplos, la comparación y el almacenamiento local no dependen de Supabase. Lo
único que queda deshabilitado es la autenticación, la sincronización y los enlaces públicos, y la
interfaz lo indica de forma explícita.

Para activar la persistencia:

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia la URL y la clave `publishable` en `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. Aplica las migraciones (ver [docs/SUPABASE.md](docs/SUPABASE.md)):

   ```bash
   # Opción A: pegar supabase/apply-migrations.sql en el SQL Editor del panel
   npm run supabase:bundle

   # Opción B: con un personal access token
   SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase:apply

   # Comprobación
   npm run supabase:check
   ```

## Comandos disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Turbopack). |
| `npm run build` | Build de producción. |
| `npm start` | Servidor de producción (requiere `npm run build`). |
| `npm run lint` | ESLint (configuración de Next + TypeScript). |
| `npm run typecheck` | `tsc --noEmit` en modo estricto. |
| `npm test` | Pruebas unitarias e de integración (Vitest). |
| `npm run test:coverage` | Pruebas con cobertura. |
| `npm run test:e2e` | Pruebas de extremo a extremo (Playwright). |
| `npm run test:e2e:install` | Descarga el navegador de Playwright. |
| `npm run supabase:start` | Supabase local (Docker). |
| `npm run supabase:reset` | Reinicia la base de datos local aplicando migraciones. |
| `npm run supabase:check` | Comprueba la conexión y si el esquema está desplegado (sin imprimir secretos). |
| `npm run supabase:apply` | Aplica las migraciones en remoto (necesita `SUPABASE_ACCESS_TOKEN`). |
| `npm run supabase:bundle` | Regenera `supabase/apply-migrations.sql` para pegar en el SQL Editor. |
| `npm run supabase:verify` | Verificación de extremo a extremo con dos usuarios reales. |

## Arquitectura

```
src/
├── app/                     # Rutas de Next.js (App Router)
│   ├── api/                 # Route Handlers: auth, share, import, IA, health
│   ├── auth/                # Inicio de sesion, registro, recuperacion
│   ├── share/[token]/       # Pagina publica de enlaces compartidos
│   ├── compare/ examples/ projects/ settings/
├── components/
│   ├── ui/                  # Primitivas accesibles (boton, panel, dialogo, toast...)
│   ├── lab/                 # Laboratorio: editor, consola, inspectores, historial
│   ├── layout/ projects/ auth/
├── lib/
│   ├── interpreter/         # Nucleo del interprete educativo de Python
│   │   ├── tokenizer.ts parser.ts runtime.ts values.ts builtins.ts
│   │   ├── types.ts errors.ts describe.ts capabilities.ts
│   ├── pyodide/             # Adaptador del runtime Pyodide (Web Worker)
│   ├── lab/                 # Estado del laboratorio y formato de datos
│   ├── projects/            # Proyectos locales y remotos, versiones, importacion
│   ├── supabase/            # Clientes (navegador/servidor), config, tipos, middleware
│   ├── ai/                  # Adaptador de IA, validacion SSRF, limite de peticiones
│   ├── i18n/                # Catalogos es/en y proveedor de idioma
│   ├── compare/ examples/   # Escenarios de comparacion y biblioteca de ejemplos
├── middleware.ts            # Refresco de sesion de Supabase
supabase/migrations/         # SQL versionado (esquema + RLS)
tests/e2e/                   # Playwright
docs/                        # Documentacion tecnica
```

Detalle completo en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Motores de ejecución

| Capacidad | DevLab Engine | Pyodide |
| --- | --- | --- |
| Subconjunto de Python propio | Sí | — |
| Python completo | — | Sí (CPython 3.14 en WASM) |
| Ejecución paso a paso | Sí | No |
| Retroceder en el historial | Sí | No |
| Pila de llamadas | Sí | No |
| Métricas de pasos instrumentados | Sí | No |
| Métricas de tiempo | No (determinista) | Sí |
| Cancelación | No | Sí (terminate del worker) |
| Se ejecuta en el navegador | Sí | Sí |

El subconjunto admitido, lo rechazado y los límites configurables están en
[docs/CAPABILITIES.md](docs/CAPABILITIES.md).

## Supabase

El esquema (5 tablas), los índices, las políticas RLS y la función pública de resolución de
enlaces están en [`supabase/migrations/`](supabase/migrations/) y explicados en
[docs/SUPABASE.md](docs/SUPABASE.md).

Puntos clave de seguridad:

- Toda política compara `auth.uid()` con el `user_id` de la fila: el identificador que envía el
  navegador nunca es la fuente de verdad.
- Los enlaces públicos no se resuelven con un `SELECT` directo: se usa una función
  `SECURITY DEFINER` que solo devuelve el contenido compartido.
- El token del enlace se guarda **solo como hash SHA-256**: un volcado de la base de datos no
  permite reconstruir las URLs.
- La clave `service_role` no se usa en el navegador ni es necesaria para el funcionamiento normal.

## IA opcional

DevLab funciona por completo sin IA. Si se configura, el asistente explica código, errores y
algoritmos distinguiendo siempre los **hechos observados** de la **interpretación** del modelo.

- Endpoint, modelo y clave son configurables; la clave del usuario vive solo en la memoria de la
  pestaña (`sessionStorage`) y se reenvía directamente al proveedor.
- El endpoint se valida para impedir SSRF (solo `https`, sin direcciones privadas, sin
  credenciales en la URL, sin redirecciones).
- Hay límite de peticiones por IP, límite de tamaño y tiempo de espera.

Ver [docs/SECURITY.md](docs/SECURITY.md).

## Despliegue

El proyecto está preparado para **Vercel** (plan gratuito) + **Supabase** (plan gratuito).
Los pasos exactos, la comprobación posterior y los límites conocidos de cada plan están en
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

No se publica nada de forma automática: el despliegue requiere autorización explícita.

## Pruebas

- **Unitarias e integración** (Vitest): intérprete, i18n, tokens de enlace, validación de IA,
  almacén local, matriz de capacidades.
- **E2E** (Playwright): recorrido de invitado, historial, cambio de idioma, Pyodide, proyectos,
  comparación y vista de móvil.

```bash
npm test
npm run test:e2e
```

## Estado de la implementación

| Área | Estado |
| --- | --- |
| Intérprete educativo, historial reversible, límites | Implementado y probado |
| Pyodide en el navegador (carga diferida, worker, cancelación) | Implementado y probado en navegador real |
| Comparación de algoritmos con métricas medidas | Implementado y probado |
| Supabase: esquema, RLS, función pública, migraciones | **Aplicado y verificado** (17/17 comprobaciones con usuarios reales) |
| Auth por correo | Implementado; el correo exige confirmación (activada en el panel) |
| GitHub OAuth | Implementado; falta activar el proveedor en el panel de Supabase |
| Proyectos, versiones, importación de invitado, enlaces revocables | Implementado y verificado contra la base de datos real |
| IA opcional con protección SSRF | Implementado y probado (la llamada al proveedor requiere una clave) |
| Diseño premium, responsive, accesibilidad | Implementado; validado con Playwright en escritorio y móvil |
| Documentación y preparación de despliegue | Completa |

## Documentación

| Documento | Contenido |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Decisiones técnicas y estructura del sistema. |
| [docs/CAPABILITIES.md](docs/CAPABILITIES.md) | Subconjunto de Python, límites y matriz de motores. |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Esquema, RLS, migraciones y proveedor OAuth. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Instalación local, despliegue y límites del plan gratuito. |
| [docs/SECURITY.md](docs/SECURITY.md) | Revisión de seguridad y amenazas mitigadas. |
| [docs/TESTING.md](docs/TESTING.md) | Qué se prueba, cómo y qué queda sin cobertura. |
