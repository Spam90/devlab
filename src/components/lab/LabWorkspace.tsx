'use client'

import { useEffect, useState } from 'react'
import { FileCode2, History, Layers, SlidersHorizontal, Terminal } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { CodeEditor } from './CodeEditor'
import { ConsolePanel } from './ConsolePanel'
import { VariablesPanel } from './VariablesPanel'
import { CallStackPanel } from './CallStackPanel'
import { HistoryPanel } from './HistoryPanel'
import { EngineSelector } from './EngineSelector'
import { Toolbar } from './Toolbar'
import { EngineSettings } from './EngineSettings'
import { AiPanel } from './AiPanel'
import { Panel } from '@/components/ui/Panel'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils/cn'

type MobileView = 'editor' | 'state' | 'console' | 'history'

/**
 * Espacio de trabajo del laboratorio.
 *
 * En pantallas grandes se usan dos columnas: editor y consola a la
 * izquierda, inspección a la derecha. En movil se alterna entre vistas
 * apiladas para no reducir la interfaz de escritorio hasta hacerla ilegible.
 */
export function LabWorkspace() {
  const { source, setSource, currentStep, engine, run, stepForward, stepBackward, save, dirty } =
    useLab()
  const { t } = useI18n()
  const [view, setView] = useState<MobileView>('editor')

  // Atajos de teclado del laboratorio.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const isEditing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true
      const meta = event.ctrlKey || event.metaKey

      if (meta && event.key === 'Enter') {
        event.preventDefault()
        void run()
        return
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
        return
      }
      if (isEditing) return
      if (event.key === 'F10') {
        event.preventDefault()
        if (event.shiftKey) {
          stepBackward()
        } else {
          stepForward()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [run, stepForward, stepBackward, save])

  // Aviso al salir de la página con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      {/* --- Barra de contexto ------------------------------------------ */}
      <div className="dl-panel flex flex-wrap items-center gap-3 px-3 py-2">
        <EngineSelector />
        <Toolbar />
      </div>

      {/* --- Selector de vista (movil) ---------------------------------- */}
      <div className="lg:hidden">
        <SegmentedControl<MobileView>
          value={view}
          onChange={setView}
          label={t('lab.title')}
          options={[
            { value: 'editor', label: t('lab.editorPanel') },
            { value: 'state', label: t('lab.statePanel') },
            { value: 'console', label: t('lab.consolePanel') },
            { value: 'history', label: t('lab.historyPanel') },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)_220px]">
        {/* --- Editor ---------------------------------------------------- */}
        <div
          className={cn(
            'min-h-0',
            view === 'editor' ? 'flex' : 'hidden',
            'lg:flex lg:row-span-1 lg:flex-col',
          )}
        >
          <Panel
            title={t('lab.editorPanel')}
            icon={<FileCode2 className="size-3.5" aria-hidden="true" />}
            className="flex min-h-0 w-full flex-1 flex-col"
            bodyClassName="min-h-0 flex-1"
            collapsible
          >
            <CodeEditor
              value={source}
              onChange={setSource}
              highlightLine={engine === 'devlab' ? (currentStep?.line ?? null) : null}
              ariaLabel={t('a11y.codeEditor')}
              placeholder={t('lab.editorPlaceholder')}
            />
          </Panel>
        </div>

        {/* --- Consola ---------------------------------------------------- */}
        <div
          className={cn(
            'min-h-0',
            view === 'console' ? 'flex' : 'hidden',
            'lg:flex lg:row-span-1 lg:flex-col',
          )}
        >
          <ConsolePanel />
        </div>

        {/* --- Columna de inspeccion -------------------------------------- */}
        <div
          className={cn(
            'min-h-0 flex-col gap-3 lg:row-span-2 lg:flex',
            view === 'state' || view === 'history' ? 'flex' : 'hidden',
          )}
        >
          <div className="dl-panel shrink-0 px-3 py-2">
            <div className="dl-panel-title mb-2">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              {t('lab.settingsPanel')}
            </div>
            <EngineSettings />
          </div>

          <div
            className={cn(
              'min-h-0 flex-1 flex-col gap-3',
              view === 'state' ? 'flex' : 'hidden',
              'lg:flex',
            )}
          >
            <div className="grid min-h-0 flex-1 grid-rows-2 gap-3">
              <VariablesPanel />
              <CallStackPanel />
            </div>
          </div>

          <div
            className={cn(
              'min-h-0 flex-1 flex-col gap-3',
              view === 'history' ? 'flex' : 'hidden',
              'lg:flex',
            )}
          >
            <HistoryPanel />
            <AiPanel />
          </div>
        </div>
      </div>

      {/* Iconos decorativos accesibles (sin significado propio) */}
      <div className="sr-only" aria-hidden="true">
        <Terminal />
        <History />
        <Layers />
      </div>
    </div>
  )
}
