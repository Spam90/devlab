import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Middleware de DevLab.
 *
 * Si Supabase no está configurado, `updateSession` deja pasar la petición
 * sin tocar cookies, de modo que la aplicación funciona en modo invitado.
 */
export async function middleware(request: NextRequest): Promise<Response> {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Se aplican a todas las rutas salvo las estaticas y las imagenes.
     */
    '/((?!_next/static|_next/image|favicon.ico|pyodide/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
