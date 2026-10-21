'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured, getSiteUrl } from '@/lib/supabase/config'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.invalidEmail'))
      return
    }
    if (!isSupabaseConfigured()) {
      setError(t('errors.configurationMissing'))
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setError(t('errors.configurationMissing'))
      return
    }

    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/update-password`,
    })
    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="dl-panel p-5">
        <h1 className="text-base font-semibold text-ink-100">{t('auth.resetPasswordTitle')}</h1>
        <p className="mt-1 text-sm text-ink-400">{t('auth.resetPasswordSubtitle')}</p>

        {sent ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-md border border-signal-ok/40 bg-signal-ok/10 px-3 py-2 text-xs text-signal-ok">
              {t('auth.checkEmailSubtitle')}
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSent(false)
              }}
            >
              {t('common.back')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
            <Field label={t('auth.email')} type="email" required>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="dl-surface-input"
                placeholder="tu@correo.com"
              />
            </Field>

            {error ? (
              <p role="alert" className="rounded-md border border-signal-error/40 bg-signal-error/10 px-3 py-2 text-xs text-signal-error">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" loading={loading} className="w-full">
              {t('auth.sendResetLink')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
