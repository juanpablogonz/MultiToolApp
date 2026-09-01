import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import type { ApiEnvironment } from '@shared/types'

interface ApplyResult {
  applied: boolean
  message: string
}

function hasBusinessFlags(data: unknown): data is { BusinessProperties: Record<string, unknown> } {
  if (typeof data !== 'object' || data === null) return false
  const bp = (data as Record<string, unknown>).BusinessProperties
  if (typeof bp !== 'object' || bp === null) return false
  return 'UseDev' in bp && 'UseTest' in bp
}

export async function applyEnvironmentToAppSettings(
  csprojPath: string,
  entorno: ApiEnvironment
): Promise<ApplyResult> {
  const settingsPath = join(dirname(csprojPath), 'appsettings.json')

  let raw: string
  try {
    raw = await fs.readFile(settingsPath, 'utf-8')
  } catch {
    return { applied: false, message: 'No se encontró appsettings.json junto al proyecto; se ignora el entorno.' }
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { applied: false, message: 'appsettings.json no es un JSON válido; se ignora el entorno.' }
  }

  if (!hasBusinessFlags(data)) {
    return {
      applied: false,
      message: 'appsettings.json no tiene BusinessProperties.UseDev/UseTest; se ignora el entorno.'
    }
  }

  const businessProperties = data.BusinessProperties
  businessProperties.UseDev = entorno === 'develop'
  businessProperties.UseTest = entorno === 'testing'

  await fs.writeFile(settingsPath, JSON.stringify(data, null, 2), 'utf-8')
  return { applied: true, message: `appsettings.json actualizado para entorno "${entorno}".` }
}
