'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { generateShareToken, hashShareToken } from '@/lib/share/tokens'
import type {
  ProjectRow,
  ProjectVersionRow,
  PublicShareRow,
  ResolvedShare,
} from '@/lib/supabase/types'

/**
 * Acceso a los datos de DevLab desde el navegador.
 *
 * Todas las operaciones se ejecutan con la clave anon y la sesión del
 * usuario: la autorización real la aplican las politicas RLS de Postgres.
 * El `user_id` se toma siempre de la sesión, nunca de los datos enviados.
 */

export class DataAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataAccessError'
  }
}

function client() {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    throw new DataAccessError(
      'Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}

// -----------------------------------------------------------------------------
// Proyectos
// -----------------------------------------------------------------------------

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await client()
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new DataAccessError(error.message)
  return data ?? []
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await client().from('projects').select('*').eq('id', id).maybeSingle()
  if (error) throw new DataAccessError(error.message)
  return data
}

export async function createProject(input: {
  name: string
  code: string
  engine?: 'devlab' | 'pyodide'
  description?: string
}): Promise<ProjectRow> {
  const supabase = client()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new DataAccessError('Necesitas iniciar sesion para crear proyectos.')

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: input.name,
      code: input.code,
      engine: input.engine ?? 'devlab',
      description: input.description ?? null,
    })
    .select('*')
    .single()
  if (error) throw new DataAccessError(error.message)
  return data
}

export async function updateProject(
  id: string,
  patch: { name?: string; code?: string; engine?: 'devlab' | 'pyodide'; description?: string },
): Promise<ProjectRow> {
  const { data, error } = await client()
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new DataAccessError(error.message)
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await client().from('projects').delete().eq('id', id)
  if (error) throw new DataAccessError(error.message)
}

// -----------------------------------------------------------------------------
// Versiones
// -----------------------------------------------------------------------------

export async function listVersions(projectId: string): Promise<ProjectVersionRow[]> {
  const { data, error } = await client()
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
  if (error) throw new DataAccessError(error.message)
  return data ?? []
}

export async function saveVersion(input: {
  projectId: string
  code: string
  label?: string
}): Promise<ProjectVersionRow> {
  const supabase = client()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new DataAccessError('Necesitas iniciar sesion para guardar versiones.')

  const { data: existing, error: listError } = await supabase
    .from('project_versions')
    .select('version_number')
    .eq('project_id', input.projectId)
    .order('version_number', { ascending: false })
    .limit(1)

  if (listError) throw new DataAccessError(listError.message)
  const nextNumber = (existing?.[0]?.version_number ?? 0) + 1

  const { data, error } = await supabase
    .from('project_versions')
    .insert({
      project_id: input.projectId,
      user_id: user.id,
      version_number: nextNumber,
      code: input.code,
      label: input.label ?? null,
    })
    .select('*')
    .single()
  if (error) throw new DataAccessError(error.message)
  return data
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await client().from('project_versions').delete().eq('id', id)
  if (error) throw new DataAccessError(error.message)
}

// -----------------------------------------------------------------------------
// Enlaces públicos
// -----------------------------------------------------------------------------

export interface CreatedShare {
  share: PublicShareRow
  token: string
}

export async function listShares(projectId?: string): Promise<PublicShareRow[]> {
  let query = client().from('public_shares').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new DataAccessError(error.message)
  return data ?? []
}

export async function createShare(input: {
  projectId: string
  code: string
  includeCode?: boolean
  versionId?: string | null
}): Promise<CreatedShare> {
  const supabase = client()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new DataAccessError('Necesitas iniciar sesion para compartir.')

  const token = generateShareToken()
  const tokenHash = await hashShareToken(token)

  const { data, error } = await supabase
    .from('public_shares')
    .insert({
      project_id: input.projectId,
      user_id: user.id,
      version_id: input.versionId ?? null,
      token_hash: tokenHash,
      code: input.code,
      include_code: input.includeCode ?? true,
    })
    .select('*')
    .single()
  if (error) throw new DataAccessError(error.message)
  return { share: data, token }
}

export async function revokeShare(id: string): Promise<void> {
  const { error } = await client()
    .from('public_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new DataAccessError(error.message)
}

/** Resuelve un enlace público por su token. */
export async function resolveShare(token: string): Promise<ResolvedShare | null> {
  const tokenHash = await hashShareToken(token)
  const { data, error } = await client().rpc('resolve_public_share', {
    p_token_hash: tokenHash,
  })
  if (error) throw new DataAccessError(error.message)
  return data?.[0] ?? null
}
