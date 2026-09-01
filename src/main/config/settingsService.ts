import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { AppConfig } from '@shared/types'
import { createDefaultConfig } from '@shared/defaultConfig'

const CONFIG_FILE = 'config.json'

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE)
}

function getTmpPath(): string {
  return join(app.getPath('userData'), `${CONFIG_FILE}.tmp`)
}

function getBackupPath(): string {
  return join(app.getPath('userData'), `${CONFIG_FILE}.bak`)
}

let cache: AppConfig | null = null

// Rellena con los valores por defecto los campos que falten en un config.json
// guardado por una versión anterior de la app (ej: al agregar un módulo nuevo).
function withMigrations(config: AppConfig): AppConfig {
  const defaults = createDefaultConfig()
  return {
    ...defaults,
    ...config,
    terminalLauncher: config.terminalLauncher ?? defaults.terminalLauncher
  }
}

export async function loadConfig(): Promise<AppConfig> {
  if (cache) return cache

  const configPath = getConfigPath()
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    cache = withMigrations(JSON.parse(raw) as AppConfig)
    return cache
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException
    if (nodeErr.code === 'ENOENT') {
      cache = createDefaultConfig()
      await saveConfig(cache)
      return cache
    }
    // Archivo corrupto: lo respaldamos y arrancamos con default para no romper la app.
    try {
      await fs.copyFile(configPath, getBackupPath())
    } catch {
      // sin nada que respaldar, seguimos igual
    }
    cache = createDefaultConfig()
    await saveConfig(cache)
    return cache
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  cache = config
  const configPath = getConfigPath()
  const tmpPath = getTmpPath()
  const json = JSON.stringify(config, null, 2)
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(tmpPath, json, 'utf-8')
  await fs.rename(tmpPath, configPath)
}

export function getCachedConfig(): AppConfig | null {
  return cache
}
