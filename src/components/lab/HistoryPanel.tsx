'use client'

import { useMemo } from 'react'
import { History } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { diffVariables } from '@/lib/lab/format'
import { engineSupports, featureUnavailableReason } from '@/lib/interpreter/capabilities'
import type { StepSnapshot } from '@/lib/interpreter/types'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/lib/utils/cn'

/** Referencia estable para evitar recrear el array en cada render. */
const EMPTY_STEPS: StepSnapshot[] = []

/**
 * Historial de pasos.
 *
 * Permite saltar a cualquier punto de la ejecución y muestra los cambios de
 * variables respecto al paso anterior.
 */
export function HistoryPanel() {
  const { result, stepIndex, engine, setStep } = useLab()
  const { t } = useI18n()

  const steps = result?.steps ?? EMPTY_STEPS
  const supported = engineSupports(engine, 'stepForward')

  const diffs = useMemo(() => {
    if (stepIndex === 0) return []
    const current = steps[stepIndex]
    const previous = steps[stepIndex - 1]
    if (!current || !previous) return []
    return diffVariables(previous.globals, current.globals)
  }, [steps, stepIndex])

  const kindLabel = (kind: string): string => {
    const key = `lab.stepKinds.${kind}`
    const translated = t(key)
    return translated === key ? kind : translated
  }

  return (
    <Panel
      title={t('lab.historyPanel')}
      icon={<History className="size-3.5" aria-hidden="true" />}
      className="h-full"
      bodyClassName="dl-scroll-thin"
      collapsible
    >
      {!supported ? (
        <p className="px-3 py-3 text-xs text-ink-500">
          {featureUnavailableReason(engine, 'stepForward')}
        </p>
      ) : steps.length === 0 ? (
        <p className="px-3 py-3 text-xs text-ink-600">{t('lab.noSteps')}</p>
      ) : (
        <div>
          <ol className="dl-scroll-thin max-h-[45%] overflow-auto" aria-label={t('a11y.stepList')}>
            {steps.map((step, index) => {
              const active = index === stepIndex
              return (
                <li key={step.index}>
                  <button
                    type="button"
                    onClick={() => setStep(index)}
                    className={cn(
                      'flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left text-[12px] transition-colors',
                      active
                        ? 'border-electric-500 bg-electric-500/10 text-ink-100'
                        : 'border-transparent text-ink-400 hover:bg-carbon-850 hover:text-ink-200',
                    )}
                  >
                    <span className="dl-mono w-10 shrink-0 text-[10px] text-ink-600">
                      {String(index + 1).padStart(3, '0')}
                    </span>
                    <span className="dl-mono w-16 shrink-0 text-[10px] text-ink-600">
                      L{step.line}
                    </span>
                    <span className="w-14 shrink-0 truncate text-[10px] tracking-wide uppercase">
                      {kindLabel(step.kind)}
                    </span>
                    <span className="dl-mono flex-1 truncate">{step.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="border-t border-line px-3 py-2">
            <p className="text-[10px] font-medium tracking-wide text-ink-500 uppercase">
              {t('lab.changes')}
            </p>
            {diffs.length === 0 ? (
              <p className="mt-1 text-[11px] text-ink-600">{t('lab.noChanges')}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {diffs.map((diff) => (
                  <li key={diff.name} className="dl-mono text-[11px]">
                    <span className="text-electric-200">{diff.name}</span>
                    {diff.before !== null ? (
                      <span className="text-ink-600"> {diff.before} →</span>
                    ) : null}
                    <span className="text-ink-200"> {diff.after}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
