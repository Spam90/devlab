'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Link2, Share2, Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createShare, listShares, revokeShare } from '@/lib/projects/remote'
import type { PublicShareRow } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'

/**
 * Gestion de enlaces públicos de un proyecto.
 *
 * El token se genera en el cliente y solo se guarda su hash en Supabase:
 * el enlace completo existe unicamente en el momento de crearlo y en el
 * portapapeles de quien lo creo.
 */
export function ShareManager({
  projectId,
  code,
  versions,
}: {
  projectId: string | null
  code: string
  versions: { id: string; versionNumber: number }[]
}) {
  const { t } = useI18n()
  const { user, configured } = useAuth()
  const { notify } = useToast()
  const [shares, setShares] = useState<(PublicShareRow & { url?: string })[]>([])
  const [includeCode, setIncludeCode] = useState(true)
  const [versionId, setVersionId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const canShare = Boolean(user) && configured

  const refresh = useCallback(async (): Promise<void> => {
    if (!projectId || !canShare) {
      setShares([])
      return
    }
    try {
      const rows = await listShares(projectId)
      setShares(rows)
    } catch {
      setShares([])
    }
  }, [projectId, canShare])
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      await Promise.resolve()
      if (cancelled || !projectId || !canShare) {
        if (!cancelled) setShares([])
        return
      }
      try {
        const rows = await listShares(projectId)
        if (cancelled) return
        setShares(rows)
      } catch {
        if (!cancelled) setShares([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, canShare])

  const handleCreate = async (): Promise<void> => {
    if (!projectId) return
    setLoading(true)
    try {
      const selectedVersion = versions.find((version) => version.id === versionId)
      const payload =
        selectedVersion && versionId
          ? await fetchVersionCode(versionId)
          : code
      const { token } = await createShare({
        projectId,
        code: payload,
        includeCode,
        versionId: versionId || null,
      })
      const url = `${window.location.origin}/share/${token}`
      try {
        await navigator.clipboard.writeText(url)
        notify(t('share.linkCreated'), 'success')
      } catch {
        notify(url, 'info')
      }
      await refresh()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : t('errors.generic'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchVersionCode = async (id: string): Promise<string> => {
    const { listVersions } = await import('@/lib/projects/remote')
    const rows = await listVersions(projectId ?? '')
    return rows.find((row) => row.id === id)?.code ?? code
  }

  const handleRevoke = async (id: string): Promise<void> => {
    try {
      await revokeShare(id)
      await refresh()
      notify(t('share.revoked'), 'success')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : t('errors.generic'), 'error')
    }
  }

  if (!canShare) {
    return (
      <p className="text-xs text-ink-500">
        {t('nav.guestBanner')} <span className="text-electric-300">{t('nav.signIn')}</span>
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Field label={t('share.includeVersion')} className="min-w-[180px] flex-1">
          <select
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
            className="dl-surface-input h-8 text-xs"
          >
            <option value="">{t('share.currentVersion')}</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {t('projects.versionNumber', { number: version.versionNumber })}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-1.5 pt-4 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={includeCode}
            onChange={(event) => setIncludeCode(event.target.checked)}
            className="size-3.5 accent-electric-500"
          />
          {t('share.includeCode')}
        </label>
      </div>

      <Button
        size="sm"
        variant="primary"
        loading={loading}
        onClick={() => {
          void handleCreate()
        }}
        icon={<Share2 className="size-3.5" aria-hidden="true" />}
      >
        {t('share.createLink')}
      </Button>

      <p className="text-[11px] leading-relaxed text-ink-500">{t('share.createDescription')}</p>

      {shares.length === 0 ? (
        <p className="text-xs text-ink-500">{t('share.none')}</p>
      ) : (
        <ul className="space-y-2">
          {shares.map((share) => (
            <li
              key={share.id}
              className="flex items-center gap-2 rounded-md border border-line bg-carbon-900 px-2.5 py-2"
            >
              <Link2 className="size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="dl-mono truncate text-[11px] text-ink-300">
                  /share/{share.id.slice(0, 8)}…
                </p>
                <p className="text-[10px] text-ink-600">
                  {new Date(share.created_at).toLocaleDateString()}
                </p>
              </div>
              {share.revoked_at ? (
                <Badge tone="error">{t('share.revoked')}</Badge>
              ) : (
                <Badge tone="ok">{t('share.active')}</Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void handleRevoke(share.id)
                }}
                disabled={Boolean(share.revoked_at)}
                aria-label={t('share.revoke')}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-ink-600">
        <Copy className="size-3" aria-hidden="true" />
        {t('common.copyToClipboard')}
      </p>
    </div>
  )
}
