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
