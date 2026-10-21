'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitCompareArrows, Play, Scale } from 'lucide-react'
import { SCENARIOS, type CompareScenario } from '@/lib/compare/scenarios'
import { LabProvider, useLab, type LabResult } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { setPendingSource } from '@/lib/lab/pendingSource'
import { CodeEditor } from '@/components/lab/CodeEditor'
import { EngineSelector } from '@/components/lab/EngineSelector'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export default function ComparePage() {
  return (
    <LabProvider>
      <CompareContent />
    </LabProvider>
  )
}

function CompareContent() {
  const { t, locale } = useI18n()
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]?.id ?? '')
  const scenario = useMemo<CompareScenario | undefined>(
    () => SCENARIOS.find((item) => item.id === scenarioId),
    [scenarioId],
  )

  return (
    <div className="mx-auto w-full max-w-[1700px] px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-ink-100">
            <GitCompareArrows className="size-4 text-electric-400" aria-hidden="true" />
            {t('compare.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-400">{t('compare.subtitle')}</p>
        </div>
        <EngineSelector />
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScenarioId(item.id)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              item.id === scenarioId
                ? 'border-electric-500/50 bg-electric-500/15 text-electric-100'
                : 'border-line bg-carbon-900 text-ink-400 hover:text-ink-100',
            )}
          >
            {item.title[locale]}
          </button>
        ))}
      </div>

      {scenario ? <CompareScenarioView key={scenario.id} scenario={scenario} /> : null}
    </div>
  )
}

/**
 * Vista de un escenario de comparación.
 *
 * Se monta con `key={scenario.id}`, de modo que al cambiar de escenario el
 * estado de los dos editores se reinicia solo, sin necesidad de efectos.
 */
function CompareScenarioView({ scenario }: { scenario: CompareScenario }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { runSnippet, engine } = useLab()
  const [leftCode, setLeftCode] = useState(scenario.left.code)
  const [rightCode, setRightCode] = useState(scenario.right.code)
  const [leftResult, setLeftResult] = useState<LabResult | null>(null)
  const [rightResult, setRightResult] = useState<LabResult | null>(null)
  const [running, setRunning] = useState(false)

  const runBoth = async (): Promise<void> => {
    setRunning(true)
    try {
      const leftOutcome = await runSnippet(leftCode)
      const rightOutcome = await runSnippet(rightCode)
      setLeftResult(leftOutcome)
      setRightResult(rightOutcome)
    } finally {
      setRunning(false)
    }
  }

  const sameResult =
    leftResult && rightResult
      ? leftResult.output.join('\n') === rightResult.output.join('\n')
      : null

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-2">
        <CompareSide
          title={scenario.left.label[locale]}
          code={leftCode}
          onChange={setLeftCode}
          result={leftResult}
          t={t}
        />
        <CompareSide
          title={scenario.right.label[locale]}
          code={rightCode}
          onChange={setRightCode}
          result={rightResult}
          t={t}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={running}
          onClick={() => {
            void runBoth()
          }}
          icon={<Play className="size-3.5" aria-hidden="true" />}
        >
          {leftResult ? t('compare.rerun') : t('compare.runBoth')}
        </Button>
        {sameResult !== null ? (
          <Badge tone={sameResult ? 'ok' : 'warn'}>
            {sameResult ? t('compare.equalResults') : t('compare.differentResults')}
          </Badge>
        ) : null}
        <span className="text-[11px] text-ink-500">
          {engine === 'devlab'
            ? `${t('compare.metricSteps')}: ${leftResult?.steps.length ?? 0} / ${rightResult?.steps.length ?? 0}`
            : t('compare.engineMismatch')}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Panel
          title={t('compare.results')}
          icon={<Scale className="size-3.5" aria-hidden="true" />}
        >
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <MetricColumn
              title={scenario.left.label[locale]}
              result={leftResult}
              complexity={scenario.complexity.left[locale]}
              t={t}
            />
            <MetricColumn
              title={scenario.right.label[locale]}
              result={rightResult}
              complexity={scenario.complexity.right[locale]}
              t={t}
            />
          </div>
        </Panel>

        <Panel
          title={t('compare.difference')}
          icon={<GitCompareArrows className="size-3.5" aria-hidden="true" />}
        >
          <div className="space-y-3 p-4 text-xs leading-relaxed text-ink-300">
            <p>{scenario.difference[locale]}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h3 className="text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                  {t('compare.whenToUse')}
                </h3>
                <p className="mt-1">{scenario.whenToUse.left[locale]}</p>
                <p className="mt-1">{scenario.whenToUse.right[locale]}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                  {t('compare.preconditions')}
                </h3>
                <p className="mt-1">{scenario.preconditions[locale]}</p>
                <p className="mt-2 text-ink-500">{t('compare.complexityNote')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPendingSource({ source: leftCode, engine })
                  router.push('/')
                }}
              >
                {t('compare.loadInLab')} · {scenario.left.label[locale]}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPendingSource({ source: rightCode, engine })
                  router.push('/')
                }}
              >
                {t('compare.loadInLab')} · {scenario.right.label[locale]}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  )
}

function CompareSide({
  title,
  code,
  onChange,
  result,
  t,
}: {
  title: string
  code: string
  onChange: (value: string) => void
  result: LabResult | null
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <Panel title={title} className="h-[420px]">
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
        <CodeEditor
          value={code}
          onChange={onChange}
          ariaLabel={title}
          placeholder={t('lab.editorPlaceholder')}
        />
        <div className="dl-mono border-t border-line px-3 py-2 text-[11px]">
          {result ? (
            result.error ? (
              <p className="text-signal-error">
                {result.error.type}: {result.error.message}
              </p>
            ) : result.output.length > 0 ? (
              result.output.map((line, index) => (
                <p key={index} className="whitespace-pre-wrap text-ink-200">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-ink-600">({t('lab.consoleEmpty')})</p>
            )
          ) : (
            <p className="text-ink-600">—</p>
          )}
        </div>
      </div>
    </Panel>
  )
}

function MetricColumn({
  title,
  result,
  complexity,
  t,
}: {
  title: string
  result: LabResult | null
  complexity: string
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-ink-100">{title}</h3>
      <dl className="space-y-1.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-500">{t('compare.metricResult')}</dt>
          <dd className="dl-mono truncate text-ink-200">
            {result
              ? result.error
                ? result.error.type
                : (result.output.join(' | ') || '—')
              : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-500">{t('compare.metricTime')}</dt>
          <dd className="dl-mono text-ink-200">
            {result ? `${result.durationMs?.toFixed(2) ?? '0'} ms` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-500">{t('compare.metricSteps')}</dt>
          <dd className="dl-mono text-ink-200">
            {result && result.engine === 'devlab'
              ? `${result.steps.length} (${result.instructions ?? 0} instr.)`
              : t('compare.notComparable')}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-500">{t('compare.metricMemory')}</dt>
          <dd className="dl-mono text-ink-200">{t('compare.memoryUnavailable')}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-500">{t('compare.complexity')}</dt>
          <dd className="dl-mono text-electric-200">{complexity}</dd>
        </div>
      </dl>
    </div>
  )
}
