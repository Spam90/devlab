'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, GraduationCap, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Button } from '@/components/ui/Button'

const STORAGE_KEY = 'devlab.tour.completed'

/**
 * Recorrido inicial de bienvenida.
 *
 * Se muestra una sola vez por navegador, se puede omitir y se puede volver
 * a consultar desde la galeria de ejemplos.
 */
export function OnboardingTour({ forceOpen = false }: { forceOpen?: boolean }) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const evaluate = async (): Promise<void> => {
      // Se cede el hilo antes de tocar el estado para no provocar un render
      // en cascada al montar.
      await Promise.resolve()
      if (cancelled) return
      if (forceOpen) {
        setOpen(true)
        setStep(0)
        return
      }
      try {
        const completed = window.localStorage.getItem(STORAGE_KEY)
        if (!completed) setOpen(true)
      } catch {
        setOpen(true)
      }
    }
    void evaluate()
    return () => {
      cancelled = true
    }
  }, [forceOpen])

  const steps = [
    { title: t('examples.tutorialTitle'), body: t('examples.tutorialStep1') },
    { title: t('lab.historyPanel'), body: t('examples.tutorialStep2') },
    { title: t('lab.editorPanel'), body: t('examples.tutorialStep3') },
  ]

  const close = (): void => {
    setOpen(false)
    // Omitir tambien marca el recorrido como visto: no vuelve aaparecer
    // sola (se puede volver a abrir desde la galeria de ejemplos).
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Sin almacenamiento el recorrido se mostrara de nuevo.
    }
  }

  if (!open) return null

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-carbon-950/85 backdrop-blur-[2px]" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('tour.title')}
        className="dl-fade-in dl-panel relative z-10 w-full max-w-md p-5"
      >
        <div className="flex items-center gap-2 text-electric-300">
          <GraduationCap className="size-4" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink-100">{t('tour.title')}</h2>
        </div>

        {current ? (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-ink-100">{current.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{current.body}</p>
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          <span className="dl-mono text-[11px] text-ink-500">
            {t('tour.step', { current: step + 1, total: steps.length })}
          </span>
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((_, index) => (
              <span
                key={index}
                className={
                  index === step
                    ? 'h-1 w-4 rounded-full bg-electric-500'
                    : 'h-1 w-1.5 rounded-full bg-carbon-600'
                }
              />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => close()}>
              {t('common.skip')}
            </Button>
            {step > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                {t('tour.previous')}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              icon={<ArrowRight className="size-3.5" aria-hidden="true" />}
              onClick={() => {
                if (isLast) {
                  close()
                  return
                }
                setStep((value) => value + 1)
              }}
            >
              {isLast ? t('examples.tutorialDone') : t('tour.next')}
            </Button>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-600">
          <Sparkles className="size-3" aria-hidden="true" />
          {t('tour.restart')}
        </p>
      </div>
    </div>
  )
}

/** Reinicia el recorrido para volver a mostrarlo. */
export function resetOnboardingTour(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sin almacenamiento no hay estado que reiniciar
  }
}
