'use client'

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { cn } from '@/lib/utils/cn'

interface PanelProps {
  title: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** Permite plegar el panel para ganar espacio en pantallas pequeñas. */
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  collapsible = false,
  defaultCollapsed = false,
}: PanelProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const bodyId = useId()
  const accessibleName = typeof title === 'string' ? title : undefined

  return (
    <section
      className={cn('dl-panel flex min-h-0 flex-col overflow-hidden', className)}
      aria-label={accessibleName}
    >
      <header className="dl-panel-header shrink-0">
        <div className="dl-panel-title">
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              aria-label={collapsed ? t('common.expand') : t('common.collapse')}
              title={collapsed ? t('common.expand') : t('common.collapse')}
              className="rounded p-1 text-ink-400 transition-colors hover:bg-carbon-800 hover:text-ink-100"
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-200',
                  collapsed && '-rotate-90',
                )}
                aria-hidden="true"
              />
            </button>
          ) : null}
        </div>
      </header>
      {!collapsed ? (
        <div id={bodyId} className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
