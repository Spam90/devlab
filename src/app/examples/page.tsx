'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, FlaskConical, RotateCcw } from 'lucide-react'
import { EXAMPLES, examplesByCategory, type ExampleCategory, type LabExample } from '@/lib/examples'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { setPendingSource } from '@/lib/lab/pendingSource'
import { resetOnboardingTour } from '@/components/lab/OnboardingTour'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils/cn'

type Filter = 'all' | ExampleCategory

export default function ExamplesPage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<LabExample | null>(null)

  const grouped = useMemo(() => examplesByCategory(), [])
  const visible = useMemo(() => {
    if (filter === 'all') return EXAMPLES
    return grouped[filter]
  }, [filter, grouped])

  const load = (example: LabExample): void => {
    setPendingSource({ source: example.code, engine: 'devlab', name: example.title[locale] })
    router.push('/')
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-ink-100">
          <BookOpen className="size-4 text-electric-400" aria-hidden="true" />
          {t('examples.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-400">{t('examples.subtitle')}</p>
      </header>

      <div className="mb-4 overflow-x-auto">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          label={t('examples.title')}
          options={[
            { value: 'all', label: t('examples.categories.all') },
            { value: 'basics', label: t('examples.categories.basics') },
            { value: 'control', label: t('examples.categories.control') },
            { value: 'functions', label: t('examples.categories.functions') },
            { value: 'algorithms', label: t('examples.categories.algorithms') },
            { value: 'errors', label: t('examples.categories.errors') },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((example) => (
            <li key={example.id}>
              <button
                type="button"
                onClick={() => setSelected(example)}
                className={cn(
                  'dl-panel flex h-full w-full flex-col gap-2 p-4 text-left transition-colors',
                  'hover:border-electric-500/40',
                  selected?.id === example.id && 'border-electric-500/50 bg-electric-500/5',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink-100">{example.title[locale]}</h2>
                  <Badge tone="neutral">{t(`examples.categories.${example.category}`)}</Badge>
                </div>
                <p className="text-xs leading-relaxed text-ink-400">{example.summary[locale]}</p>
                <div className="mt-auto flex items-center gap-1.5 pt-2">
                  {example.engines.map((engine) => (
                    <Badge key={engine} tone={engine === 'devlab' ? 'accent' : 'neutral'}>
                      {engine === 'devlab' ? t('lab.engineDevlab') : t('lab.enginePyodide')}
                    </Badge>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="lg:sticky lg:top-20 lg:self-start">
          {selected ? (
            <Panel
              title={selected.title[locale]}
              icon={<FlaskConical className="size-3.5" aria-hidden="true" />}
            >              <div className="space-y-4 p-4">
                <div>
                  <h3 className="text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                    {t('examples.explanation')}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-300">
                    {selected.explanation[locale]}
                  </p>
                </div>

                <div>
                  <h3 className="text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                    {t('examples.expectedOutput')}
                  </h3>
                  <pre className="dl-mono mt-1 overflow-x-auto rounded-md border border-line bg-carbon-950 p-2 text-[11px] text-ink-300">
                    {selected.expectedOutput}
                  </pre>
                </div>

                <div>
                  <h3 className="text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                    {t('examples.compatibleEngines')}
                  </h3>
                  <div className="mt-1 flex gap-1.5">
                    {selected.engines.map((engine) => (
                      <Badge key={engine} tone={engine === 'devlab' ? 'accent' : 'neutral'}>
                        {engine === 'devlab' ? t('lab.engineDevlab') : t('lab.enginePyodide')}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="primary" size="sm" onClick={() => load(selected)}>
                    {t('examples.load')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="size-3.5" aria-hidden="true" />}
                    onClick={() => {
                      resetOnboardingTour()
                      router.push('/')
                    }}
                  >
                    {t('examples.startTour')}
                  </Button>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title={t('examples.title')}>
              <p className="p-4 text-xs text-ink-500">{t('examples.selectExample')}</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
