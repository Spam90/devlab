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
