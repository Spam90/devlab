'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Configuración del asistente de IA en el navegador.
 *
 * La clave de API se guarda SOLO en `sessionStorage`: desaparece al cerrar
 * la pestana y nunca se envia a ningun sitio que no sea el proveedor
 * configurado por el usuario. No se persiste en Supabase ni en el
 * almacenamiento permanente.
 */

export interface AiSessionConfig {
  enabled: boolean
  baseUrl: string
  model: string
  apiKey: string
}

const STORAGE_KEY = 'devlab.ai.session'

const DEFAULT_CONFIG: AiSessionConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
}

function read(): AiSessionConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_CONFIG
    const candidate = parsed as Partial<AiSessionConfig>
    return {
      enabled: Boolean(candidate.enabled),
      baseUrl: typeof candidate.baseUrl === 'string' ? candidate.baseUrl : DEFAULT_CONFIG.baseUrl,
      model: typeof candidate.model === 'string' ? candidate.model : DEFAULT_CONFIG.model,
      apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : '',
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function useAiConfig() {
  const [config, setConfig] = useState<AiSessionConfig>(DEFAULT_CONFIG)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const restore = async (): Promise<void> => {
      await Promise.resolve()
      if (cancelled) return
      setConfig(read())
      setReady(true)
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<AiSessionConfig>) => {
    setConfig((current) => {
      const next = { ...current, ...patch }
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Sin sessionStorage la configuración solo vive en memoria.
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // sin persistencia no hay nada que borrar
    }
  }, [])

  return { config, update, clear, ready }
}
