'use client'

import { useState } from 'react'
import { Bot, CheckCircle2, Globe, LogOut, Settings, User } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAiConfig } from '@/lib/ai/session'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n()
  const { user, configured, signOut } = useAuth()
  const { config, update, clear } = useAiConfig()
  const { notify } = useToast()
  const [testing, setTesting] = useState(false)

  const testConnection = async (): Promise<void> => {
    setTesting(true)
    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          task: 'explain-code',
          locale,
          code: 'print("hola")',
          apiKey: config.apiKey || undefined,
          baseUrl: config.baseUrl || undefined,
          model: config.model || undefined,
        }),
      })
      if (response.ok) {
        notify(t('settings.aiTestSuccess'), 'success')
      } else {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        notify(payload?.error ?? t('settings.aiTestFailed'), 'error')
      }
    } catch {
      notify(t('errors.network'), 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-ink-100">
          <Settings className="size-4 text-electric-400" aria-hidden="true" />
          {t('settings.title')}
        </h1>
      </header>

      <div className="space-y-4">
        <Panel title={t('settings.language')} icon={<Globe className="size-3.5" aria-hidden="true" />}>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((code: Locale) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={
                    code === locale
                      ? 'rounded-md border border-electric-500/50 bg-electric-500/15 px-3 py-1.5 text-xs font-medium text-electric-100'
                      : 'rounded-md border border-line bg-carbon-900 px-3 py-1.5 text-xs font-medium text-ink-400 hover:text-ink-100'
                  }
                >
                  {LOCALE_LABELS[code]}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-500">{t('settings.languageHint')}</p>
          </div>
        </Panel>

        <Panel title={t('settings.account')} icon={<User className="size-3.5" aria-hidden="true" />}>
          <div className="space-y-3 p-4">
            {user ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-100">{user.email}</span>
                  <Badge tone="ok">{t('nav.account')}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void signOut()
                  }}
                  icon={<LogOut className="size-3.5" aria-hidden="true" />}
                >
                  {t('settings.signOut')}
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-400">
                {configured ? t('nav.guestBanner') : t('errors.configurationMissing')}
              </p>
            )}
          </div>
        </Panel>

        <Panel title={t('settings.ai')} icon={<Bot className="size-3.5" aria-hidden="true" />}>
          <div className="space-y-3 p-4">
            <p className="text-xs leading-relaxed text-ink-400">{t('settings.aiDescription')}</p>

            <label className="flex items-center gap-2 text-xs text-ink-200">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => update({ enabled: event.target.checked })}
                className="size-3.5 accent-electric-500"
              />
              {config.enabled ? t('settings.aiEnabled') : t('settings.aiDisabled')}
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('settings.aiBaseUrl')}>
                <input
                  value={config.baseUrl}
                  onChange={(event) => update({ baseUrl: event.target.value })}
                  className="dl-surface-input"
                  placeholder="https://api.openai.com/v1"
                />
              </Field>
              <Field label={t('settings.aiModel')}>
                <input
                  value={config.model}
                  onChange={(event) => update({ model: event.target.value })}
                  className="dl-surface-input"
                  placeholder="gpt-4o-mini"
                />
              </Field>
            </div>

            <Field label={t('settings.aiApiKey')} hint={t('settings.aiApiKeyHint')}>
              <input
                type="password"
                value={config.apiKey}
                onChange={(event) => update({ apiKey: event.target.value })}
                className="dl-surface-input"
                autoComplete="off"
                placeholder="sk-..."
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={testing}
                onClick={() => {
                  void testConnection()
                }}
              >
                {t('settings.aiTest')}
              </Button>
              <Button size="sm" variant="ghost" onClick={clear}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title={t('ai.disclaimer')} icon={<CheckCircle2 className="size-3.5" aria-hidden="true" />}>
          <p className="p-4 text-xs leading-relaxed text-ink-400">{t('ai.disclaimer')}</p>
        </Panel>
      </div>
    </div>
  )
}
