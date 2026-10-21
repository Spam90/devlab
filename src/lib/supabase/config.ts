/**
 * Configuración de Supabase.
 *
 * DevLab arranca sin credenciales: en ese caso la aplicación funciona como
 * una herramienta local (modo invitado) y muestra un aviso claro de que la
 * autenticación y la sincronización no estan disponibles.
 */

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url || !anonKey) return null
  if (url.includes('TU-PROYECTO') || anonKey.includes('TU_CLAVE')) return null
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null
}

/** Configuración del sitio usada en los flujos OAuth y de recuperación. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
