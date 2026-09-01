import { useEffect, useState } from 'react'
import type { AppConfig, BackupImportResult, FeatureId } from '@shared/types'
import { ConfigProvider, useConfig } from './config/ConfigContext'
import { ToastProvider } from './shell/ToastContext'
import { Sidebar } from './shell/Sidebar'
import { CopyPasteView } from './features/copyPaste/CopyPasteView'
import { FormatterView } from './features/formatter/FormatterView'
import { DiffView } from './features/diff/DiffView'
import { ApiLauncherView } from './features/apiLauncher/ApiLauncherView'
import { CSharpConverterView } from './features/csharpConverter/CSharpConverterView'

// Las vistas quedan siempre montadas (solo se oculta la que no está activa) para que
// el contenido que el usuario escribió (formateador, comparador, conversor) no se pierda al cambiar de menú.
function FeatureSwitch({ feature }: { feature: FeatureId }) {
  return (
    <>
      <div className={`feature-slot${feature === 'copyPaste' ? ' active' : ''}`}>
        <CopyPasteView />
      </div>
      <div className={`feature-slot${feature === 'formatter' ? ' active' : ''}`}>
        <FormatterView />
      </div>
      <div className={`feature-slot${feature === 'diff' ? ' active' : ''}`}>
        <DiffView />
      </div>
      <div className={`feature-slot${feature === 'csharpConverter' ? ' active' : ''}`}>
        <CSharpConverterView />
      </div>
      <div className={`feature-slot${feature === 'apiLauncher' ? ' active' : ''}`}>
        <ApiLauncherView />
      </div>
    </>
  )
}

function Shell() {
  const { config, loading, updateConfig } = useConfig()
  const [feature, setFeature] = useState<FeatureId>('copyPaste')

  useEffect(() => {
    document.documentElement.dataset.theme = config?.tema ?? 'claro'
  }, [config?.tema])

  if (loading || !config) {
    return <div className="app-loading">Cargando MultiToolApp...</div>
  }

  const currentConfig = config

  function toggleTema(): void {
    updateConfig((draft) => ({ ...draft, tema: draft.tema === 'claro' ? 'oscuro' : 'claro' }))
  }

  function exportBackup(): Promise<string | null> {
    return window.multiToolApp.backup.export(currentConfig)
  }

  function importBackup(): Promise<BackupImportResult | null> {
    return window.multiToolApp.backup.import()
  }

  function applyImport(imported: AppConfig): void {
    updateConfig(() => imported)
  }

  return (
    <div className="app-shell">
      <Sidebar
        selected={feature}
        onSelect={setFeature}
        tema={config.tema}
        onToggleTema={toggleTema}
        onExport={exportBackup}
        onImport={importBackup}
        onApplyImport={applyImport}
      />
      <main className="app-main">
        <FeatureSwitch feature={feature} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ConfigProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ConfigProvider>
  )
}
