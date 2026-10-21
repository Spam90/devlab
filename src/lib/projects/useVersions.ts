'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { deleteLocalVersion, listLocalVersions, saveLocalVersion, type LocalVersion } from './local'
import { deleteVersion, listVersions, saveVersion } from './remote'
import type { ProjectVersionRow } from '@/lib/supabase/types'

export interface VersionItem {
  id: string
  versionNumber: number
  code: string
  label: string | null
  createdAt: string
}

function fromRow(row: ProjectVersionRow): VersionItem {
  return {
    id: row.id,
    versionNumber: row.version_number,
    code: row.code,
    label: row.label,
    createdAt: row.created_at,
  }
}

function fromLocal(version: LocalVersion): VersionItem {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    code: version.code,
    label: version.label,
    createdAt: version.createdAt,
  }
}

/** Historial de versiones de un proyecto (local o remoto). */
export function useVersions(projectId: string | null) {
  const { user, configured } = useAuth()
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [loading, setLoading] = useState(false)

  const isAuthenticated = Boolean(user) && configured

  const refresh = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setVersions([])
      return
    }
    setLoading(true)
    try {
      if (isAuthenticated) {
        const rows = await listVersions(projectId)
        setVersions(rows.map(fromRow))
      } else {
        setVersions(listLocalVersions(projectId).map(fromLocal))
      }
    } catch {
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [projectId, isAuthenticated])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      await Promise.resolve()
      if (cancelled) return
      await refresh()
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const save = useCallback(
    async (code: string, label?: string): Promise<void> => {
      if (!projectId) return
      if (isAuthenticated) {
        await saveVersion({ projectId, code, label })
      } else {
        saveLocalVersion(projectId, code, label)
      }
      await refresh()
    },
    [projectId, isAuthenticated, refresh],
  )

  const remove = useCallback(
    async (versionId: string): Promise<void> => {
      if (!projectId) return
      if (isAuthenticated) {
        await deleteVersion(versionId)
      } else {
        deleteLocalVersion(projectId, versionId)
      }
      await refresh()
    },
    [projectId, isAuthenticated, refresh],
  )

  return { versions, loading, save, remove, refresh }
}
