import { useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import { FeaturePage } from '../../shell/FeaturePage'
import { useConfig } from '../../config/ConfigContext'
import { useClipboard } from '../../shell/useClipboard'
import { IconDownload, IconUpload } from '../../shell/Icons'
import {
  type CSharpAccess,
  type CasingTarget,
  csharpToJson,
  jsonToCSharp,
  normalizeGetSet,
  removeConstructors,
  renamePropertiesCase,
  setAccessModifier
} from './csharpModel'

export function CSharpConverterView() {
  const { config } = useConfig()
  const { copy } = useClipboard()
  const monacoTheme = config?.tema === 'oscuro' ? 'vs-dark' : 'vs'

  const [code, setCode] = useState('')
  const [access, setAccess] = useState<CSharpAccess>('public')
  const [casing, setCasing] = useState<CasingTarget>('pascal')
  const [error, setError] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const [jsonPreview, setJsonPreview] = useState<string | null>(null)

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  function resetScroll(): void {
    requestAnimationFrame(() => {
      editorRef.current?.setScrollPosition({ scrollTop: 0, scrollLeft: 0 })
    })
  }

  function applyTransform(fn: (code: string) => string): void {
    setError(null)
    try {
      setCode((prev) => fn(prev))
    } catch {
      setError('No se pudo aplicar el cambio sobre el código actual.')
    }
  }

  function handleAccessChange(value: CSharpAccess): void {
    setAccess(value)
    applyTransform((c) => setAccessModifier(c, value))
  }

  function handleCasingChange(value: CasingTarget): void {
    setCasing(value)
    applyTransform((c) => renamePropertiesCase(c, value))
  }

  function limpiar(): void {
    setCode('')
    setError(null)
    resetScroll()
  }

  function copiar(): void {
    copy(code)
  }

  function openImport(): void {
    setImportText('')
    setImportError(null)
    setImportOpen(true)
  }

  async function pickJsonFile(): Promise<void> {
    const file = await window.multiToolApp.dialog.pickJsonFile()
    if (file) setImportText(file.content)
  }

  function generarDesdeJson(): void {
    setImportError(null)
    if (!importText.trim()) return
    try {
      const parsed = JSON.parse(importText)
      const generated = jsonToCSharp(parsed)
      setCode(generated)
      setError(null)
      setImportOpen(false)
      resetScroll()
    } catch {
      setImportError('Formato incorrecto')
    }
  }

  function verComoJson(): void {
    setError(null)
    if (!code.trim()) return
    try {
      const result = csharpToJson(code)
      setJsonPreview(JSON.stringify(result, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el JSON a partir del código.')
    }
  }

  function copiarJsonPreview(): void {
    if (jsonPreview) copy(jsonPreview)
  }

  return (
    <FeaturePage submenu={<span className="submenu-label">Conversor JSON ⇄ C#</span>}>
      <div className="toolbar">
        <button className="primary" onClick={openImport}>
          <IconDownload size={14} /> Importar JSON
        </button>
        <button onClick={verComoJson}>
          <IconUpload size={14} /> Ver como JSON
        </button>
        <span className="toolbar-divider" />
        <div className="radio-group">
          <label className="radio-option">
            <input type="radio" checked={access === 'public'} onChange={() => handleAccessChange('public')} />
            Public
          </label>
          <label className="radio-option">
            <input type="radio" checked={access === 'private'} onChange={() => handleAccessChange('private')} />
            Private
          </label>
          <label className="radio-option">
            <input type="radio" checked={access === 'protected'} onChange={() => handleAccessChange('protected')} />
            Protected
          </label>
        </div>
        <span className="toolbar-divider" />
        <div className="radio-group">
          <label className="radio-option">
            <input type="radio" checked={casing === 'pascal'} onChange={() => handleCasingChange('pascal')} />
            PascalCase
          </label>
          <label className="radio-option">
            <input type="radio" checked={casing === 'camel'} onChange={() => handleCasingChange('camel')} />
            camelCase
          </label>
        </div>
        <span className="toolbar-divider" />
        <button onClick={() => applyTransform(removeConstructors)}>Limpiar constructores</button>
        <button onClick={() => applyTransform(normalizeGetSet)}>Normalizar a {'{ get; set; }'}</button>
        <button onClick={copiar}>Copiar</button>
        <button onClick={limpiar}>Limpiar</button>
        {error && <span className="error-text">{error}</span>}
      </div>

      <div className="editor-wrap">
        <Editor
          language="csharp"
          value={code}
          onChange={(v) => setCode(v ?? '')}
          onMount={handleMount}
          theme={monacoTheme}
          path="csharp-converter.cs"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
            stickyScroll: { enabled: false }
          }}
        />
      </div>

      {importOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Importar JSON</h3>
            <label>
              Pegá el JSON acá, o cargalo desde un archivo
              <textarea
                rows={14}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{ "nombre": "Juan" }'
              />
            </label>
            {importError && <span className="error-text">{importError}</span>}
            <div className="modal-actions modal-actions-split">
              <button onClick={pickJsonFile}>Elegir archivo...</button>
              <div className="modal-actions-group">
                <button onClick={() => setImportOpen(false)}>Cancelar</button>
                <button className="primary" onClick={generarDesdeJson}>
                  Generar clase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {jsonPreview !== null && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>JSON generado</h3>
            <textarea rows={16} readOnly value={jsonPreview} className="json-preview-output" />
            <div className="modal-actions">
              <button onClick={() => setJsonPreview(null)}>Cerrar</button>
              <button className="primary" onClick={copiarJsonPreview}>
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}
    </FeaturePage>
  )
}
