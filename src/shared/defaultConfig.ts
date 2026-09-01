import type { AppConfig } from './types'

export function createDefaultConfig(): AppConfig {
  return {
    tema: 'claro',
    copyPaste: {
      perfiles: [
        {
          id: crypto.randomUUID(),
          nombre: 'Perfil 1',
          principal: true,
          botones: []
        }
      ]
    },
    apiLauncher: {
      apis: []
    }
  }
}
