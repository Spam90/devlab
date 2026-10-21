'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Info } from 'lucide-react'

/**
 * Aviso de modo invitado.
 *
 * Explica que el trabajo se guarda en el navegador y ofrece el acceso a la
 * cuenta para sincronizarlo.
 */
export function GuestBanner() {
  const { user, loading, configured } = useAuth()
  const { t } = useI18n()

  if (loading) return null
  if (!configured || user) return null

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-carbon-900/70 px-3 py-1.5 text-[11px] text-ink-400 sm:px-5">
      <Info className="size-3.5 shrink-0 text-electric-400" aria-hidden="true" />
      <span className="flex-1">{t('nav.guestBanner')}</span>
      <Link
        href="/auth/sign-in"
        className="rounded px-1.5 py-0.5 font-medium text-electric-300 underline-offset-2 hover:underline"
      >
        {t('nav.signIn')}
      </Link>
      <Link
        href="/auth/sign-up"
        className="rounded px-1.5 py-0.5 font-medium text-electric-300 underline-offset-2 hover:underline"
      >
        {t('nav.signUp')}
      </Link>
    </div>
  )
}
