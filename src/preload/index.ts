import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, ApiEntry, ApiLogLine, ApiRuntimeStatus, BackupImportResult } from '@shared/types'

const api = {
  config: {
    load: (): Promise<AppConfig> => ipcRenderer.invoke('config:load'),
    save: (config: AppConfig): Promise<boolean> => ipcRenderer.invoke('config:save', config)
  },
  clipboard: {
    write: (text: string): Promise<boolean> => ipcRenderer.invoke('clipboard:write', text)
  },
  backup: {
    export: (config: AppConfig): Promise<string | null> => ipcRenderer.invoke('backup:export', config),
    import: (): Promise<BackupImportResult | null> => ipcRenderer.invoke('backup:import')
  },
  dialog: {
    pickCsproj: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickCsproj'),
    pickJsonFile: (): Promise<{ path: string; content: string } | null> =>
      ipcRenderer.invoke('dialog:pickJsonFile')
  },
  apiLauncher: {
    start: (entry: ApiEntry): Promise<ApiRuntimeStatus> => ipcRenderer.invoke('apiLauncher:start', entry),
    stop: (id: string): Promise<ApiRuntimeStatus> => ipcRenderer.invoke('apiLauncher:stop', id),
    statusAll: (ids: string[]): Promise<ApiRuntimeStatus[]> => ipcRenderer.invoke('apiLauncher:statusAll', ids),
    onLog: (callback: (line: ApiLogLine) => void): (() => void) => {
      const listener = (_event: unknown, line: ApiLogLine): void => callback(line)
      ipcRenderer.on('apiLauncher:log', listener)
      return () => ipcRenderer.removeListener('apiLauncher:log', listener)
    },
    onStatus: (callback: (status: ApiRuntimeStatus) => void): (() => void) => {
      const listener = (_event: unknown, status: ApiRuntimeStatus): void => callback(status)
      ipcRenderer.on('apiLauncher:status', listener)
      return () => ipcRenderer.removeListener('apiLauncher:status', listener)
    }
  }
}

export type MultiToolAppApi = typeof api

contextBridge.exposeInMainWorld('multiToolApp', api)
