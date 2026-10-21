/**
 * Tipos de la base de datos de DevLab.
 *
 * Se declaran como `type` (y no como `interface`) para que TS les asigne una
 * firma de índice implícita: es lo que exige la API tipada de Supabase.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type UserSettingsRow = {
  user_id: string
  locale: 'es' | 'en'
  default_engine: 'devlab' | 'pyodide'
  theme: 'dark'
  max_steps: number
  max_instructions: number
  max_call_depth: number
  max_output_bytes: number
  timeout_ms: number
  updated_at: string
}

export type ProjectRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  code: string
  engine: 'devlab' | 'pyodide'
  created_at: string
  updated_at: string
}

export type ProjectVersionRow = {
  id: string
  project_id: string
  user_id: string
  version_number: number
  code: string
  label: string | null
  created_at: string
}

export type PublicShareRow = {
  id: string
  project_id: string
  user_id: string
  version_id: string | null
  token_hash: string
  code: string
  include_code: boolean
  revoked_at: string | null
  created_at: string
  last_accessed_at: string | null
}

/** Resultado de la función pública `resolve_public_share`. */
export type ResolvedShare = {
  id: string
  project_name: string
  code: string
  include_code: boolean
  created_at: string
  revoked: boolean
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & { id: string }
        Update: Partial<ProfileRow>
        Relationships: []
      }
      user_settings: {
        Row: UserSettingsRow
        Insert: Partial<UserSettingsRow> & { user_id: string }
        Update: Partial<UserSettingsRow>
        Relationships: []
      }
      projects: {
        Row: ProjectRow
        Insert: Partial<ProjectRow> & { user_id: string; name: string }
        Update: Partial<ProjectRow>
        Relationships: []
      }
      project_versions: {
        Row: ProjectVersionRow
        Insert: Partial<ProjectVersionRow> & { project_id: string; user_id: string }
        Update: Partial<ProjectVersionRow>
        Relationships: []
      }
      public_shares: {
        Row: PublicShareRow
        Insert: Partial<PublicShareRow> & {
          project_id: string
          user_id: string
          token_hash: string
          code: string
        }
        Update: Partial<PublicShareRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      resolve_public_share: {
        Args: { p_token_hash: string }
        Returns: ResolvedShare[]
      }
      touch_public_share: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
