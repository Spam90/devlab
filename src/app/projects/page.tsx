'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Boxes,
  Copy,
  Download,
  FolderOpen,
  History,
  Import,
  Pencil,
  Save,
  Search,
  Share2,
  Trash2,
} from 'lucide-react'
import { useProjects, type ProjectItem } from '@/lib/projects/useProjects'
import { useVersions } from '@/lib/projects/useVersions'
import { ShareManager } from '@/components/projects/ShareManager'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useAuth } from '@/lib/auth/AuthProvider'
import { setPendingSource } from '@/lib/lab/pendingSource'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils/cn'

export default function ProjectsPage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { notify } = useToast()
  const { user, configured } = useAuth()
  const {
    projects,
    loading,
    error,
    isAuthenticated,
    create,
    rename,
    remove,
    duplicate,
    importGuestProjects,
    guestProjectCount,
    refresh,
  } = useProjects()

  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProjectItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [importing, setImporting] = useState(false)

  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  )
  const { versions, save: saveVersion, remove: removeVersion } = useVersions(selectedId)

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return projects
    return projects.filter((project) => project.name.toLowerCase().includes(query))
  }, [projects, filter])

  const openInLab = (project: ProjectItem): void => {
    setPendingSource({
      source: project.source,
      engine: project.engine,
      name: project.name,
      projectId: project.id,
      remoteId: project.remoteId,
      savedSource: project.source,
    })
    router.push('/')
  }

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    try {
      const project = await create({ name, source: '# Nuevo proyecto\nprint("Hola")\n' })
      setNewName('')
      setCreating(false)
      setSelectedId(project.id)
      notify(t('common.saved'), 'success')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : t('errors.generic'), 'error')
    }
  }

  const handleRename = async (): Promise<void> => {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) return
    try {
      await rename(renameTarget.id, name)
      setRenameTarget(null)
      notify(t('common.saved'), 'success')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : t('errors.generic'), 'error')
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
      setDeleteTarget(null)
      notify(t('common.delete'), 'success')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : t('errors.generic'), 'error')
    }
  }

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const summary = await importGuestProjects()
      if (summary.imported === 0) {
        notify(t('projects.importGuestFailed'), 'error')
      } else if (summary.failed > 0) {
        notify(
          t('projects.importGuestPartial', { count: summary.imported, total: summary.total }),
          'error',
        )
      } else {
        notify(t('projects.importGuestDone', { count: summary.imported }), 'success')
      }
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : t('errors.generic'), 'error')
    } finally {
      setImporting(false)
    }
  }

  const syncBadge = (project: ProjectItem) => {
    const labels: Record<string, string> = {
      synced: t('projects.syncState.synced'),
      local: t('projects.syncState.local'),
      pending: t('projects.syncState.pending'),
      error: t('projects.syncState.error'),
    }
    const tones: Record<string, 'ok' | 'neutral' | 'warn' | 'error'> = {
      synced: 'ok',
      local: 'neutral',
      pending: 'warn',
      error: 'error',
    }
    return (
      <Badge tone={tones[project.syncState] ?? 'neutral'}>{labels[project.syncState]}</Badge>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-ink-100">
            <Boxes className="size-4 text-electric-400" aria-hidden="true" />
            {t('projects.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-400">{t('projects.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated && guestProjectCount > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              loading={importing}
              onClick={() => {
                void handleImport()
              }}
              icon={<Import className="size-3.5" aria-hidden="true" />}
            >
              {t('projects.importGuest')} ({guestProjectCount})
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            onClick={() => setCreating(true)}
            icon={<Save className="size-3.5" aria-hidden="true" />}
          >
            {t('projects.create')}
          </Button>
        </div>
      </header>

      {error ? (
        <p className="mb-4 rounded-md border border-signal-error/40 bg-signal-error/10 px-3 py-2 text-xs text-signal-error">
          {error}
        </p>
      ) : null}

      {isAuthenticated && guestProjectCount > 0 ? (
        <p className="mb-4 rounded-md border border-electric-500/30 bg-electric-500/5 px-3 py-2 text-xs text-ink-300">
          {t('projects.importGuestDescription', { count: guestProjectCount })}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Panel
          title={t('projects.title')}
          icon={<FolderOpen className="size-3.5" aria-hidden="true" />}
          bodyClassName="dl-scroll-thin max-h-[70vh]"
        >
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-600"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t('projects.filter')}
                aria-label={t('projects.filter')}
                className="dl-surface-input h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {loading ? (
            <p className="p-4 text-xs text-ink-500">{t('common.loading')}</p>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-ink-400">
                {projects.length === 0
                  ? isAuthenticated
                    ? t('projects.empty')
                    : t('projects.emptyGuest')
                  : t('common.empty')}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((project) => (
                <li
                  key={project.id}
                  className={cn(
                    'flex flex-wrap items-center gap-2 px-3 py-2.5 transition-colors',
                    selectedId === project.id ? 'bg-electric-500/5' : 'hover:bg-carbon-850',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm text-ink-100">{project.name}</span>
                    <span className="block truncate text-[11px] text-ink-500">
                      {t('projects.updatedAt', {
                        date: new Date(project.updatedAt).toLocaleString(locale),
                      })}
                    </span>
                  </button>
                  {syncBadge(project)}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openInLab(project)}
                    icon={<FolderOpen className="size-3.5" aria-hidden="true" />}
                  >
                    {t('projects.open')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenameTarget(project)
                      setRenameValue(project.name)
                    }}
                    aria-label={t('common.rename')}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void duplicate(project.id)
                    }}
                    aria-label={t('common.duplicate')}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(project)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={selected ? selected.name : t('projects.versions')}
          icon={<History className="size-3.5" aria-hidden="true" />}
          className="lg:sticky lg:top-20 lg:self-start"
        >
          {!selected ? (
            <p className="p-4 text-xs text-ink-500">{t('common.empty')}</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void saveVersion(selected.source)
                    }}
                    icon={<Download className="size-3.5" aria-hidden="true" />}
                  >
                    {t('projects.saveVersion')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void refresh()}>
                    {t('common.retry')}
                  </Button>
                </div>

                {versions.length === 0 ? (
                  <p className="text-xs text-ink-500">{t('projects.noVersions')}</p>
                ) : (
                  <ul className="space-y-2">
                    {versions.map((version) => (
                      <li
                        key={version.id}
                        className="flex items-center gap-2 rounded-md border border-line bg-carbon-900 px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="dl-mono truncate text-[11px] text-ink-200">
                            {t('projects.versionNumber', { number: version.versionNumber })}
                          </p>
                          <p className="text-[10px] text-ink-500">
                            {new Date(version.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPendingSource({
                              source: version.code,
                              engine: selected.engine,
                              name: selected.name,
                              projectId: selected.id,
                              remoteId: selected.remoteId,
                              savedSource: version.code,
                            })
                            router.push('/')
                            notify(t('projects.versionRestored'), 'success')
                          }}
                        >
                          {t('projects.restoreVersion')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void removeVersion(version.id)
                          }}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-line pt-3">
                <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                  <Share2 className="size-3.5" aria-hidden="true" />
                  {t('share.title')}
                </h3>
                <ShareManager
                  projectId={selected.id}
                  code={selected.source}
                  versions={versions.map((version) => ({
                    id: version.id,
                    versionNumber: version.versionNumber,
                  }))}
                />
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* --- Dialogo de creacion ---------------------------------------- */}
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={t('projects.create')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleCreate()}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <Field label={t('common.rename')} required>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className="dl-surface-input"
            placeholder="Mi proyecto"
            autoFocus
          />
        </Field>
      </Dialog>

      {/* --- Dialogo de renombrado --------------------------------------- */}
      <Dialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title={t('projects.rename')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleRename()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('common.rename')} required>
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="dl-surface-input"
            autoFocus
          />
        </Field>
      </Dialog>

      {/* --- Dialogo de borrado ------------------------------------------ */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('common.delete')}
        description={t('projects.deleteConfirm')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-300">{deleteTarget?.name}</p>
      </Dialog>

      {!user && configured ? (
        <p className="mt-4 text-xs text-ink-500">
          {t('projects.emptyGuest')}{' '}
          <a href="/auth/sign-in" className="text-electric-300 underline-offset-2 hover:underline">
            {t('nav.signIn')}
          </a>
        </p>
      ) : null}
    </div>
  )
}
