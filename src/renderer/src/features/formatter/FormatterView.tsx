import { useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import { FeaturePage } from '../../shell/FeaturePage'
import { useConfig } from '../../config/ConfigContext'
import { useClipboard } from '../../shell/useClipboard'
import { formatXml, minifyXml, validateXml } from './xmlFormat'

type Lang = 'json' | 'xml'

export function FormatterView() {
  const { config } = useConfig()
  const { copy } = useClipboard()
  const monacoTheme = config?.tema === 'oscuro' ? 'vs-dark' : 'vs'
  const [lang, setLang] = useState<Lang>('json')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  function applyResult(text: string): void {
    setValue(text)
    requestAnimationFrame(() => {
      editorRef.current?.setScrollPosition({ scrollTop: 0, scrollLeft: 0 })
    })
  }

  function formatear(): void {
    setError(null)
    if (!value.trim()) return
    try {
      if (lang === 'json') {
        applyResult(JSON.stringify(JSON.parse(value), null, 2))
      } else {
        const err = validateXml(value)
        if (err) throw new Error(err)
        applyResult(formatXml(value))
      }
    } catch {
      setError('El formato no es válido')
    }
  }

  function minificar(): void {
    setError(null)
    if (!value.trim()) return
    try {
      if (lang === 'json') {
        applyResult(JSON.stringify(JSON.parse(value)))
      } else {
        const err = validateXml(value)
        if (err) throw new Error(err)
        applyResult(minifyXml(value))
      }
    } catch {
      setError('El formato no es válido')
    }
  }

  function copiar(): void {
    copy(value)
  }

  function limpiar(): void {
    setValue('')
    setError(null)
  }

  return (
    <FeaturePage
      submenu={
        <>
          <button className={`submenu-tab${lang === 'json' ? ' active' : ''}`} onClick={() => setLang('json')}>
            JSON
          </button>
          <button className={`submenu-tab${lang === 'xml' ? ' active' : ''}`} onClick={() => setLang('xml')}>
            XML
          </button>
        </>
      }
    >
      <div className="toolbar">
        <button onClick={formatear}>Formatear</button>
        <button onClick={minificar}>Minificar</button>
        <button onClick={copiar}>Copiar</button>
        <button onClick={limpiar}>Limpiar</button>
        {error && <span className="error-text">{error}</span>}
      </div>
      <div className="editor-wrap">
        <Editor
          language={lang}
          value={value}
          onChange={(v) => setValue(v ?? '')}
          onMount={handleMount}
          theme={monacoTheme}
          path={`formatter.${lang}`}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
            stickyScroll: { enabled: false }
          }}
        />
      </div>
    </FeaturePage>
  )
}
