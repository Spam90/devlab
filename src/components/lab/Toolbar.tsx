'use client'

import {
  ChevronFirst,
  ChevronLast,
  Pause,
  Play,
  RotateCcw,
  Save,
  SkipBack,
  SkipForward,
  Square,
} from 'lucide-react'
import { useState } from 'react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { engineSupports, featureUnavailableReason } from '@/lib/interpreter/capabilities'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { cn } from '@/lib/utils/cn'

/**
 * Barra de controles de ejecución.
 *
 * Las acciones que el motor activo no soporta aparecen deshabilitadas con
 * una explicación precisa, en lugar de fallar en silencio.
 */
export function Toolbar() {
  const {
    engine,
    status,
    run,
    reset,
    cancel,
    save,
    saveAs,
    dirty,
    project,
    saveState,
    saveError,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    stepIndex,
    totalSteps,
    historyStale,
  } = useLab()
  const { t } = useI18n()
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [projectName, setProjectName] = useState('')

  const running = status === 'running'
  const canStep = engineSupports(engine, 'stepForward')
  const canGoBack = engineSupports(engine, 'stepBackward')
  const canCancel = engineSupports(engine, 'cancel')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          void run()
        }}
        loading={running}
        icon={<Play className="size-3.5" aria-hidden="true" />}
        title={t('lab.runTooltip')}
      >
        {t('lab.run')}
      </Button>

      <div className="flex items-center gap-0.5 rounded-md border border-line bg-carbon-950 p-0.5">
        <IconButton
          label={t('lab.jumpToStart')}
          size="sm"
          disabled={!canStep || totalSteps === 0}
          title={canStep ? t('lab.jumpToStart') : featureUnavailableReason(engine, 'jumpToStart')}
          onClick={jumpToStart}
        >
          <ChevronFirst className="size-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('lab.stepBackward')}
          size="sm"
          tone="accent"
          disabled={!canGoBack || stepIndex === 0}
          title={canGoBack ? t('lab.stepBackwardTooltip') : featureUnavailableReason(engine, 'stepBackward')}
          onClick={stepBackward}
        >
          <SkipBack className="size-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('lab.stepForward')}
          size="sm"
          tone="accent"
          disabled={!canStep || totalSteps === 0 || stepIndex >= totalSteps - 1}
          title={canStep ? t('lab.stepForwardTooltip') : featureUnavailableReason(engine, 'stepForward')}
          onClick={stepForward}
        >
          <SkipForward className="size-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('lab.jumpToEnd')}
          size="sm"
          disabled={!canStep || totalSteps === 0}
          title={canStep ? t('lab.jumpToEnd') : featureUnavailableReason(engine, 'jumpToEnd')}
          onClick={jumpToEnd}
        >
          <ChevronLast className="size-3.5" aria-hidden="true" />
        </IconButton>
      </div>

      <IconButton
        label={t('lab.reset')}
        onClick={reset}
        disabled={status === 'idle'}
        title={t('lab.reset')}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
      </IconButton>

      {canCancel ? (
        <IconButton
          label={t('lab.cancel')}
          tone="danger"
          onClick={cancel}
          disabled={!running}
          title={t('lab.cancel')}
        >
          <Square className="size-3.5" aria-hidden="true" />
        </IconButton>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {project ? (
          <div className="flex items-center gap-1.5">
            <span
              className="max-w-[160px] truncate text-[11px] text-ink-400"
              title={project.name}
            >
              {project.name}
            </span>
            {dirty ? (
              <span className="text-[11px] text-signal-warn">{t('common.unsaved')}</span>
            ) : null}
            <Button
              size="sm"
              variant={dirty ? 'primary' : 'ghost'}
              loading={saveState === 'saving'}
              disabled={!dirty}
              onClick={() => {
                void save()
              }}
              title={saveError ?? t('common.save')}
            >
              {saveState === 'saved' && !dirty ? t('common.saved') : t('common.save')}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSaveAsOpen(true)
            }}
            icon={<Save className="size-3.5" aria-hidden="true" />}
          >
            {t('projects.create')}
          </Button>
        )}
        {historyStale ? (
          <span className="text-[11px] text-signal-warn">{t('lab.sourceChanged')}</span>
        ) : null}
        <span
          className={cn(
            'dl-mono rounded-md border border-line bg-carbon-950 px-2 py-1 text-[11px] text-ink-400',
          )}
          aria-live="polite"
          aria-label={t('a11y.stepPosition')}
          data-testid="step-counter"
        >
          {totalSteps > 0
            ? t('lab.stepCounter', { current: stepIndex + 1, total: totalSteps })
            : '—'}
        </span>
        {running ? (
          <span className="flex items-center gap-1.5 text-[11px] text-electric-300">
            <Pause className="size-3 animate-pulse" aria-hidden="true" />
            {t('lab.runtime')}
          </span>
        ) : null}
      </div>

      <Dialog
        open={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        title={t('projects.create')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveAsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void saveAs(projectName).then((ok) => {
                  if (ok) {
                    setSaveAsOpen(false)
                    setProjectName('')
                  }
                })
              }}
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <Field label={t('common.rename')} required>
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            className="dl-surface-input"
            placeholder="Mi proyecto"
            autoFocus
          />
        </Field>
      </Dialog>
    </div>
  )
}
