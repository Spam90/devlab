'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
  error?: string | null
  className?: string
  /** Tipo de dato del campo (para las etiquetas de accesibilidad). */
  type?: string
  required?: boolean
}

/** Campo de formulario con etiqueta, ayuda y error asociados. */
export function Field({
  label,
  children,
  hint,
  error,
  className,
  type,
  required,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-xs font-medium text-ink-300">
        {label}
        {required ? <span className="ml-0.5 text-signal-error">*</span> : null}
        {type ? <span className="sr-only"> ({type})</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-ink-500">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-[11px] text-signal-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
