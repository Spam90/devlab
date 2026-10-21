import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Sonda de salud para verificar el despliegue.
 *
 * No expone datos sensibles: solo indica si la configuración básica está
 * presente. Pensada para comprobar la instalación despues de desplegar.
 */
export async function GET(): Promise<NextResponse> {
  const supabaseConfigured = isSupabaseConfigured()
  return NextResponse.json({
    status: 'ok',
    service: 'devlab',
    supabase: supabaseConfigured ? 'configured' : 'not_configured',
    pyodide: 'served_from_public',
    timestamp: new Date().toISOString(),
  })
}
