'use client'

import { Layers } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { engineSupports, featureUnavailableReason } from '@/lib/interpreter/capabilities'
import { Panel } from '@/components/ui/Panel'

/** Pila de llamadas: muestra la cadena de funciones activas en el paso actual. */
export function CallStackPanel() {
  const { currentStep, engine } = useLab()
  const { t } = useI18n()

  const supported = engineSupports(engine, 'inspectCallStack')
  const frames = currentStep?.frames ?? []

  return (
    <Panel
      title={t('lab.callStackPanel')}
      icon={<Layers className="size-3.5" aria-hidden="true" />}
      className="h-full"
    >
      {!supported ? (
        <p className="px-3 py-3 text-xs text-ink-500">
          {featureUnavailableReason(engine, 'inspectCallStack')}
        </p>
      ) : frames.length === 0 ? (
        <p className="px-3 py-3 text-xs text-ink-600">{t('lab.framesEmpty')}</p>
      ) : (
        <ol className="dl-mono px-3 py-2 text-[12px]" aria-label={t('a11y.frameList')}>
          {frames.map((frame, index) => (
            <li
              key={`${frame.name}-${index}`}
              className="flex items-baseline gap-2 border-l-2 border-line py-0.5 pl-3"
              style={{ marginLeft: `${index * 10}px` }}
            >
              <span className="text-ink-500">{index}</span>
              <span className="text-electric-200">{frame.name}()</span>
              <span className="text-ink-600">L{frame.line}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
