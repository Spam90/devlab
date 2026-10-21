import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/supabase/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Callback de autenticación (OAuth y confirmaciones por enlace).
 *
 * Valida el parámetro `next` para evitar open redirects: solo se permiten
 * rutas internas que empiezan por `/` y no por `//`.
 */
function safeNextPath(candidate: string | null): string {
  if (!candidate) return '/'
  if (!candidate.startsWith('/')) return '/'
  if (candidate.startsWith('//')) return '/'
  if (candidate.includes('\\')) return '/'
  return candidate
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const next = safeNextPath(url.searchParams.get('next'))
  const siteUrl = getSiteUrl()

  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?reason=configuration`)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`)
    }
    return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?reason=exchange`)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'email' | 'recovery' | 'invite' | 'email_change',
      token_hash: tokenHash,
    })
    if (!error) {
      return NextResponse.redirect(`${siteUrl}/auth/update-password`)
    }
    return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?reason=verification`)
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error?reason=missing_code`)
}
