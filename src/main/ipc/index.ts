import { ipcMain, BrowserWindow, clipboard, dialog } from 'electron'
import { promises as fs } from 'fs'
import type { AppConfig, ApiEntry, BackupImportResult, TerminalKind } from '@shared/types'
import { createDefaultConfig } from '@shared/defaultConfig'
import { loadConfig, saveConfig } from '../config/settingsService'
import { startApi, stopApi, stopAll, getAllStatuses } from '../features/apiLauncher/processManager'
import { openTerminalAt } from '../features/terminalLauncher/terminalRunner'

function backupFileName(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `multitoolapp-backup-${stamp}.json`
}

function isValidAppConfig(data: unknown): data is AppConfig {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (d.tema !== 'claro' && d.tema !== 'oscuro') return false
  const copyPaste = d.copyPaste as Record<string, unknown> | undefined
  if (typeof copyPaste !== 'object' || copyPaste === null || !Array.isArray(copyPaste.perfiles)) return false
  const apiLauncher = d.apiLauncher as Record<string, unknown> | undefined
  if (typeof apiLauncher !== 'object' || apiLauncher === null || !Array.isArray(apiLauncher.apis)) return false
  // terminalLauncher es opcional acá: backups viejos (de antes de este módulo) no lo tienen,
  // y se completa con el valor por defecto en el handler de import.
  return true
}

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('config:load', async () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', async (_event, config: AppConfig) => {
    await saveConfig(config)
    return true
  })

  ipcMain.handle('clipboard:write', async (_event, text: string) => {
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle('apiLauncher:start', async (_event, api: ApiEntry) => {
    const win = getMainWindow()
    if (!win) throw new Error('No hay ventana principal activa')
    return startApi(win, api)
  })

  ipcMain.handle('apiLauncher:stop', async (_event, id: string) => {
    return stopApi(id)
  })

  ipcMain.handle('apiLauncher:statusAll', async (_event, ids: string[]) => {
    return getAllStatuses(ids)
  })

  ipcMain.handle('backup:export', async (_event, config: AppConfig) => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      defaultPath: backupFileName(),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, JSON.stringify(config, null, 2), 'utf-8')
    return result.filePath
  })

  ipcMain.handle('backup:import', async (): Promise<BackupImportResult | null> => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    let raw: string
    try {
      raw = await fs.readFile(result.filePaths[0], 'utf-8')
    } catch {
      return { ok: false, error: 'No se pudo leer el archivo elegido.' }
    }

    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'El archivo no es un JSON válido.' }
    }

    if (!isValidAppConfig(data)) {
      return { ok: false, error: 'El archivo no tiene el formato de un backup de MultiToolApp.' }
    }

    const config: AppConfig = {
      ...data,
      terminalLauncher: data.terminalLauncher ?? createDefaultConfig().terminalLauncher
    }

    return { ok: true, config }
  })

  ipcMain.handle('dialog:pickCsproj', async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Proyecto .NET', extensions: ['csproj'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:pickJsonFile', async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    try {
      const content = await fs.readFile(result.filePaths[0], 'utf-8')
      return { path: result.filePaths[0], content }
    } catch {
      return null
    }
  })

  ipcMain.handle('dialog:pickFolder', async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'terminalLauncher:open',
    async (_event, path: string, kind: TerminalKind, comoAdministrador: boolean) => {
      return openTerminalAt(path, kind, comoAdministrador)
    }
  )
}

export function shutdownAllProcesses(): void {
  stopAll()
}
