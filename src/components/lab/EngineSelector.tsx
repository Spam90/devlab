'use client'

import { Cpu, Gauge } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ENGINES, type EngineId } from '@/lib/interpreter/capabilities'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/Badge'

/**
 * Selector de motor de ejecución.
 *
 * Cambiar de motor reinicia el historial: cada motor tiene capacidades
 * distintas y mezclarlas sería engañoso.
 */
export function EngineSelector({ className }: { className?: string }) {
  const { engine, setEngine, runtime, status } = useLab()
  const { t } = useI18n()

  const runtimeLabel =
    engine === 'pyodide'
      ? runtime.status === 'ready'
        ? `Python ${runtime.pythonVersion ?? ''}`.trim()
        : runtime.status === 'loading'
          ? t('lab.loadingRuntime')
          : runtime.status === 'error'
            ? t('lab.runtimeError')
            : t('lab.idle')
      : ENGINES.devlab.name

  const tone =
    status === 'running'
      ? 'accent'
      : status === 'error' || status === 'limit'
        ? 'error'
        : status === 'completed'
          ? 'ok'
          : 'neutral'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        role="radiogroup"
        aria-label={t('lab.languageSelector')}
        className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-carbon-950 p-0.5"
      >
        {(Object.keys(ENGINES) as EngineId[]).map((id) => {
          const active = id === engine
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setEngine(id)}
              title={ENGINES[id].summary}
              className={cn(
                'flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors duration-150',
                active
                  ? 'bg-electric-500/20 text-electric-100 shadow-[inset_0_0_0_1px_rgba(58,103,245,0.5)]'
                  : 'text-ink-400 hover:bg-carbon-800 hover:text-ink-100',
              )}
            >
              {id === 'devlab' ? (
                <Gauge className="size-3.5" aria-hidden="true" />
              ) : (
                <Cpu className="size-3.5" aria-hidden="true" />
              )}
              {id === 'devlab' ? t('lab.engineDevlab') : t('lab.enginePyodide')}
            </button>
          )
        })}
      </div>

      <Badge tone={tone} aria-live="polite">
        <span className="dl-pulse-dot size-1.5 rounded-full bg-current" aria-hidden="true" />
        {runtimeLabel}
      </Badge>
    </div>
  )
}
