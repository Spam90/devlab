'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

interface AuthContextValue {
  user: User | null
  loading: boolean
  configured: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Estado de sesión en el cliente.
 *
 * Si Supabase no está configurado, `configured` es `false` y la aplicación
 * funciona en modo invitado sin lanzar excepciones.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      await Promise.resolve()
      setUser(null)
      setLoading(false)
      return
    }
    const {
      data: { user: current },
    } = await supabase.auth.getUser()
    setUser(current)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!configured) {
      // Se cede el hilo para no provocar un render en cascada al montar.
      void Promise.resolve().then(() => setLoading(false))
      return
    }
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      void Promise.resolve().then(() => setLoading(false))
      return
    }
    // Lectura de la sesión al montar: es el uso previsto de un efecto. La
    // regla `set-state-in-effect` es deliberadamente estricta y no distingue
    // entre un `setState` de renderizado y uno posterior a una petición.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [configured, refresh])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured, signOut, refresh }),
    [user, loading, configured, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}
