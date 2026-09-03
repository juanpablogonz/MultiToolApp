import { useEffect, useState } from 'react'
import type { AppConfig, BackupImportResult } from '@shared/types'
import { IconDownload, IconRefresh, IconUpload } from './Icons'

interface Props {
  onClose: () => void
  onExport: () => Promise<string | null>
  onImport: () => Promise<BackupImportResult | null>
  onApplyImport: (config: AppConfig) => void
}

export function SettingsModal({ onClose, onExport, onImport, onApplyImport }: Props) {
  const [version, setVersion] = useState('')
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<AppConfig | null>(null)

  useEffect(() => {
    window.multiToolApp.app.getVersion().then(setVersion)
    window.multiToolApp.app.getAutoLaunch().then(setAutoLaunch)
  }, [])

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

  async function handleCheckUpdates(): Promise<void> {
    setCheckingUpdates(true)
    await window.multiToolApp.app.checkForUpdates()
    setCheckingUpdates(false)
  }

  async function handleToggleAutoLaunch(enabled: boolean): Promise<void> {
    setAutoLaunch(enabled)
    await window.multiToolApp.app.setAutoLaunch(enabled)
  }

  if (pendingImport) {
    return (
      <div className="modal-backdrop">
        <div className="modal confirm-modal">
          <p>
            Esto va a reemplazar toda tu configuración actual (perfiles, botones y APIs) por la del archivo
            importado. ¿Continuar?
          </p>
          <div className="modal-actions">
            <button onClick={() => setPendingImport(null)}>Cancelar</button>
            <button
              className="danger"
              onClick={() => {
                onApplyImport(pendingImport)
                setPendingImport(null)
                onClose()
              }}
            >
              Importar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Configuración</h3>

        <div className="modal-field">
          Backup
          <div className="modal-actions-group">
            <button onClick={handleImport}>
              <IconUpload size={14} />
              Importar
            </button>
            <button onClick={handleExport}>
              <IconDownload size={14} />
              {exportDone ? '¡Guardado!' : 'Exportar'}
            </button>
          </div>
          {importError && <div className="sidebar-error">{importError}</div>}
        </div>

        <div className="modal-field">
          Inicio
          <div className="settings-switch-row">
            <span>Iniciar con Windows</span>
            <button
              className={`switch${autoLaunch ? ' on' : ''}`}
              role="switch"
              aria-checked={autoLaunch}
              type="button"
              onClick={() => handleToggleAutoLaunch(!autoLaunch)}
            />
          </div>
        </div>

        <button onClick={handleCheckUpdates} disabled={checkingUpdates}>
          <IconRefresh size={14} />
          {checkingUpdates ? 'Buscando...' : 'Buscar actualizaciones'}
        </button>

        <div className="settings-version">Versión {version || '...'}</div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
