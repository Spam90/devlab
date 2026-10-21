import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'error'

const TONES: Record<Tone, string> = {
  neutral: 'border-line bg-carbon-800 text-ink-300',
  accent: 'border-electric-500/40 bg-electric-500/10 text-electric-200',
  ok: 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
  warn: 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn',
  error: 'border-signal-error/40 bg-signal-error/10 text-signal-error',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
