import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseConfig } from './config'

/**
 * Cliente de Supabase para el servidor (Route Handlers y Server Components).
 *
 * Usa cookies seguras mediante `@supabase/ssr`. Devuelve `null` si el
 * proyecto no está configurado.
 */
export async function createServerSupabaseClient() {
  const config = getSupabaseConfig()
  if (!config) return null

  const cookieStore = await cookies()

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // `cookies().set` solo funciona en Server Actions y Route Handlers.
          // En el resto de contextos se ignora de forma silenciosa: el
          // middleware se encarga de refrescar la sesión.
        }
      },
    },
  })
}

/** Identificador del usuario autenticado, o `null`. */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}
