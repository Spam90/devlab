'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  countLocalProjects,
  createLocalProject,
  deleteLocalProject,
  duplicateLocalProject,
  listLocalProjects,
  removeImportedProjects,
  updateLocalProject,
} from './local'
import type { LocalProject } from './local'
import {
  createProject as createRemoteProject,
  deleteProject as deleteRemoteProject,
  listProjects,
  updateProject as updateRemoteProject,
} from './remote'
import type { EngineId } from '@/lib/interpreter/capabilities'

export type SyncState = 'local' | 'synced' | 'pending' | 'error'

export interface ProjectItem {
  id: string
  name: string
  source: string
  engine: EngineId
  createdAt: string
  updatedAt: string
  syncState: SyncState
  /** Identificador del proyecto en Supabase (si está sincronizado). */
  remoteId?: string
  error?: string
}

export interface ImportSummary {
  imported: number
  failed: number
  total: number
}

/**
 * Gestion de proyectos para invitados y usuarios autenticados.
 *
 * - Invitado: los proyectos viven en `localStorage`.
 * - Autenticado: los proyectos viven en Supabase y la autorización la
 *   aplican las politicas RLS.
 */
export function useProjects() {
  const { user, configured } = useAuth()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = Boolean(user) && configured

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      if (isAuthenticated) {
        const rows = await listProjects()
        setProjects(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            source: row.code,
            engine: row.engine,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            syncState: 'synced',
            remoteId: row.id,
          })),
        )
      } else {
        setProjects(
          listLocalProjects().map((project) => ({
            id: project.id,
            name: project.name,
            source: project.source,
            engine: project.engine,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            syncState: 'local',
          })),
        )
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al cargar los proyectos.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

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

  const create = useCallback(
    async (input: { name: string; source: string; engine?: EngineId }): Promise<ProjectItem> => {
      if (isAuthenticated) {
        const row = await createRemoteProject({
          name: input.name,
          code: input.source,
          engine: input.engine ?? 'devlab',
        })
        const item: ProjectItem = {
          id: row.id,
          name: row.name,
          source: row.code,
          engine: row.engine,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          syncState: 'synced',
          remoteId: row.id,
        }
        setProjects((current) => [item, ...current])
        return item
      }
      const local = createLocalProject(input)
      const item: ProjectItem = {
        id: local.id,
        name: local.name,
        source: local.source,
        engine: local.engine,
        createdAt: local.createdAt,
        updatedAt: local.updatedAt,
        syncState: 'local',
      }
      setProjects((current) => [item, ...current])
      return item
    },
    [isAuthenticated],
  )

  const rename = useCallback(
    async (id: string, name: string): Promise<void> => {
      if (isAuthenticated) {
        await updateRemoteProject(id, { name })
      } else {
        updateLocalProject(id, { name })
      }
      await refresh()
    },
    [isAuthenticated, refresh],
  )

  const saveSource = useCallback(
    async (id: string, source: string): Promise<void> => {
      if (isAuthenticated) {
        await updateRemoteProject(id, { code: source })
      } else {
        updateLocalProject(id, { source })
      }
      setProjects((current) =>
        current.map((project) =>
          project.id === id
            ? { ...project, source, updatedAt: new Date().toISOString() }
            : project,
        ),
      )
    },
    [isAuthenticated],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (isAuthenticated) {
        await deleteRemoteProject(id)
      } else {
        deleteLocalProject(id)
      }
      setProjects((current) => current.filter((project) => project.id !== id))
    },
    [isAuthenticated],
  )

  const duplicate = useCallback(
    async (id: string): Promise<void> => {
      if (isAuthenticated) {
        const original = projects.find((project) => project.id === id)
        if (!original) return
        await createRemoteProject({
          name: `${original.name} (copia)`,
          code: original.source,
          engine: original.engine,
        })
      } else {
        duplicateLocalProject(id)
      }
      await refresh()
    },
    [isAuthenticated, projects, refresh],
  )

  /**
   * Importa los proyectos locales a la cuenta del usuario.
   *
   * Los originales NO se borran hasta que la importación termina bien: si
   * algo falla, el trabajo local sigue intacto.
   */
  const importGuestProjects = useCallback(async (): Promise<ImportSummary> => {
    const locals = listLocalProjects()
    if (locals.length === 0) return { imported: 0, failed: 0, total: 0 }

    const response = await fetch('/api/projects/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projects: locals.map((project: LocalProject) => ({
          name: project.name,
          code: project.source,
          engine: project.engine,
        })),
        existingNames: projects.map((project) => project.name),
      }),
    })

    if (!response.ok) {
      throw new Error('No se ha podido completar la importacion.')
    }

    const payload = (await response.json()) as {
      inserted: { id: string; name: string }[]
      failed: { name: string; reason: string }[]
    }

    const importedIds = locals
      .filter((project) =>
        payload.inserted.some((row) => row.name.startsWith(project.name)),
      )
      .map((project) => project.id)

    if (payload.failed.length === 0) {
      removeImportedProjects(importedIds)
    } else {
      for (const project of locals) {
        if (importedIds.includes(project.id)) {
          updateLocalProject(project.id, { imported: true })
        }
      }
    }

    await refresh()

    return {
      imported: payload.inserted.length,
      failed: payload.failed.length,
      total: locals.length,
    }
  }, [projects, refresh])

  // Se calcula en cada render: leer `localStorage` es barato y así el valor
  // se actualiza en cuanto cambia la lista de proyectos.
  const guestProjectCount = isAuthenticated ? countLocalProjects() : 0

  return {
    projects,
    loading,
    error,
    isAuthenticated,
    refresh,
    create,
    rename,
    saveSource,
    remove,
    duplicate,
    importGuestProjects,
    guestProjectCount,
  }
}
