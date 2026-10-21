'use client'

import { Boxes } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { compactValue, snapshotTypeName } from '@/lib/lab/format'
import { Panel } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'

/**
 * Inspector de variables.
 *
 * En modo DevLab muestra el estado exacto en el paso seleccionado. En modo
 * Pyodide muestra las variables globales al terminar la ejecución, ya que
 * ese motor no ofrece inspección paso a paso.
 */
export function VariablesPanel() {
  const { currentStep, result, engine } = useLab()
  const { t } = useI18n()

  if (engine === 'pyodide') {
    const globals = result?.globals ?? {}
    const entries = Object.entries(globals)
    return (
      <Panel
        title={t('lab.variablesPanel')}
        icon={<Boxes className="size-3.5" aria-hidden="true" />}
        className="h-full"
        collapsible
      >
        {entries.length === 0 ? (
          <p className="px-3 py-3 text-xs text-ink-600">{t('lab.variablesEmpty')}</p>
        ) : (
          <table
            className="w-full table-fixed text-left text-[12px]"
            aria-label={t('a11y.variableTable')}
          >
            <thead className="text-[10px] tracking-wide text-ink-500 uppercase">
              <tr>
                <th scope="col" className="w-1/3 px-3 py-1.5 font-medium">
                  {t('lab.variableName')}
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {t('lab.variableValue')}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([name, value]) => {
                const [type] = value.split(' | ')
                return (
                  <tr key={name} className="border-t border-line/60">
                    <td className="dl-mono truncate px-3 py-1.5 text-electric-200">{name}</td>
                    <td className="dl-mono truncate px-3 py-1.5 text-ink-300" title={value}>
                      <span className="text-ink-500">{type}</span>
                      {value.includes(' | ') ? ` ${value.split(' | ').slice(1).join(' | ')}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
    )
  }

  const globals = currentStep?.globals ?? []
  const frames = currentStep?.frames ?? []

  return (
    <Panel
      title={t('lab.variablesPanel')}
      icon={<Boxes className="size-3.5" aria-hidden="true" />}
      className="h-full"
    >
      {globals.length === 0 && frames.length === 0 ? (
        <p className="px-3 py-3 text-xs text-ink-600">{t('lab.variablesEmpty')}</p>
      ) : null}

      {globals.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 px-3 pt-2 pb-1">
            <Badge tone="accent">{t('lab.globalScope')}</Badge>
          </div>
          <table
            className="w-full table-fixed text-left text-[12px]"
            aria-label={t('a11y.variableTable')}
          >
            <thead className="text-[10px] tracking-wide text-ink-500 uppercase">
              <tr>
                <th scope="col" className="w-1/3 px-3 py-1 font-medium">
                  {t('lab.variableName')}
                </th>
                <th scope="col" className="w-1/5 px-3 py-1 font-medium">
                  {t('lab.variableType')}
                </th>
                <th scope="col" className="px-3 py-1 font-medium">
                  {t('lab.variableValue')}
                </th>
              </tr>
            </thead>
            <tbody>
              {globals.map((entry) => (
                <tr key={entry.name} className="border-t border-line/60">
                  <td className="dl-mono truncate px-3 py-1.5 text-electric-200">{entry.name}</td>
                  <td className="dl-mono truncate px-3 py-1.5 text-ink-500">
                    {snapshotTypeName(entry.value)}
                  </td>
                  <td
                    className="dl-mono truncate px-3 py-1.5 text-ink-200"
                    title={compactValue(entry.value, 200)}
                  >
                    {compactValue(entry.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {frames.map((frame, index) => (
        <div key={`${frame.name}-${index}`}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <Badge tone={index === frames.length - 1 ? 'accent' : 'neutral'}>
              {t('lab.localScope')} · {frame.name}
            </Badge>
          </div>
          {frame.locals.length > 0 ? (
            <table
              className="w-full table-fixed text-left text-[12px]"
              aria-label={`${t('a11y.variableTable')} · ${frame.name}`}
            >
              <tbody>
                {frame.locals.map((entry) => (
                  <tr key={entry.name} className="border-t border-line/60">
                    <td className="dl-mono w-1/3 truncate px-3 py-1.5 text-electric-200">
                      {entry.name}
                    </td>
                    <td className="dl-mono w-1/5 truncate px-3 py-1.5 text-ink-500">
                      {snapshotTypeName(entry.value)}
                    </td>
                    <td
                      className="dl-mono truncate px-3 py-1.5 text-ink-200"
                      title={compactValue(entry.value, 200)}
                    >
                      {compactValue(entry.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ))}
    </Panel>
  )
}
