'use client'

import { Children, cloneElement, isValidElement, useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
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

/**
 * Campo de formulario con etiqueta, ayuda y error asociados.
 *
 * La etiqueta se vincula al control con `htmlFor`/`id` (asociación
 * explícita), de modo que el lector de pantalla la anuncie, el clic en el
 * texto enfoque el control y las pruebas puedan localizarlo por su nombre
 * accesible.
 */
export function Field({
  label,
  children,
  hint,
  error,
  className,
  type,
  required,
}: FieldProps) {
  const controlId = useId()
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ')

  const control = Children.map(children, (child) => {
    if (!isValidElement(child)) return child
    const props = child.props as { id?: string; 'aria-describedby'?: string }
    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      id: props.id ?? controlId,
      'aria-describedby': [props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
    })
  })

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={controlId} className="text-xs font-medium text-ink-300">
        {label}
        {required ? (
          <span className="ml-0.5 text-signal-error" aria-hidden="true">
            *
          </span>
        ) : null}
        {type ? <span className="sr-only"> ({type})</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-[11px] text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] text-signal-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
