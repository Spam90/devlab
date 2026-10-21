'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Boxes,
  FlaskConical,
  GitCompareArrows,
  Globe,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Settings,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'

const NAV_ITEMS = [
  { href: '/', key: 'lab', icon: FlaskConical },
  { href: '/examples', key: 'examples', icon: LayoutGrid },
  { href: '/compare', key: 'compare', icon: GitCompareArrows },
  { href: '/projects', key: 'projects', icon: Boxes },
  { href: '/settings', key: 'settings', icon: Settings },
] as const

export function AppHeader() {
  const { t, locale, setLocale } = useI18n()
  const { user, configured, signOut } = useAuth()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-carbon-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-3 sm:px-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-carbon-900"
        >
          <span className="grid size-7 place-items-center rounded-md border border-electric-500/40 bg-electric-500/15">
            <FlaskConical className="size-4 text-electric-300" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink-100">
            {t('common.appName')}
          </span>
        </Link>

        <nav aria-label={t('a11y.navigation')} className="hidden md:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-carbon-800 text-ink-100 shadow-[inset_0_0_0_1px_rgba(58,103,245,0.35)]'
                        : 'text-ink-400 hover:bg-carbon-900 hover:text-ink-100',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1 sm:flex">
            <Globe className="size-3.5 text-ink-500" aria-hidden="true" />
            <select
              aria-label={t('nav.language')}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="h-8 rounded-md border border-line bg-carbon-950 px-2 text-xs text-ink-200 transition-colors hover:border-line-strong focus:border-electric-500 focus:outline-none"
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_LABELS[code]}
                </option>
              ))}
            </select>
          </div>

          {configured && user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void signOut()
              }}
              icon={<LogOut className="size-3.5" aria-hidden="true" />}
            >
              <span className="hidden sm:inline">{t('nav.signOut')}</span>
            </Button>
          ) : (
            <Link href="/auth/sign-in">
              <Button
                variant="secondary"
                size="sm"
                icon={<LogIn className="size-3.5" aria-hidden="true" />}
              >
                <span className="hidden sm:inline">{t('nav.signIn')}</span>
              </Button>
            </Link>
          )}

          <IconButton
            label={t('nav.openMenu')}
            className="md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <Menu className="size-4" aria-hidden="true" />
            ) : (
              <Menu className="size-4" aria-hidden="true" />
            )}
          </IconButton>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-line bg-carbon-900 md:hidden">
          <ul className="flex flex-col p-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                      active ? 'bg-carbon-800 text-ink-100' : 'text-ink-300',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              )
            })}
            <li className="mt-2 flex items-center justify-between border-t border-line px-3 pt-2">
              <span className="text-xs text-ink-400">{t('nav.language')}</span>
              <div className="flex gap-1">
                {LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    className={cn(
                      'rounded px-2 py-1 text-xs',
                      locale === code
                        ? 'bg-electric-500/20 text-electric-200'
                        : 'text-ink-400',
                    )}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  )
}
