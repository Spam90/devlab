'use client'

import { useState } from 'react'
import { Bot, ShieldAlert } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useAiConfig } from '@/lib/ai/session'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Panel } from '@/components/ui/Panel'

type Task = 'explain-code' | 'explain-error' | 'summarize-algorithm' | 'suggest-improvements'

/**
 * Panel del asistente de IA.
 *
 * Es totalmente opcional: si no hay clave configurada, el panel lo indica y
 * el resto del laboratorio sigue funcionando igual. Las explicaciones
 * siempre se presentan como generadas por un modelo, nunca como resultado
 * de la ejecución.
 */
export function AiPanel() {
  const { source, result, currentStep } = useLab()
  const { t, locale } = useI18n()
  const { config } = useAiConfig()
  const [task, setTask] = useState<Task>('explain-code')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const hasKey = Boolean(config.apiKey.trim())

  const ask = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const facts = [
        result?.output.length ? `Salida real:\n${result.output.join('\n')}` : '',
        result?.error
          ? `Error real: ${result.error.type}: ${result.error.message}`
          : '',
        currentStep
          ? `Variables en el paso actual: ${currentStep.globals
              .map((entry) => `${entry.name} = ${entry.value.type}`)
              .join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')

      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          task,
          locale,
          code: source,
          facts,
          question: question.trim() || undefined,
          apiKey: config.apiKey || undefined,
          baseUrl: config.baseUrl || undefined,
          model: config.model || undefined,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { content?: string; error?: string }
        | null

      if (!response.ok || !payload?.content) {
        setError(payload?.error ?? t('errors.generic'))
        return
      }
      setAnswer(payload.content)
    } catch {
      setError(t('errors.network'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title={t('settings.ai')} icon={<Bot className="size-3.5" aria-hidden="true" />}>
      <div className="space-y-3 p-3">
        {!hasKey ? (
          <p className="rounded-md border border-line bg-carbon-900 px-2.5 py-2 text-[11px] text-ink-400">
            {t('ai.noKey')}{' '}
            <span className="text-electric-300">{t('nav.settings')}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['explain-code', t('ai.explainCode')],
              ['explain-error', t('ai.explainError')],
              ['summarize-algorithm', t('ai.summarizeAlgorithm')],
              ['suggest-improvements', t('ai.suggestImprovements')],
            ] as [Task, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTask(value)}
              className={
                value === task
                  ? 'rounded-md border border-electric-500/50 bg-electric-500/15 px-2 py-1 text-[11px] text-electric-100'
                  : 'rounded-md border border-line bg-carbon-900 px-2 py-1 text-[11px] text-ink-400 hover:text-ink-100'
              }
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t('ai.placeholder')}
          rows={2}
          className="dl-surface-input resize-none text-xs"
        />

        <Button
          size="sm"
          variant="secondary"
          loading={loading}
          disabled={!hasKey}
          onClick={() => {
            void ask()
          }}
        >
          {loading ? t('ai.thinking') : t('ai.send')}
        </Button>

        {error ? (
          <p className="rounded-md border border-signal-error/40 bg-signal-error/10 px-2.5 py-2 text-[11px] text-signal-error">
            {error}
          </p>
        ) : null}

        {answer ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Badge tone="accent">{t('ai.interpretation')}</Badge>
            </div>
            <p className="whitespace-pre-wrap rounded-md border border-line bg-carbon-950 p-2.5 text-[11px] leading-relaxed text-ink-200">
              {answer}
            </p>
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-500">
              <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              {t('ai.disclaimer')}
            </p>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
