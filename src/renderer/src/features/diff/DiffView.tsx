import { useEffect, useRef, useState } from 'react'
import Editor, { DiffEditor, type Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import { FeaturePage } from '../../shell/FeaturePage'
import { useConfig } from '../../config/ConfigContext'
import { diffLines } from './lineDiff'

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  automaticLayout: true,
  stickyScroll: { enabled: false },
  wordWrap: 'off' as const
}

// Debajo de este ancho de contenido, dos columnas quedan demasiado angostas para ser útiles
// (con el tamaño de ventana por defecto de la app, esto arranca en modo filas).
const COLUMNAS_MIN_WIDTH = 1000

export function DiffView() {
  const { config } = useConfig()
  const monacoTheme = config?.tema === 'oscuro' ? 'vs-dark' : 'vs'
  // "seed*" es SOLO el valor inicial con el que se crea/reinicia un editor (Limpiar,
  // Intercambiar, o al cambiar de modo). Nunca se re-empuja durante el tipeo: si lo
  // hiciéramos, cada tecla dispararía un setValue() interno que resetea el cursor al
  // principio y borra el historial de Ctrl+Z.
  const [seedOriginal, setSeedOriginal] = useState('')
  const [seedModified, setSeedModified] = useState('')
  const [filas, setFilas] = useState(true)

  const monacoRef = useRef<Monaco | null>(null)
  const originalEditorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)
  const modifiedEditorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)
  const topDecorations = useRef<string[]>([])
  const bottomDecorations = useRef<string[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const filasRef = useRef(filas)
  filasRef.current = filas

  // Copia siempre al día de lo que el usuario tipeó, actualizada en cada cambio.
  // No usamos directamente editor.getValue() al momento de cambiar de modo porque en
  // ese instante el editor viejo puede estar a mitad de desmontarse (o ya disponer su
  // modelo), y leerlo ahí es lo que hacía que el contenido se perdiera en el cambio
  // filas -> columnas al resizear.
  const originalTextRef = useRef('')
  const modifiedTextRef = useRef('')

  function updateDecorations(): void {
    const monaco = monacoRef.current
    if (!monaco || !filasRef.current) return

    const diff = diffLines(originalTextRef.current.split('\n'), modifiedTextRef.current.split('\n'))

    if (originalEditorRef.current) {
      const decos: MonacoEditorNS.IModelDeltaDecoration[] = diff.left.flatMap((op, idx) =>
        op.type === 'removed'
          ? [
              {
                range: new monaco.Range(idx + 1, 1, idx + 1, 1),
                options: { isWholeLine: true, className: 'diff-line-removed' }
              }
            ]
          : []
      )
      topDecorations.current = originalEditorRef.current.deltaDecorations(topDecorations.current, decos)
    }

    if (modifiedEditorRef.current) {
      const decos: MonacoEditorNS.IModelDeltaDecoration[] = diff.right.flatMap((op, idx) =>
        op.type === 'added'
          ? [
              {
                range: new monaco.Range(idx + 1, 1, idx + 1, 1),
                options: { isWholeLine: true, className: 'diff-line-added' }
              }
            ]
          : []
      )
      bottomDecorations.current = modifiedEditorRef.current.deltaDecorations(bottomDecorations.current, decos)
    }
  }

  function limpiar(): void {
    originalTextRef.current = ''
    modifiedTextRef.current = ''
    originalEditorRef.current?.setValue('')
    modifiedEditorRef.current?.setValue('')
    setSeedOriginal('')
    setSeedModified('')
  }

  function intercambiar(): void {
    const nuevoOriginal = modifiedTextRef.current
    const nuevoModificado = originalTextRef.current
    originalTextRef.current = nuevoOriginal
    modifiedTextRef.current = nuevoModificado
    originalEditorRef.current?.setValue(nuevoOriginal)
    modifiedEditorRef.current?.setValue(nuevoModificado)
    setSeedOriginal(nuevoOriginal)
    setSeedModified(nuevoModificado)
    updateDecorations()
  }

  function cambiarVista(): void {
    // Al cambiar de modo se remonta el otro editor: guardamos el texto actual como
    // semilla para que no se pierda nada.
    setSeedOriginal(originalTextRef.current)
    setSeedModified(modifiedTextRef.current)
    setFilas((v) => !v)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      const debeSerFilas = width < COLUMNAS_MIN_WIDTH
      if (debeSerFilas === filasRef.current) return
      setSeedOriginal(originalTextRef.current)
      setSeedModified(modifiedTextRef.current)
      setFilas(debeSerFilas)
    })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <FeaturePage submenu={<span className="submenu-label">Comparador de texto</span>}>
      <div className="toolbar">
        <button
          onClick={cambiarVista}
          title="Alterna entre ver los textos en dos columnas lado a lado, o en dos filas (uno arriba del otro)"
        >
          Cambiar vista
        </button>
        <button onClick={intercambiar}>Intercambiar</button>
        <button onClick={limpiar}>Limpiar</button>
      </div>

      <div ref={containerRef} className="diff-container">
        {filas ? (
          <div className="diff-rows">
            <div className="diff-row">
              <span className="diff-row-label">Texto A</span>
              <div className="editor-wrap diff-row-editor">
                <Editor
                  defaultValue={seedOriginal}
                  onChange={(v) => {
                    originalTextRef.current = v ?? ''
                    updateDecorations()
                  }}
                  language="plaintext"
                  theme={monacoTheme}
                  options={EDITOR_OPTIONS}
                  onMount={(editor, monaco) => {
                    originalEditorRef.current = editor
                    monacoRef.current = monaco
                    originalTextRef.current = editor.getValue()
                    topDecorations.current = []
                    updateDecorations()
                  }}
                />
              </div>
            </div>
            <div className="diff-row">
              <span className="diff-row-label">Texto B</span>
              <div className="editor-wrap diff-row-editor">
                <Editor
                  defaultValue={seedModified}
                  onChange={(v) => {
                    modifiedTextRef.current = v ?? ''
                    updateDecorations()
                  }}
                  language="plaintext"
                  theme={monacoTheme}
                  options={EDITOR_OPTIONS}
                  onMount={(editor, monaco) => {
                    modifiedEditorRef.current = editor
                    monacoRef.current = monaco
                    modifiedTextRef.current = editor.getValue()
                    bottomDecorations.current = []
                    updateDecorations()
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="editor-wrap">
            <DiffEditor
              original={seedOriginal}
              modified={seedModified}
              language="plaintext"
              theme={monacoTheme}
              options={{
                renderSideBySide: true,
                originalEditable: true,
                ...EDITOR_OPTIONS
              }}
              onMount={(editor, monaco) => {
                const originalEditor = editor.getOriginalEditor()
                const modifiedEditor = editor.getModifiedEditor()
                originalEditorRef.current = originalEditor
                modifiedEditorRef.current = modifiedEditor
                monacoRef.current = monaco
                originalTextRef.current = originalEditor.getValue()
                modifiedTextRef.current = modifiedEditor.getValue()
                originalEditor.onDidChangeModelContent(() => {
                  originalTextRef.current = originalEditor.getValue()
                })
                modifiedEditor.onDidChangeModelContent(() => {
                  modifiedTextRef.current = modifiedEditor.getValue()
                })
              }}
            />
          </div>
        )}
      </div>
    </FeaturePage>
  )
}
