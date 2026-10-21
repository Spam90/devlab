'use client'

import { useMemo } from 'react'
import { Terminal } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Panel } from '@/components/ui/Panel'

/**
 * Consola: salida estándar y errores.
 *
 * En modo DevLab se muestra la salida acumulada hasta el paso actual; en
 * modo Pyodide se muestra la salida completa de la ejecución.
 */
export function ConsolePanel() {
  const { result, currentStep, engine } = useLab()
  const { t } = useI18n()

  const lines = useMemo(() => {
    if (!result) return []
    if (engine === 'devlab') {
      const limit = currentStep?.outputLength ?? result.output.length
      return result.output.slice(0, limit)
    }
    return result.output
  }, [result, currentStep, engine])

  const error = result?.error

  return (
    <Panel
      title={t('lab.consolePanel')}
      icon={<Terminal className="size-3.5" aria-hidden="true" />}
      className="h-full"
      bodyClassName="dl-scroll-thin"
      collapsible
    >
      <div
        className="dl-mono dl-scroll-thin h-full overflow-auto px-3 py-2 text-[12px] leading-relaxed"
        aria-label={t('a11y.consoleOutput')}
        role="log"
        data-testid="console-output"
      >
        {lines.length === 0 && !error ? (
          <p className="text-ink-600">{t('lab.consoleEmpty')}</p>
        ) : null}

        {lines.map((line, index) => (
          <p key={index} className="whitespace-pre-wrap text-ink-200">
            {line === '' ? ' ' : line}
          </p>
        ))}

        {error ? (
          <div className="mt-3 rounded-md border border-signal-error/40 bg-signal-error/5 p-2">
            <p className="text-[11px] font-semibold tracking-wide text-signal-error uppercase">
              {error.type}
              {error.line > 0 ? ` · L${error.line}` : ''}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink-200">{error.message}</p>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
