'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

export default function UpdatePasswordPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase || !isSupabaseConfigured()) {
      setError(t('errors.configurationMissing'))
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    window.setTimeout(() => router.push('/'), 1200)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="dl-panel p-5">
        <h1 className="text-base font-semibold text-ink-100">{t('auth.newPasswordTitle')}</h1>
        <p className="mt-1 text-sm text-ink-400">{t('auth.newPasswordSubtitle')}</p>

        {done ? (
          <p className="mt-4 rounded-md border border-signal-ok/40 bg-signal-ok/10 px-3 py-2 text-xs text-signal-ok">
            {t('common.saved')}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
            <Field label={t('auth.password')} type="password" required hint={t('auth.passwordHint')}>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="dl-surface-input"
              />
            </Field>
            <Field label={t('auth.confirmPassword')} type="password" required>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="dl-surface-input"
              />
            </Field>

            {error ? (
              <p role="alert" className="rounded-md border border-signal-error/40 bg-signal-error/10 px-3 py-2 text-xs text-signal-error">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" loading={loading} className="w-full">
              {t('auth.updatePassword')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
