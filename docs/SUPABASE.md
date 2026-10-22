# Supabase: esquema, RLS y configuración

## 1. Crear el proyecto

> **Estado actual:** el proyecto `ysyvopwmfhgzkucicjrg` ya está creado, con el esquema aplicado y
> verificado. La clave `sb_publishable_` es válida y el correo está habilitado **con confirmación por
> correo activada** (`mailer_autoconfirm: false`): al registrarse, el usuario recibe un correo de
> confirmación, y la interfaz ya lo indica con el aviso «revisa tu correo». El proveedor **de GitHub
> sigue sin configurar** en el panel (`"github": false`): el botón existe en la interfaz, pero el
> inicio de sesión real fallará hasta que añadas el Client ID y el Client Secret.

Para un proyecto nuevo:

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto.
2. Copia en `.env.local` (o en las variables de entorno de Vercel):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   La clave `publishable` es pública por diseño: la seguridad la garantiza Row Level Security.
   **Nunca** publiques la clave `secret` en el navegador; DevLab no la necesita para funcionar.

3. Aplica las migraciones.

## 2. Aplicar las migraciones

> **Estado actual del proyecto `ysyvopwmfhgzkucicjrg`:** esquema **desplegado y verificado**. Las tres
> migraciones están aplicadas y `npm run supabase:verify` da **17/17 comprobaciones correctas**
> contra la base de datos real (dos usuarios con sesiones reales, aislamiento por RLS, enlace
> público y revocación).

Las migraciones aplicadas son:

| Migración | Contenido |
| --- | --- |
| `20260101000000_init_schema.sql` | 5 tablas, índices, `CHECK`, triggers de `updated_at` y de creación de perfil/ajustes. |
| `20260101000100_rls_policies.sql` | RLS en las 5 tablas, 19 políticas y las funciones `resolve_public_share` / `touch_public_share`. |
| `20260101000200_user_id_defaults.sql` | `default auth.uid()` en las columnas `user_id`, para que el motor asigne el propietario y el cliente no pueda equivocarse. |

### Reaplicar migraciones

### Opción A — SQL Editor (sin tokens)

1. Genera el fichero combinado si hace falta: `npm run supabase:bundle`.
2. Abre el panel de Supabase → **SQL Editor → New query**.
3. Pega el contenido de `supabase/apply-migrations.sql` y pulsa **Run**.
4. Comprueba con `npm run supabase:check`: las cinco tablas y la RPC deben decir `ok`.

### Opción B — Management API (un comando)

Necesitas un *personal access token* de Supabase (**Account → Access Tokens**):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase:apply
```

El script aplica los ficheros de `supabase/migrations/` en orden a través de
`POST /v1/projects/{ref}/database/query`.

### Opción C — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref ysyvopwmfhgzkucicjrg
npx supabase db push
```

### Opción D — Supabase local

```bash
npm run supabase:start     # requiere Docker
npm run supabase:reset     # aplica migraciones y reinicia la base de datos
```

La configuración local está en `supabase/config.toml`.

### Comprobaciones

```bash
npm run supabase:check     # estado del esquema (no imprime secretos)
npm run supabase:verify    # verificación de extremo a extremo con usuarios reales
```

`supabase:check` informa del estado de la conexión, de cada tabla y de la función pública.
`supabase:verify` crea dos usuarios temporales y comprueba, con sesiones reales:

- Cada usuario ve sus propios proyectos y **no** los del otro (aislamiento horizontal).
- Un segundo usuario no puede leer, modificar ni borrar datos ajenos ni por identificador.
- Un enlace público se resuelve sin sesión y expone solo el contenido compartido.
- Al revocar el enlace, deja de resolverse.
- Los triggers crean el perfil y los ajustes de cada usuario.

Los usuarios de prueba se eliminan al terminar.

## 3. Esquema

### `profiles`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` | PK, referencia a `auth.users(id)` con `ON DELETE CASCADE`. |
| `display_name` | `text` | Nombre público opcional. |
| `avatar_url` | `text` | — |
| `created_at` / `updated_at` | `timestamptz` | Actualizado por trigger. |

Se crea automáticamente mediante el trigger `on_auth_user_created`.

### `user_settings`

Preferencias de la interfaz y límites de ejecución: `locale` (`es`/`en`), `default_engine`,
`theme`, `max_steps`, `max_instructions`, `max_call_depth`, `max_output_bytes`, `timeout_ms`.
Todas las columnas tienen `CHECK` con rangos válidos.

### `projects`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()`. |
| `user_id` | `uuid` | FK a `auth.users`, `ON DELETE CASCADE`. |
| `name` | `text` | `CHECK` entre 1 y 120 caracteres. |
| `description` | `text` | Máximo 500 caracteres. |
| `code` | `text` | Máximo 100 000 caracteres. |
| `engine` | `text` | `CHECK` en `('devlab','pyodide')`. |
| `created_at` / `updated_at` | `timestamptz` | — |

Índice: `projects_user_id_updated_idx (user_id, updated_at desc)`.

### `project_versions`

Historial del código: `project_id` (FK con `ON DELETE CASCADE`), `user_id`, `version_number`
(único por proyecto), `code`, `label` y `created_at`.

Índice: `project_versions_project_idx (project_id, version_number desc)`.

### `public_shares`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` | PK interno; **no** es el secreto de acceso. |
| `project_id` | `uuid` | FK con `ON DELETE CASCADE` (si se borra el proyecto, se cae el enlace). |
| `user_id` | `uuid` | FK a `auth.users`. |
| `version_id` | `uuid` | Referencia opcional a la versión compartida. |
| `token_hash` | `text` | **Hash SHA-256** del token, `UNIQUE`. El token nunca se guarda. |
| `code` | `text` | Copia del contenido compartido en el momento de crearlo. |
| `include_code` | `boolean` | Si es `false`, el enlace solo expone metadatos. |
| `revoked_at` | `timestamptz` | `NULL` = activo. |
| `created_at`, `last_accessed_at` | `timestamptz` | — |

Índices: `public_shares_user_id_idx` y `public_shares_token_hash_idx`.

## 4. Row Level Security

RLS está activado en **todas** las tablas. Resumen de políticas:

| Tabla | `SELECT` | `INSERT` | `UPDATE` | `DELETE` |
| --- | --- | --- | --- | --- |
| `profiles` | Propia | Propia | Propia | Propia |
| `user_settings` | Propia | Propia | Propia | Propia |
| `projects` | Propia | Propia | Propia | Propia |
| `project_versions` | Propia o de un proyecto propio | Propia + proyecto propio | — | Propia |
| `public_shares` | Propia | Propia | Propia | Propia |

Todas las políticas comparan `(select auth.uid())` con la columna `user_id` de la fila. El
`user_id` enviado por el navegador **nunca** se usa para autorizar: cambiar un identificador en una
petición no da acceso a los datos de otro usuario, porque la política sigue exigiendo que la fila
pertenezca al usuario de la sesión.

### Acceso público a los enlaces

No existe una política `SELECT` para el rol `anon` sobre `public_shares`. El acceso público se
resuelve con dos funciones `SECURITY DEFINER`:

```sql
select * from public.resolve_public_share('<hash del token>');
select public.touch_public_share('<hash del token>');
```

`resolve_public_share` devuelve **solo**: `id`, nombre del proyecto, el código (vacío si
`include_code` es `false`), `include_code` y `created_at`. No devuelve correos, perfiles, claves,
ni otros proyectos. Si el enlace está revocado o el proyecto ya no existe, no devuelve filas.

Ambas funciones tienen `REVOKE ALL ... FROM public` y `GRANT EXECUTE TO anon, authenticated`.

## 5. Proveedores de autenticación

### Correo y contraseña

Activos por defecto. En **Authentication → Providers → Email**:

- Activa *Confirm email* si quieres verificación por correo. Si lo activas, el enlace de
  confirmación apunta a:

  ```
  {NEXT_PUBLIC_SITE_URL}/auth/callback?token_hash=...&type=email
  ```

  La ruta `/auth/callback` verifica el token y, en el caso de recuperación, redirige a
  `/auth/update-password`.

- Sitio permitido: `NEXT_PUBLIC_SITE_URL`.

### GitHub (OAuth)

1. En GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - *Homepage URL*: `https://TU-APLICACION.vercel.app`
   - *Authorization callback URL*: `https://TU-APLICACION.vercel.app/auth/callback`
2. En Supabase: **Authentication → Providers → GitHub**, activa el proveedor y pega el
   *Client ID* y el *Client Secret*.
3. En Supabase: **Authentication → URL Configuration → Redirect URLs**, añade:
   - `http://localhost:3000/auth/callback`
   - `https://TU-APLICACION.vercel.app/auth/callback`

Sin estas credenciales, el botón de GitHub existe y funciona en cuanto se configura, pero el inicio
de sesión real no puede verificarse.

## 6. Límites del plan gratuito

- **Supabase Free**: 500 MB de base de datos, 5 GB de ancho de banda, 50 000 filas por tabla y
  proyectos que se pausan tras una semana de inactividad. Los proyectos pausados se reactivan al
  recibir tráfico.
- **Vercel Hobby**: despliegues con ancho de banda limitado, funciones serverless con un límite
  de duración y CPU. El proxy de IA y las rutas de importación caben de sobra en esos límites.
- Ninguno de los dos servicios garantiza disponibilidad permanente: un proyecto gratuito puede
  ser pausado o limitado en cualquier momento.

Los límites concretos vigentes deben consultarse en la documentación de cada proveedor: cambian con
frecuencia.
