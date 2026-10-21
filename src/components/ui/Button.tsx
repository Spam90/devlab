'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-electric-500 text-white hover:bg-electric-400 active:bg-electric-600 shadow-[0_6px_20px_-10px_rgba(58,103,245,0.9)]',
  secondary:
    'bg-carbon-800 text-ink-100 border border-line-strong hover:bg-carbon-700 hover:border-electric-500/40',
  ghost: 'bg-transparent text-ink-300 hover:bg-carbon-800 hover:text-ink-100',
  danger: 'bg-transparent text-signal-error border border-signal-error/40 hover:bg-signal-error/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', icon, loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-3.5" /> : icon}
      {children}
    </button>
  )
})
