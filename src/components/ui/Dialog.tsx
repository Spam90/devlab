'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { IconButton } from './IconButton'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  closeLabel: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-carbon-950/80 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'dl-fade-in dl-panel relative z-10 w-full max-w-lg outline-none',
          'rounded-b-none sm:rounded-b-[var(--radius-panel)]',
        )}
      >
        <header className="dl-panel-header">
          <div>
            <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-ink-400">{description}</p>
            ) : null}
          </div>
          <IconButton label={closeLabel} onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </header>
        {children ? <div className="px-4 py-4">{children}</div> : null}
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
