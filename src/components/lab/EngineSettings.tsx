'use client'

import { RotateCcw } from 'lucide-react'
import { useLab } from '@/lib/lab/LabProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Button } from '@/components/ui/Button'

/**
 * Ajustes del motor de ejecución.
 *
 * Los límites protegen el navegador frente a bucles infinitos o programas
 * desmedidos, y son configurables por el usuario.
 */
export function EngineSettings() {
  const { limits, setLimits } = useLab()
  const { t } = useI18n()

  const fields = [
    {
      key: 'maxSteps' as const,
      label: t('settings.maxSteps'),
      min: 100,
      max: 200_000,
      step: 100,
    },
    {
      key: 'maxInstructions' as const,
      label: t('settings.maxInstructions'),
      min: 1_000,
      max: 20_000_000,
      step: 1_000,
    },
    {
      key: 'maxCallDepth' as const,
      label: t('settings.maxCallDepth'),
      min: 1,
      max: 512,
      step: 1,
    },
    {
      key: 'maxOutputBytes' as const,
      label: t('settings.maxOutputBytes'),
      min: 1_000,
      max: 5_000_000,
      step: 1_000,
    },
    {
      key: 'timeoutMs' as const,
      label: t('settings.timeout'),
      min: 500,
      max: 60_000,
      step: 500,
    },
  ]

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-ink-500">{t('settings.limitsHint')}</p>

      <div className="grid grid-cols-2 gap-2">
        {fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1">
            <span className="text-[10px] font-medium tracking-wide text-ink-500 uppercase">
              {field.label}
            </span>
            <input
              type="number"
              className="dl-surface-input dl-mono h-7 px-2 text-[11px]"
              value={limits[field.key]}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (!Number.isFinite(parsed)) return
                setLimits({
                  [field.key]: Math.min(field.max, Math.max(field.min, parsed)),
                })
              }}
            />
          </label>
        ))}
      </div>

      <Button
        size="sm"
        variant="ghost"
        icon={<RotateCcw className="size-3.5" aria-hidden="true" />}
        onClick={() =>
          setLimits({
            maxSteps: 20_000,
            maxInstructions: 2_000_000,
            maxCallDepth: 64,
            maxListLength: 5_000,
            maxOutputBytes: 200_000,
            timeoutMs: 5_000,
            maxSourceLength: 100_000,
          })
        }
      >
        {t('settings.resetLimits')}
      </Button>

      <div className="border-t border-line pt-2">
        <p className="text-[10px] font-medium tracking-wide text-ink-500 uppercase">
          {t('lab.shortcutsTitle')}
        </p>
        <ul className="mt-1 space-y-0.5 text-[11px] text-ink-400">
          <Shortcut keys="Ctrl/⌘ + Enter" label={t('lab.run')} />
          <Shortcut keys="F10" label={t('lab.stepForward')} />
          <Shortcut keys="Shift + F10" label={t('lab.stepBackward')} />
          <Shortcut keys="Ctrl/⌘ + S" label={t('common.save')} />
        </ul>
      </div>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <kbd className="dl-mono rounded border border-line bg-carbon-950 px-1 py-0.5 text-[10px] text-ink-300">
        {keys}
      </kbd>
    </li>
  )
}
