import type { EngineId } from '@/lib/interpreter/capabilities'

/**
 * Gestion de proyectos en el navegador (modo invitado).
 *
 * Los datos se guardan en `localStorage`, nunca en el servidor. Al iniciar
 * sesión se ofrece la importación explícita a la cuenta del usuario.
 */

export interface LocalProject {
  id: string
  name: string
  source: string
  engine: EngineId
  createdAt: string
  updatedAt: string
  /** Marca los proyectos que aún no se han importado a una cuenta. */
  imported: boolean
}

const STORAGE_KEY = 'devlab.projects.v1'
const MAX_PROJECTS = 50
export const MAX_SOURCE_LENGTH = 100_000

function readRaw(): LocalProject[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isLocalProject)
  } catch {
    return []
  }
}

function isLocalProject(value: unknown): value is LocalProject {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<LocalProject>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.source === 'string' &&
    (candidate.engine === 'devlab' || candidate.engine === 'pyodide')
  )
}

function writeRaw(projects: LocalProject[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch {
    // Cuota superada o almacenamiento no disponible: se ignora en silencio
    // porque el laboratorio debe seguir siendo utilizable sin persistencia.
  }
}

export function listLocalProjects(): LocalProject[] {
  return readRaw().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getLocalProject(id: string): LocalProject | null {
  return readRaw().find((project) => project.id === id) ?? null
}

export function countLocalProjects(): number {
  return readRaw().length
}

export function createLocalProject(input: {
  name: string
  source: string
  engine?: EngineId
}): LocalProject {
  const now = new Date().toISOString()
  const project: LocalProject = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Proyecto sin titulo',
    source: input.source.slice(0, MAX_SOURCE_LENGTH),
    engine: input.engine ?? 'devlab',
    createdAt: now,
    updatedAt: now,
    imported: false,
  }
  const projects = readRaw()
  projects.push(project)
  writeRaw(projects.slice(-MAX_PROJECTS))
  return project
}

export function updateLocalProject(
  id: string,
  patch: Partial<Pick<LocalProject, 'name' | 'source' | 'engine' | 'imported'>>,
): LocalProject | null {
  const projects = readRaw()
  const index = projects.findIndex((project) => project.id === id)
  if (index === -1) return null
  const current = projects[index]
  if (!current) return null
  const next: LocalProject = {
    ...current,
    ...patch,
    source:
      patch.source !== undefined
        ? patch.source.slice(0, MAX_SOURCE_LENGTH)
        : current.source,
    updatedAt: new Date().toISOString(),
  }
  projects[index] = next
  writeRaw(projects)
  return next
}

export function deleteLocalProject(id: string): boolean {
  const projects = readRaw()
  const next = projects.filter((project) => project.id !== id)
  if (next.length === projects.length) return false
  writeRaw(next)
  return true
}

export function duplicateLocalProject(id: string): LocalProject | null {
  const original = getLocalProject(id)
  if (!original) return null
  return createLocalProject({
    name: `${original.name} (copia)`,
    source: original.source,
    engine: original.engine,
  })
}

/**
 * Elimina de forma definitiva los proyectos locales ya importados.
 *
 * Solo se llama tras confirmar que la importación fue correcta: los datos
 * locales no se borran antes de tiempo.
 */
export function removeImportedProjects(ids: string[]): number {
  const projects = readRaw()
  const targets = new Set(ids)
  const remaining = projects.filter(
    (project) => !(targets.has(project.id) && project.imported),
  )
  const removed = projects.length - remaining.length
  writeRaw(remaining)
  return removed
}

// ---------------------------------------------------------------------------
// Versiones locales
// ---------------------------------------------------------------------------

export interface LocalVersion {
  id: string
  projectId: string
  versionNumber: number
  code: string
  label: string | null
  createdAt: string
}

const VERSIONS_KEY = 'devlab.versions.v1'
export const MAX_VERSIONS = 30

function readVersions(): Record<string, LocalVersion[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(VERSIONS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Record<string, LocalVersion[]>
  } catch {
    return {}
  }
}

function writeVersions(versions: Record<string, LocalVersion[]>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions))
  } catch {
    // Sin persistencia no se rompen las versiones ya cargadas en memoria.
  }
}

export function listLocalVersions(projectId: string): LocalVersion[] {
  return (readVersions()[projectId] ?? []).sort((a, b) => b.versionNumber - a.versionNumber)
}

export function saveLocalVersion(
  projectId: string,
  code: string,
  label?: string,
): LocalVersion {
  const all = readVersions()
  const current = all[projectId] ?? []
  const version: LocalVersion = {
    id: crypto.randomUUID(),
    projectId,
    versionNumber: current.reduce((max, item) => Math.max(max, item.versionNumber), 0) + 1,
    code: code.slice(0, MAX_SOURCE_LENGTH),
    label: label ?? null,
    createdAt: new Date().toISOString(),
  }
  all[projectId] = [version, ...current].slice(0, MAX_VERSIONS)
  writeVersions(all)
  return version
}

export function deleteLocalVersion(projectId: string, versionId: string): void {
  const all = readVersions()
  all[projectId] = (all[projectId] ?? []).filter((version) => version.id !== versionId)
  writeVersions(all)
}
