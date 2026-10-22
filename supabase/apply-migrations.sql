-- =============================================================================
-- DevLab · Migraciones aplicables desde el SQL Editor de Supabase
-- -----------------------------------------------------------------------------
-- Este fichero es la concatenacion de los ficheros de
-- `supabase/migrations/`, en el orden correcto. Se puede pegar entero en
-- Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Alternativa automática (con personal access token):
--   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs
--
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- =============================================================================

-- >>> supabase/migrations/20260101000000_init_schema.sql <<<
-- =============================================================================
-- DevLab · Esquema inicial
-- -----------------------------------------------------------------------------
-- Migracion reproducible para una instalación limpia de Supabase.
-- Ejecutar con:  supabase db push   (o pegando el contenido en el SQL Editor)
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- profiles: perfil ligado a auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público mínimo asociado a cada usuario.';

-- -----------------------------------------------------------------------------
-- user_settings: preferencias de idioma, motor y limites
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  locale            text        not null default 'es' check (locale in ('es', 'en')),
  default_engine    text        not null default 'devlab' check (default_engine in ('devlab', 'pyodide')),
  theme             text        not null default 'dark' check (theme in ('dark')),
  max_steps         integer     not null default 20000  check (max_steps between 100 and 200000),
  max_instructions  integer     not null default 2000000 check (max_instructions between 1000 and 20000000),
  max_call_depth    integer     not null default 64     check (max_call_depth between 1 and 512),
  max_output_bytes  integer     not null default 200000 check (max_output_bytes between 1000 and 5000000),
  timeout_ms        integer     not null default 5000   check (timeout_ms between 500 and 60000),
  updated_at        timestamptz not null default now()
);

comment on table public.user_settings is 'Preferencias de la interfaz y límites de ejecución.';

-- -----------------------------------------------------------------------------
-- projects: programas guardados por el usuario
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null check (char_length(name) between 1 and 120),
  description text        check (char_length(description) <= 500),
  code        text        not null default '' check (char_length(code) <= 100000),
  engine      text        not null default 'devlab' check (engine in ('devlab', 'pyodide')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.projects is 'Programas guardados por el propietario.';

create index if not exists projects_user_id_updated_idx
  on public.projects (user_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- project_versions: historial de versiones del código
-- -----------------------------------------------------------------------------
create table if not exists public.project_versions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid        not null references public.projects (id) on delete cascade,
  user_id        uuid        not null references auth.users (id) on delete cascade,
  version_number integer     not null check (version_number > 0),
  code           text        not null check (char_length(code) <= 100000),
  label          text        check (char_length(label) <= 120),
  created_at     timestamptz not null default now(),
  unique (project_id, version_number)
);

comment on table public.project_versions is 'Versiones guardadas del código de un proyecto.';

create index if not exists project_versions_project_idx
  on public.project_versions (project_id, version_number desc);

-- -----------------------------------------------------------------------------
-- public_shares: enlaces públicos revocables
-- -----------------------------------------------------------------------------
-- El token NUNCA se guarda en claro: solo su hash SHA-256. El hash es lo
-- único que se busca en las consultas públicas, de modo que un volcado de la
-- base de datos no permite reconstruir las URLs compartidas.
create table if not exists public.public_shares (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid        not null references public.projects (id) on delete cascade,
  user_id        uuid        not null references auth.users (id) on delete cascade,
  version_id     uuid        references public.project_versions (id) on delete set null,
  token_hash     text        not null unique,
  code           text        not null check (char_length(code) <= 100000),
  include_code   boolean     not null default true,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  last_accessed_at timestamptz
);

comment on table public.public_shares is
  'Enlaces públicos revocables. El token se almacena solo como hash SHA-256.';

create index if not exists public_shares_user_id_idx
  on public.public_shares (user_id, created_at desc);

create index if not exists public_shares_token_hash_idx
  on public.public_shares (token_hash);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Creacion automática de perfil y ajustes al registrarse el usuario
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'usuario'), '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- >>> supabase/migrations/20260101000100_rls_policies.sql <<<
-- =============================================================================
-- DevLab · Row Level Security
-- -----------------------------------------------------------------------------
-- Principios:
--  - Cada operación protegida comprueba `auth.uid()`.
--  - El `user_id` enviado por el navegador NUNCA es la fuente de verdad:
--    se toma del token de sesión.
--  - Los enlaces públicos no se exponen con un SELECT directo: se resuelven
--    con una función SECURITY DEFINER que solo devuelve el contenido
--    compartido expresamente.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.public_shares enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);

-- -----------------------------------------------------------------------------
-- user_settings
-- -----------------------------------------------------------------------------
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own" on public.user_settings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- project_versions
-- La pertenencia se valida por la relacion con projects (no solo user_id),
-- de modo que un identificador de proyecto ajeno tampoco sirve.
-- -----------------------------------------------------------------------------
drop policy if exists "project_versions_select_own" on public.project_versions;
create policy "project_versions_select_own" on public.project_versions
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.projects p
      where p.id = project_versions.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "project_versions_insert_own" on public.project_versions;
create policy "project_versions_insert_own" on public.project_versions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_versions.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "project_versions_delete_own" on public.project_versions;
create policy "project_versions_delete_own" on public.project_versions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- public_shares
-- Solo el propietario gestiona sus enlaces. El acceso público se resuelve
-- con la función de abajo, no con un SELECT directo sobre la tabla.
-- -----------------------------------------------------------------------------
drop policy if exists "public_shares_select_own" on public.public_shares;
create policy "public_shares_select_own" on public.public_shares
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "public_shares_insert_own" on public.public_shares;
create policy "public_shares_insert_own" on public.public_shares
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "public_shares_update_own" on public.public_shares;
create policy "public_shares_update_own" on public.public_shares
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "public_shares_delete_own" on public.public_shares;
create policy "public_shares_delete_own" on public.public_shares
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Resolución de enlaces públicos
--
-- Devuelve unicamente el contenido compartido: nunca correos, perfiles,
-- claves ni otros proyectos. Si el enlace fue revocado o el proyecto se
-- elimino, la función no devuelve filas.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_public_share(p_token_hash text)
returns table (
  id           uuid,
  project_name text,
  code         text,
  include_code boolean,
  created_at   timestamptz,
  revoked      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    p.name,
    case when s.include_code then s.code else '' end,
    s.include_code,
    s.created_at,
    false as revoked
  from public.public_shares s
  join public.projects p on p.id = s.project_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null;
$$;

revoke all on function public.resolve_public_share(text) from public;
grant execute on function public.resolve_public_share(text) to anon, authenticated;

-- Marca el último acceso a un enlace (sin exponer datos del propietario).
create or replace function public.touch_public_share(p_token_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.public_shares
  set last_accessed_at = now()
  where token_hash = p_token_hash and revoked_at is null;
$$;

revoke all on function public.touch_public_share(text) from public;
grant execute on function public.touch_public_share(text) to anon, authenticated;

-- >>> supabase/migrations/20260101000200_user_id_defaults.sql <<<
-- =============================================================================
-- DevLab · Valores por defecto de property (propiedad) del usuario
-- -----------------------------------------------------------------------------
-- Motivo: con la politica RLS tal cual, una insercion que no incluya
-- `user_id` se rechaza ("new row violates row-level security policy"), porque
-- el valor llega como NULL y la comprobacion `auth.uid() = user_id` falla.
--
-- Con `default auth.uid()` el motor de la base de datos rellena la columna
-- con el usuario de la sesion. La politica se mantiene: sigue verificando
-- que el `user_id` (enviado o por defecto) coincide con `auth.uid()`, de modo
-- que un cliente no puede escribir en nombre de otro.
-- =============================================================================

alter table public.projects
  alter column user_id set default auth.uid();

alter table public.project_versions
  alter column user_id set default auth.uid();

alter table public.public_shares
  alter column user_id set default auth.uid();

-- La creacion automatica de perfil y ajustes tambien usa el valor por
-- defecto, para no depender de que el trigger recibe un id explicito.
alter table public.profiles
  alter column id set default auth.uid();
