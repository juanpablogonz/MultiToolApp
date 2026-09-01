import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppConfig } from '@shared/types'

interface ConfigContextValue {
  config: AppConfig | null
  loading: boolean
  updateConfig: (updater: (draft: AppConfig) => AppConfig) => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.multiToolApp.config.load().then((loaded) => {
      setConfig(loaded)
      setLoading(false)
    })
  }, [])

  const updateConfig = useCallback((updater: (draft: AppConfig) => AppConfig) => {
    setConfig((prev) => {
      if (!prev) return prev
      const next = updater(prev)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        window.multiToolApp.config.save(next)
      }, 300)
      return next
    })
  }, [])

  return <ConfigContext.Provider value={{ config, loading, updateConfig }}>{children}</ConfigContext.Provider>
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig debe usarse dentro de <ConfigProvider>')
  return ctx
}
