import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isValidShareToken, hashShareToken } from '@/lib/share/tokens'
import type { ResolvedShare } from '@/lib/supabase/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Resolución de un enlace público.
 *
 * - El token se valida por formato antes de tocar la base de datos.
 * - Solo se busca su hash: la base de datos nunca almacena el token.
 * - La función de Postgres solo devuelve el contenido compartido.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params

  if (!isValidShareToken(token)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'configuration' }, { status: 503 })
  }

  const tokenHash = await hashShareToken(token)

  const { data, error } = await supabase.rpc('resolve_public_share', {
    p_token_hash: tokenHash,
  })

  if (error) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const share = (data as ResolvedShare[] | null)?.[0]
  if (!share) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  void supabase.rpc('touch_public_share', { p_token_hash: tokenHash })

  return NextResponse.json({
    id: share.id,
    projectName: share.project_name,
    code: share.include_code ? share.code : '',
    includeCode: share.include_code,
    createdAt: share.created_at,
  })
}
