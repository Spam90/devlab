'use client'

import { forwardRef, useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hideLabel?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, className, children, id, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label ? (
        <label
          htmlFor={selectId}
          className={cn(
            'text-xs font-medium text-ink-400',
            hideLabel && 'sr-only',
          )}
        >
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'h-8 w-full appearance-none rounded-md border border-line bg-carbon-950 px-2 pr-7 text-xs text-ink-100',
          'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\' fill=\'%236b7486\'%3E%3Cpath d=\'M4.5 6.5 8 10l3.5-3.5z\'/%3E%3C/svg%3E")] bg-[length:14px] bg-[position:right_4px_center] bg-no-repeat',
          'transition-colors hover:border-line-strong focus:border-electric-500 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
})
