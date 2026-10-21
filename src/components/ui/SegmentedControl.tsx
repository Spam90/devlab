'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
  title?: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Grupo de opciones excluyentes (tipo pestañas).
 *
 * Implementa el patron `radiogroup` para que sea navegable con teclado y
 * announced correctamente por los lectores de pantalla.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-carbon-950 p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-[6px] font-medium transition-colors duration-150',
              'disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
              active
                ? 'bg-electric-500/20 text-electric-100 shadow-[inset_0_0_0_1px_rgba(58,103,245,0.5)]'
                : 'text-ink-400 hover:bg-carbon-800 hover:text-ink-100',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
