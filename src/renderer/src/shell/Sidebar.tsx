import { useState, type ReactNode } from 'react'
import type { AppConfig, BackupImportResult, FeatureId, Tema } from '@shared/types'
import {
  IconBraces,
  IconClipboard,
  IconCompare,
  IconDownload,
  IconFileCode,
  IconMoon,
  IconPlay,
  IconSun,
  IconUpload
} from './Icons'
import { ConfirmDialog } from './ConfirmDialog'

interface FeatureDef {
  id: FeatureId
  label: string
  icon: ReactNode
}

const FEATURES: FeatureDef[] = [
  { id: 'copyPaste', label: 'Copiar Rápido', icon: <IconClipboard size={17} /> },
  { id: 'formatter', label: 'Formatear', icon: <IconBraces size={17} /> },
  { id: 'diff', label: 'Comparar', icon: <IconCompare size={17} /> },
  { id: 'csharpConverter', label: 'JSON ⇄ C#', icon: <IconFileCode size={17} /> },
  { id: 'apiLauncher', label: 'Lanzar APIs', icon: <IconPlay size={17} /> }
]

interface Props {
  selected: FeatureId
  onSelect: (id: FeatureId) => void
  tema: Tema
  onToggleTema: () => void
  onExport: () => Promise<string | null>
  onImport: () => Promise<BackupImportResult | null>
  onApplyImport: (config: AppConfig) => void
}

export function Sidebar({ selected, onSelect, tema, onToggleTema, onExport, onImport, onApplyImport }: Props) {
  const [exportDone, setExportDone] = useState(false)
  const [pendingImport, setPendingImport] = useState<AppConfig | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleExport(): Promise<void> {
    const path = await onExport()
    if (!path) return
    setExportDone(true)
    setTimeout(() => setExportDone(false), 2000)
  }

  async function handleImport(): Promise<void> {
    setImportError(null)
    const result = await onImport()
    if (!result) return
    if (!result.ok) {
      setImportError(result.error)
      setTimeout(() => setImportError(null), 4000)
      return
    }
    setPendingImport(result.config)
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-title">
        <span>MultiToolApp</span>
        <button
          className="theme-toggle"
          onClick={onToggleTema}
          title={tema === 'claro' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
        >
          {tema === 'claro' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
      </div>
      <div className="sidebar-buttons">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            className={`sidebar-button${f.id === selected ? ' active' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            <span className="sidebar-icon">{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        {importError && <div className="sidebar-error">{importError}</div>}
        <button className="sidebar-button" onClick={handleImport}>
          <span className="sidebar-icon">
            <IconUpload size={17} />
          </span>
          <span>Importar</span>
        </button>
        <button className="sidebar-button" onClick={handleExport}>
          <span className="sidebar-icon">
            <IconDownload size={17} />
          </span>
          <span>{exportDone ? '¡Guardado!' : 'Exportar'}</span>
        </button>
      </div>

      {pendingImport && (
        <ConfirmDialog
          message="Esto va a reemplazar toda tu configuración actual (perfiles, botones y APIs) por la del archivo importado. ¿Continuar?"
          confirmLabel="Importar"
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            onApplyImport(pendingImport)
            setPendingImport(null)
          }}
        />
      )}
    </nav>
  )
}
