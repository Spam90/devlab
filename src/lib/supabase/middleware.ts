import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseConfig } from './config'

/**
 * Refresco de la sesión de Supabase en cada petición.
 *
 * Las cookies de sesión se rotan en el servidor: este middleware es el
 * lugar donde se actualizan para que las peticiones posteriores lleven
 * siempre una sesión valida.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = getSupabaseConfig()
  if (!config) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // `getUser()` valida el token contra el servidor de Supabase.
  await supabase.auth.getUser()

  return response
}
