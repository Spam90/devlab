# Despliegue

DevLab está preparado para un despliegue gratuito en **Vercel** (aplicación) + **Supabase**
(datos, autenticación y RLS). El despliegue **no** se ejecuta automáticamente: requiere
autorización explícita del propietario.

## 1. Instalación local completa

```bash
npm install
cp .env.example .env.local     # rellena las claves de Supabase
npm run dev
```

Para tener Supabase en local (Docker):

```bash
npm run supabase:start
npm run supabase:reset
```

La configuración de `supabase/config.toml` deja el proveedor de GitHub preparado: para probarlo en
local hay que exportar las credenciales:

```bash
export SUPABASE_AUTH_GITHUB_CLIENT_ID=...
export SUPABASE_AUTH_GITHUB_CLIENT_SECRET=...
```

## 2. Variables de entorno

### Obligatorias para la persistencia

| Variable | Dónde | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Build y runtime | URL del proyecto. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build y runtime | Clave `anon` (pública). |
| `NEXT_PUBLIC_SITE_URL` | Build y runtime | URL pública de la aplicación. |

### Opcionales

| Variable | Dónde | Descripción |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo runtime | **No se usa en el cliente.** Déjala vacía salvo que añadas una operación que la requiera de forma justificada. |
| `AI_PROVIDER` | Runtime | Identificador del proveedor (informativo). |
| `AI_BASE_URL` | Runtime | Endpoint compatible con la API de OpenAI. |
| `AI_MODEL` | Runtime | Modelo por defecto. |
| `AI_API_KEY` | Runtime | Clave del propietario para el asistente (opcional; si no, cada usuario usa la suya). |
| `NEXT_PUBLIC_PYODIDE_INDEX_URL` | Build | Ruta del runtime Pyodide (`/pyodide/` por defecto). |

`NEXT_PUBLIC_*` se incrusta en el bundle del navegador: nunca pongas un secreto en esas variables.

## 3. Despliegue en Vercel

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel: **Add New → Project → Import** y selecciona el repositorio.
3. Vercel detecta Next.js automáticamente. El build command por defecto es `npm run build` y el
   start command `npm run start`: no hay que cambiarlos.
4. Añade las variables de entorno en **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://TU-DOMINIO.vercel.app`
5. Despliega.
6. En Supabase, actualiza **Authentication → URL Configuration**:
   - *Site URL*: `https://TU-DOMINIO.vercel.app`
   - *Redirect URLs*: `https://TU-DOMINIO.vercel.app/auth/callback` y
     `http://localhost:3000/auth/callback`.

### Notas importantes

- **El runtime de Pyodide** (~10 MB en `public/pyodide/`) se sube con el despliegue como ficheros
  estáticos. No hay llamada a un CDN externo en tiempo de ejecución.
- **El middleware** (`src/middleware.ts`) se ejecuta en el Edge Runtime de Vercel. Las rutas que
  necesitan Node (`/api/ai/explain`, `/api/share/[token]`, `/api/projects/import`) declaran
  `runtime = 'nodejs'`.
- Si Vercel no encuentra el proyecto de Supabase, la aplicación **arranca igual** y muestra el
  aviso de configuración en el lugar de la autenticación.

## 4. Comprobación posterior al despliegue

```bash
curl -s https://TU-DOMINIO.vercel.app/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "devlab",
  "supabase": "configured",
  "pyodide": "served_from_public",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Lista de verificación manual:

- [ ] El laboratorio carga y el programa de ejemplo se ejecuta.
- [ ] El historial avanza y retrocede.
- [ ] El motor Pyodide carga (la primera vez descarga ~10 MB).
- [ ] El selector de idioma cambia toda la interfaz.
- [ ] `/examples` carga un programa en el laboratorio.
- [ ] `/compare` ejecuta las dos implementaciones.
- [ ] El registro por correo funciona (si hay confirmación activada, revisa el correo).
- [ ] El inicio de sesión con GitHub redirige y vuelve correctamente.
- [ ] Un proyecto guardado aparece en `/projects` tras recargar.
- [ ] Un enlace público abre el contenido y se puede revocar.
- [ ] `/api/health` responde `ok`.

## 5. Resolución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| "Falta configurar el servicio de base de datos" | Variables de Supabase ausentes o con valores de ejemplo | Revisa `.env.local` o las variables de Vercel y **vuelve a desplegar** (las `NEXT_PUBLIC_*` se incrustan en el build). |
| El login con GitHub vuelve a la página de error | Callback mal configurado | Añade la URL exacta `https://TU-DOMINIO/auth/callback` en GitHub y en las Redirect URLs de Supabase. |
| Los proyectos no aparecen tras iniciar sesión | Migraciones no aplicadas | Ejecuta `npx supabase db push` y comprueba que RLS está activo. |
| La lista de proyectos está vacía | Sesión no refrescada | Recarga la página; el middleware refresca la cookie en la siguiente petición. |
| Pyodide no carga | Los assets no se desplegaron | Comprueba que `public/pyodide/` existe en el repositorio (lo crea `npm install`; en Vercel se ejecuta durante el build). |
| El asistente de IA devuelve 400 | Endpoint no válido o clave ausente | Revisa `AI_BASE_URL`/`AI_API_KEY` o introduce la clave en Ajustes. |
| El asistente devuelve 429 | Límite de peticiones alcanzado | Espera un minuto. |

## 6. Límites conocidos del plan gratuito

- **Supabase Free**: 500 MB de base de datos, 5 GB de ancho de banda mensual, 50 000 filas por
  tabla, 20 000 filas de *Edge Functions* y proyectos **pausados tras 7 días de inactividad**
  (se reactivan solos al recibir tráfico).
- **Vercel Hobby**: sin dominios personalizados, ancho de banda limitado por periodo, funciones
  serverless con límites de duración y memoria, y un máximo de 12 funciones serverless por
  despliegue.
- Un plan gratuito puede cambiar sus límites ouspender un proyecto en cualquier momento. DevLab
  está diseñado para que la parte principal (laboratorio, ejemplos, comparación) **siga siendo
  utilizable sin Supabase**: sin credenciales, la aplicación funciona en modo invitado.

Consulta la documentación vigente de cada proveedor: los límites cambian con frecuencia.
