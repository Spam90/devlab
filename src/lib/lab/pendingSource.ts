'use client'

/**
 * Código pendiente de cargar en el laboratorio.
 *
 * Permite pasar un programa desde otra página (ejemplos, comparación,
 * enlaces públicos) sin usar parámetros de URL, que limitarian el tamaño
 * del código y dejarian el fuente en el historial del navegador.
 */
const KEY = 'devlab.pendingSource'

export interface PendingSource {
  source: string
  engine?: 'devlab' | 'pyodide'
  name?: string
  /** Identificador del proyecto de origen (si la carga viene de /projects). */
  projectId?: string
  /** Identificador del proyecto en Supabase (si está sincronizado). */
  remoteId?: string
  /** Si el proyecto ya está guardado, el código de referencia. */
  savedSource?: string
}

export function setPendingSource(payload: PendingSource): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Si no hay almacenamiento disponible, la navegación seguira funcionando
    // aunque el ejemplo no se cargue automáticamente.
  }
}

export function consumePendingSource(): PendingSource | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(KEY)
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<PendingSource>
    if (typeof candidate.source !== 'string') return null
    return {
      source: candidate.source,
      engine: candidate.engine,
      name: candidate.name,
      projectId: candidate.projectId,
      remoteId: candidate.remoteId,
      savedSource: candidate.savedSource,
    }
  } catch {
    return null
  }
}
