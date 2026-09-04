import { useState, type ReactNode } from 'react'
import type { AppConfig, BackupImportResult, FeatureId, Tema } from '@shared/types'
import {
  IconBraces,
  IconChevronLeft,
  IconChevronRight,
  IconClipboard,
  IconCompare,
  IconFileCode,
  IconMoon,
  IconPlay,
  IconSettings,
  IconSun,
  IconTerminal
} from './Icons'
import { SettingsModal } from './SettingsModal'

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
  { id: 'apiLauncher', label: 'Lanzar APIs', icon: <IconPlay size={17} /> },
  { id: 'terminalLauncher', label: 'Terminales', icon: <IconTerminal size={17} /> }
]

const COLLAPSED_KEY = 'multitoolapp.sidebarCollapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

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
  const [showSettings, setShowSettings] = useState(false)
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  function toggleCollapsed(): void {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // sin persistencia si el storage no está disponible, no pasa nada
    }
  }

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-title">
        {!collapsed && <span>MultiToolApp</span>}
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
            title={collapsed ? f.label : undefined}
          >
            <span className="sidebar-icon">{f.icon}</span>
            {!collapsed && <span>{f.label}</span>}
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <button
          className="sidebar-button"
          onClick={() => setShowSettings(true)}
          title={collapsed ? 'Configuración' : undefined}
        >
          <span className="sidebar-icon">
            <IconSettings size={17} />
          </span>
          {!collapsed && <span>Configuración</span>}
        </button>
        <button
          className="sidebar-button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir' : 'Contraer'}
        >
          <span className="sidebar-icon">
            {collapsed ? <IconChevronRight size={17} /> : <IconChevronLeft size={17} />}
          </span>
          {!collapsed && <span>Contraer</span>}
        </button>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onExport={onExport}
          onImport={onImport}
          onApplyImport={onApplyImport}
        />
      )}
    </nav>
  )
}
