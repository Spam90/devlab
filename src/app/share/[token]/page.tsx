'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, FileCode2, Lock, Play } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { setPendingSource } from '@/lib/lab/pendingSource'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { CodeEditor } from '@/components/lab/CodeEditor'
import { Spinner } from '@/components/ui/Spinner'

interface SharedContent {
  id: string
  projectName: string
  code: string
  includeCode: boolean
  createdAt: string
}

export default function SharedProgramPage({ params }: { params: Promise<{ token: string }> }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [content, setContent] = useState<SharedContent | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')

  useEffect(() => {
    void params.then((value) => setToken(value.token))
  }, [params])

  const load = useCallback(async (): Promise<void> => {
    if (!token) return
    // La petición se hace tras ceder el hilo: evita un render en cascada al
    // montar el componente.
    await Promise.resolve()
    setState('loading')
    try {
      const response = await fetch(`/api/share/${encodeURIComponent(token)}`)
      if (response.status === 404) {
        setState('not-found')
        return
      }
      if (!response.ok) {
        setState('error')
        return
      }
      const payload = (await response.json()) as SharedContent
      setContent(payload)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [token])

  useEffect(() => {
    // Carga de datos al montar: es el uso previsto de un efecto. La regla
    // `set-state-in-effect` es deliberadamente estricta y no distingue entre
    // un `setState` de renderizado y uno posterior a una petición.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-500">
        <Spinner className="size-4" />
        <span>{t('common.loading')}</span>
      </div>
    )
  }

  if (state !== 'ready' || !content) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <Panel title={t('share.notFound')} icon={<Lock className="size-3.5" aria-hidden="true" />}>
          <div className="space-y-3 p-4">
            <p className="text-sm text-ink-300">{t('share.notFound')}</p>
            <Button size="sm" variant="secondary" onClick={() => router.push('/')}>
              {t('nav.lab')}
            </Button>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-ink-100">
          <Eye className="size-4 text-electric-400" aria-hidden="true" />
          {content.projectName}
        </h1>
        <p className="mt-1 text-sm text-ink-400">{t('share.publicPageSubtitle')}</p>
      </header>

      <Panel
        title={t('lab.editorPanel')}
        icon={<FileCode2 className="size-3.5" aria-hidden="true" />}
        className="h-[520px]"
      >
        {content.includeCode ? (
          <CodeEditor
            value={content.code}
            onChange={() => undefined}
            readOnly
            ariaLabel={t('a11y.codeEditor')}
          />
        ) : (
          <div className="p-6 text-sm text-ink-400">{t('share.publicPageSubtitle')}</div>
        )}
      </Panel>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setPendingSource({ source: content.code, engine: 'devlab' })
            router.push('/')
          }}
          icon={<Play className="size-3.5" aria-hidden="true" />}
        >
          {t('share.tryInLab')}
        </Button>
        <span className="text-[11px] text-ink-500">{t('share.tryInLabHint')}</span>
        <span className="ml-auto text-[11px] text-ink-600">
          {new Date(content.createdAt).toLocaleString(locale)}
        </span>
      </div>
    </div>
  )
}
