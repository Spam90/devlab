import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type { ClassValue }

/** Combina clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
