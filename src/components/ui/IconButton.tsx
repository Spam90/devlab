'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Etiqueta accesible obligatoria (los botones de icono no muestran texto). */
  label: string
  tone?: 'default' | 'accent' | 'danger'
  size?: 'sm' | 'md'
}

const TONES = {
  default: 'text-ink-300 hover:text-ink-100 hover:bg-carbon-800',
  accent: 'text-electric-300 hover:text-electric-200 hover:bg-electric-500/15',
  danger: 'text-ink-400 hover:text-signal-error hover:bg-signal-error/10',
} as const

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, tone = 'default', size = 'md', className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={props.type ?? 'button'}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex items-center justify-center rounded-md transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-40',
          size === 'sm' ? 'size-7' : 'size-8',
          TONES[tone],
          className,
        )}
        {...props}
      />
    )
  },
)
