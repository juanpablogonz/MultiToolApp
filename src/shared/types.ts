// Tipos compartidos entre main, preload y renderer.

export interface CopyButton {
  id: string
  nombre: string
  texto: string
  actualizado: string // ISO date
}

export interface CopyProfile {
  id: string
  nombre: string
  principal: boolean
  botones: CopyButton[]
}

export type ApiEnvironment = 'develop' | 'testing' | 'production'

export interface ApiEntry {
  id: string
  nombre: string
  csprojPath: string // .csproj puntual a correr con `dotnet run --project`
  args: string
  variablesEntorno: Record<string, string>
  habilitada: boolean // si está apagada, "Levantar todas" la salta
  entorno: ApiEnvironment
}

export type Tema = 'claro' | 'oscuro'

export interface AppConfig {
  tema: Tema
  copyPaste: {
    perfiles: CopyProfile[]
  }
  apiLauncher: {
    apis: ApiEntry[]
  }
}

export interface ApiRuntimeStatus {
  id: string
  running: boolean
  pid?: number
  startedAt?: string
  exitCode?: number | null
}

export interface ApiLogLine {
  id: string
  stream: 'stdout' | 'stderr' | 'system'
  text: string
  timestamp: string
}

export const FEATURE_IDS = ['copyPaste', 'formatter', 'diff', 'apiLauncher', 'csharpConverter'] as const
export type FeatureId = (typeof FEATURE_IDS)[number]

export type BackupImportResult = { ok: true; config: AppConfig } | { ok: false; error: string }
