'use client'

import { useEffect } from 'react'
import { useLab } from '@/lib/lab/LabProvider'
import { consumePendingSource } from '@/lib/lab/pendingSource'

/**
 * Carga el código pendiente (por ejemplo, desde la galeria de ejemplos) en
 * el laboratorio una vez montado el proveedor.
 */
export function LabBootstrap() {
  const { setSource, setEngine, openProject } = useLab()

  useEffect(() => {
    const pending = consumePendingSource()
    if (!pending) return
    if (pending.engine) setEngine(pending.engine)
    setSource(pending.source)
    if (pending.projectId) {
      openProject({
        id: pending.projectId,
        name: pending.name ?? 'Proyecto',
        remoteId: pending.remoteId,
        savedSource: pending.savedSource ?? pending.source,
      })
    }
  }, [setSource, setEngine, openProject])

  return null
}
