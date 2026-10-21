'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Code2, Mail } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSiteUrl, isSupabaseConfigured } from '@/lib/supabase/config'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up'
}

export function AuthForm({ mode }: AuthFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'
  const configured = isSupabaseConfigured()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.invalidEmail'))
      return
    }
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (isSignUp && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setError(t('errors.configurationMissing'))
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        setNotice(t('auth.checkEmailSubtitle'))
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.push('/')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  const handleGithub = async (): Promise<void> => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setError(t('errors.configurationMissing'))
      return
    }
    setLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${getSiteUrl()}/auth/callback` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  if (!configured) {
    return (
      <div className="dl-panel p-5">
        <h1 className="text-base font-semibold text-ink-100">
          {isSignUp ? t('auth.signUpTitle') : t('auth.signInTitle')}
        </h1>
        <p className="mt-2 text-sm text-ink-400">{t('errors.configurationMissing')}</p>
        <p className="mt-3 text-xs text-ink-500">
          <Link href="/" className="text-electric-300 underline-offset-2 hover:underline">
            {t('nav.lab')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="dl-panel p-5">
      <h1 className="text-base font-semibold text-ink-100">
        {isSignUp ? t('auth.signUpTitle') : t('auth.signInTitle')}
      </h1>
      <p className="mt-1 text-sm text-ink-400">
        {isSignUp ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}
      </p>

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

        <Field label={t('auth.password')} type="password" required>
          <input
            type="password"
            name="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="dl-surface-input"
          />
        </Field>

        {isSignUp ? (
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
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-signal-error/40 bg-signal-error/10 px-3 py-2 text-xs text-signal-error">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md border border-signal-ok/40 bg-signal-ok/10 px-3 py-2 text-xs text-signal-ok">
            {notice}
          </p>
        ) : null}

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {isSignUp ? t('auth.signUpWithEmail') : t('auth.signInWithEmail')}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-[11px] text-ink-600">
        <span className="h-px flex-1 bg-line" />
        <span>o</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          void handleGithub()
        }}
        disabled={loading}
        icon={<Code2 className="size-4" aria-hidden="true" />}
      >
        {t('auth.signInWithGithub')}
      </Button>

      <div className="mt-5 flex flex-col gap-1.5 text-xs">
        {!isSignUp ? (
          <Link
            href="/auth/reset-password"
            className="inline-flex items-center gap-1.5 text-electric-300 underline-offset-2 hover:underline"
          >
            <Mail className="size-3.5" aria-hidden="true" />
            {t('auth.forgotPassword')}
          </Link>
        ) : null}
        <Link
          href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'}
          className="text-ink-400 underline-offset-2 hover:text-ink-100 hover:underline"
        >
          {isSignUp ? t('nav.signIn') : t('nav.signUp')}
        </Link>
      </div>
    </div>
  )
}
