# Seguridad

Revisión explícita de los controles implementados en DevLab y de las amenazas que mitigan. Cada
apartado indica dónde está el control en el código.

## 1. Ejecución de código

| Control | Ubicación | Detalle |
| --- | --- | --- |
| El código del usuario no se ejecuta en el servidor | Todo el producto | El DevLab Engine es TypeScript que *modela* Python; Pyodide corre en un Web Worker del navegador. No hay `eval`, `new Function` ni `child_process` con código del usuario. |
| Límites del intérprete | `src/lib/interpreter/runtime.ts` | Pasos, instrucciones, profundidad de llamada, longitud de lista, tamaño de salida, tiempo y longitud del código. |
| Cancelación de Pyodide | `src/lib/pyodide/runner.ts` | Termina el worker; el runtime se recrea limpio. |
| Estado limpio entre ejecuciones | `public/devlab/pyodide-worker.js` | Se borran las variables globales del usuario antes de cada ejecución. |

**Riesgo residual:** Pyodide se ejecuta en el mismo dispositivo del usuario. Un programa que
consuma toda la memoria o bloquee el hilo principal puede degradar la experiencia. No es un
aislamiento perfecto y no se presenta como tal.

## 2. Autenticación y sesiones

| Control | Ubicación | Detalle |
| --- | --- | --- |
| Sesión en cookies `httpOnly` | `src/lib/supabase/server.ts`, `src/middleware.ts` | `@supabase/ssr` gestiona las cookies; el token no es accesible desde JavaScript. |
| Renovación de sesión | `src/middleware.ts` | `getUser()` valida el token contra el servidor en cada petición. |
| Callback protegido | `src/app/api/auth/callback/route.ts` | `next` solo se acepta si es una ruta interna (`/...` y no `//`), evitando *open redirects*. |
| Errores de configuración | `src/lib/supabase/config.ts` | Sin credenciales se muestra un aviso; nunca se simula una sesión. |

## 3. Autorización y aislamiento entre usuarios

| Control | Ubicación | Detalle |
| --- | --- | --- |
| RLS en todas las tablas | `supabase/migrations/20260101000100_rls_policies.sql` | `alter table ... enable row level security` en las cinco tablas. |
| `auth.uid()` como única fuente de verdad | Políticas RLS | El `user_id` enviado por el navegador no se usa para autorizar. |
| Aislamiento horizontal | Políticas de `projects` y `project_versions` | Cambiar un UUID en la petición no da acceso a datos ajenos: la política exige pertenencia. |
| Importación en servidor | `src/app/api/projects/import/route.ts` | El `user_id` se toma de la sesión del servidor, nunca del cuerpo de la petición. |
| Service role | `.env.example` | No se usa en el navegador y DevLab no lo necesita. |

## 4. Enlaces públicos

| Control | Ubicación | Detalle |
| --- | --- | --- |
| Token aleatorio de 256 bits | `src/lib/share/tokens.ts` | 32 bytes de `crypto.getRandomValues`, codificados en base64url. |
| El token no se almacena | `supabase/migrations/20260101000000_init_schema.sql` | Solo se guarda el hash SHA-256 (`token_hash`, `UNIQUE`). |
| Acceso público acotado | Función `resolve_public_share` | Devuelve solo el contenido compartido; sin correos, perfiles ni claves. |
| Sin enumeración | Política sin `SELECT` para `anon` | El rol anónimo no puede listar la tabla; solo consultar por hash mediante la función. |
| Revocación | `revoked_at` | Un enlace revocado deja de resolver inmediatamente. |
| Borrado en cascada | FK `project_id ... ON DELETE CASCADE` | Si se borra el proyecto, el enlace deja de existir. |
| Solo lectura | `src/app/share/[token]/page.tsx` | El contenido se muestra en un editor de solo lectura y "probar en el laboratorio" carga una **copia** en `sessionStorage`. |

## 5. Asistente de IA

| Control | Ubicación | Detalle |
| --- | --- | --- |
| Sin SSRF | `src/lib/ai/validation.ts` | Solo `https` (o `http` local en desarrollo), sin credenciales en la URL, sin hosts de metadatos, sin IPs privadas, y comprobación de las IPs a las que resuelve el dominio. |
| Sin redirecciones | `src/lib/ai/provider.ts` | `redirect: 'error'`. |
| Límite de tiempo | `src/lib/ai/provider.ts` | `AbortController` con 30 s por defecto. |
| Límite de tamaño | `src/lib/ai/provider.ts` | La respuesta se corta a 200 KB; la petición a 64 KB. |
| Límite de frecuencia | `src/lib/ai/rateLimit.ts` | 12 peticiones por minuto y IP. |
| La clave no se persiste | `src/lib/ai/session.ts` | Solo en `sessionStorage`; se reenvía al proveedor y no se registra. |
| No se filtran secretos en errores | `src/lib/ai/provider.ts` | El cuerpo del proveedor nunca se incluye en los mensajes de error. |
| Uso opcional | Todo el producto | Sin IA, DevLab funciona por completo. |

**Limitación conocida:** el limitador de peticiones vive en memoria, por lo que en un entorno
serverless el límite es *por instancia*, no global. Es una protección de abuso, no un control de
autorización.

## 6. Datos y validación

| Control | Ubicación | Detalle |
| --- | --- | --- |
| Validación de entrada | `zod` en `src/app/api/ai/explain/route.ts` y `src/app/api/projects/import/route.ts` | Esquemas con límites de longitud y de número de elementos. |
| Límites en la base de datos | `CHECK` en las migraciones | Longitudes de nombre y código, rangos de límites, valores de enum. |
| Sin datos ficticios | Todo el producto | Los ejemplos son código real y verificado; las métricas de la comparación son medidas. |

## 7. Superficie de ataque de la API

| Ruta | Autenticación | Notas |
| --- | --- | --- |
| `POST /api/ai/explain` | No (público, con límite de frecuencia) | Proxy hacia el proveedor configurado; endpoint validado. |
| `GET /api/share/[token]` | No (público) | Solo resuelve enlaces no revocados. |
| `POST /api/projects/import` | Sí | Usa la sesión del servidor. |
| `GET /api/auth/callback` | No | Solo procesa el código OAuth y valida `next`. |
| `GET /api/health` | No | Devuelve solo estado y si la configuración existe. |

## 8. Cabeceras y CSP

`next.config.ts` añade cabeceras de cacheo y de aislamiento para los assets de Pyodide
(`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) y desactiva la cabecera
`X-Powered-By`. No se ha configurado una CSP estricta porque Monaco y Pyodide necesitan cargar
recursos de forma dinámica; añadirla requiere revisar ambos runtimes.

## 9. Dependencias

```bash
npm audit
```

Revisa el resultado antes de cada despliegue. Las dependencias están fijadas en `package-lock.json`
(instalación con `npm install`), de modo que el despliegue es reproducible.

## 10. Lista de verificación antes de publicar

- [ ] `.env.local` y `.env.production` no están en el repositorio (están en `.gitignore`).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` es la clave `anon`, no la `service_role`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está vacía o no se expone al cliente.
- [ ] Las migraciones están aplicadas en el proyecto de producción.
- [ ] Las Redirect URLs de Supabase y de GitHub apuntan al dominio real.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` pasan.
- [ ] `npm audit` no muestra vulnerabilidades altas sin explicar.
