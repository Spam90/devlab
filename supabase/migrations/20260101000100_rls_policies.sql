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
