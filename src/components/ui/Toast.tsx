'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { cn } from '@/lib/utils/cn'

type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
}

const TONES: Record<ToastTone, string> = {
  info: 'border-line-strong text-ink-100',
  success: 'border-signal-ok/50 text-signal-ok',
  error: 'border-signal-error/50 text-signal-error',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      counter.current += 1
      const id = counter.current
      setToasts((current) => [...current.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone]
          return (
            <div
              key={toast.id}
              className={cn(
                'dl-fade-in pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border bg-carbon-850 px-3 py-2 text-sm shadow-lg',
                TONES[toast.tone],
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-ink-100">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-ink-500 transition-colors hover:text-ink-100"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{t('common.close')}</span>
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return context
}
