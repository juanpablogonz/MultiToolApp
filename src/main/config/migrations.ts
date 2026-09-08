import { randomUUID } from 'crypto'
import type { AppConfig, ApiEntry, ApiProfile } from '@shared/types'
import { createDefaultConfig } from '@shared/defaultConfig'

// Hasta v1.0.5 apiLauncher guardaba { apis: [...] } sin perfiles. Si encontramos ese
// formato viejo, envolvemos esas APIs en un único perfil para no perder configuración.
export function migrateApiLauncher(raw: unknown): AppConfig['apiLauncher'] {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.perfiles)) {
      return { perfiles: obj.perfiles as ApiProfile[] }
    }
    if (Array.isArray(obj.apis)) {
      return {
        perfiles: [
          {
            id: randomUUID(),
            nombre: 'Perfil 1',
            principal: true,
            apis: obj.apis as ApiEntry[]
          }
        ]
      }
    }
  }
  return createDefaultConfig().apiLauncher
}
