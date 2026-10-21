'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './config'
import type { Database } from './types'

let cached: SupabaseClient<Database> | null = null

/**
 * Cliente de Supabase para el navegador.
 *
 * Devuelve `null` cuando el proyecto no está configurado, de modo que la
 * interfaz pueda ofrecer el modo invitado sin lanzar excepciones.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') return null
  const config = getSupabaseConfig()
  if (!config) return null
  if (!cached) {
    cached = createBrowserClient<Database>(config.url, config.anonKey)
  }
  return cached
}
