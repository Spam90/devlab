'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_LOCALE,
  LOCALES,
  translate,
} from './index'
import type { Locale } from './index'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'devlab.locale'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, variables?: Record<string, string | number>) => string
  ready: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (LOCALES as string[]).includes(value)
}

function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isLocale(stored)) return stored
  const browser = window.navigator.language.slice(0, 2)
  if (isLocale(browser)) return browser
  return DEFAULT_LOCALE
}

/**
 * Proveedor de idioma.
 *
 * - Persiste la preferencia en `localStorage` (invitados y usuarios).
 * - Sincroniza la preferencia con `user_settings` cuando hay sesión.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [ready, setReady] = useState(false)
  const syncedLocale = useRef<Locale | null>(null)

  useEffect(() => {
    // Se cede el hilo antes de leer el almacenamiento para no provocar un
    // render en cascada al montar.
    void Promise.resolve().then(() => {
      setLocaleState(detectLocale())
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale, ready])

  // Carga la preferencia del usuario autenticado y la guarda al cambiarla.
  useEffect(() => {
    if (!ready) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    let cancelled = false

    const load = async (): Promise<void> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        syncedLocale.current = null
        return
      }
      const { data } = await supabase
        .from('user_settings')
        .select('locale')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      const stored = data?.locale
      if (isLocale(stored)) {
        syncedLocale.current = stored
        setLocaleState(stored)
      } else {
        syncedLocale.current = locale
      }
    }

    void load()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void load()
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
    // El locale se intentiona no forma parte de las dependencias: la carga
    // inicial define el valor y los cambios posteriores se guardan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    let cancelled = false

    const persist = async (): Promise<void> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return
      if (syncedLocale.current === locale) return
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, locale }, { onConflict: 'user_id' })
      syncedLocale.current = locale
    }

    const timer = window.setTimeout(() => {
      void persist()
    }, 600)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [locale, ready])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
  }, [])

  const t = useCallback(
    (key: string, variables?: Record<string, string | number>) =>
      translate(locale, key, variables),
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n debe usarse dentro de <I18nProvider>')
  }
  return context
}
