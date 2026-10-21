'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { OnMount } from '@monaco-editor/react'
import { Spinner } from '@/components/ui/Spinner'

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-ink-500">
      <Spinner className="size-3.5" />
      <span>Cargando el editor...</span>
    </div>
  ),
})

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  /** Número de línea a destacar (1-indexada). */
  highlightLine?: number | null
  readOnly?: boolean
  ariaLabel: string
  placeholder?: string
}

/**
 * Editor de código Python.
 *
 * Monaco se carga de forma diferida (solo en el cliente). Si no puede
 * cargarse, se degrada a un area de texto para que el laboratorio siga
 * siendo utilizable en lugar de mostrar un panel roto.
 */
export function CodeEditor({
  value,
  onChange,
  highlightLine = null,
  readOnly = false,
  ariaLabel,
  placeholder,
}: CodeEditorProps) {
  const [fallback, setFallback] = useState(false)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const decorationsRef = useRef<string[]>([])

  useEffect(() => {
    let disposed = false
    const setup = async (): Promise<void> => {
      try {
        const [{ loader }, monacoModule] = await Promise.all([
          import('@monaco-editor/react'),
          import('monaco-editor/editor/editor.api'),
        ])
        if (disposed) return
        loader.config({ monaco: monacoModule as never })
        monacoModule.editor.defineTheme('devlab-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '5c6472', fontStyle: 'italic' },
            { token: 'keyword', foreground: '6289ff' },
            { token: 'string', foreground: '34d399' },
            { token: 'number', foreground: 'f4b740' },
            { token: 'identifier', foreground: 'd3d9e4' },
            { token: 'delimiter', foreground: '8992a3' },
          ],
          colors: {
            'editor.background': '#07080b',
            'editor.foreground': '#d3d9e4',
            'editorLineNumber.foreground': '#3a4050',
            'editorLineNumber.activeForeground': '#8992a3',
            'editor.selectionBackground': '#2749d855',
            'editor.lineHighlightBackground': '#101319',
            'editorCursor.foreground': '#6289ff',
            'editorIndentGuide.background1': '#1a1e26',
            'editorGutter.background': '#07080b',
          },
        })
        monacoModule.editor.setTheme('devlab-dark')
      } catch {
        if (!disposed) setFallback(true)
      }
    }
    void setup()
    return () => {
      disposed = true
    }
  }, [])

  // Resalta la línea del paso actual y la mantiene visible.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !highlightLine) return
    const monaco = (editor as unknown as { getModel: () => unknown }).getModel
      ? (
          editor as unknown as {
            getModel: () => unknown
            deltaDecorations: (old: string[], newDecorations: unknown[]) => string[]
            revealLineInCenter: (line: number) => void
          }
        )
      : null
    if (!monaco) return
    const model = monaco.getModel() as {
      getLineCount: () => number
    } | null
    if (!model) return
    const line = Math.min(Math.max(highlightLine, 1), model.getLineCount())
    decorationsRef.current = monaco.deltaDecorations(decorationsRef.current, [
      {
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'devlab-active-line',
          overviewRuler: { color: '#3a67f5', position: 2 },
        },
      },
    ])
    monaco.revealLineInCenter(line)
  }, [highlightLine])

  if (fallback) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        aria-label={ariaLabel}
        placeholder={placeholder}
        spellCheck={false}
        className="dl-surface-input dl-mono h-full min-h-[280px] resize-none border-0 bg-transparent p-3 text-[13px] leading-relaxed focus:shadow-none"
      />
    )
  }

  return (
    <Editor
      height="100%"
      language="python"
      value={value}
      theme="devlab-dark"
      onMount={(editor) => {
        editorRef.current = editor
      }}
      onChange={(next) => onChange(next ?? '')}
      options={{
        readOnly,
        fontFamily: 'var(--font-mono-lab), ui-monospace, monospace',
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'gutter',
        lineNumbersMinChars: 3,
        padding: { top: 12, bottom: 12 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        tabSize: 4,
        insertSpaces: true,
        automaticLayout: true,
        fontLigatures: false,
        bracketPairColorization: { enabled: true },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
        },
        quickSuggestions: false,
        parameterHints: { enabled: false },
        folding: true,
        contextmenu: false,
        ariaLabel,
      }}
      loading={
        <div className="flex h-full items-center justify-center gap-2 text-xs text-ink-500">
          <Spinner className="size-3.5" />
          <span>Cargando el editor...</span>
        </div>
      }
    />
  )
}
