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

export type TerminalKind = 'gitbash' | 'cmd' | 'powershell' | 'vscode'

export interface TerminalButton {
  id: string
  nombre: string
  ruta: string
  consola: TerminalKind
  comoAdministrador: boolean
  solucionPath: string // .sln/.slnx opcional, para "Abrir proyecto"
  actualizado: string // ISO date
}

export interface TerminalProfile {
  id: string
  nombre: string
  principal: boolean
  botones: TerminalButton[]
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
  terminalLauncher: {
    perfiles: TerminalProfile[]
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

export const FEATURE_IDS = [
  'copyPaste',
  'formatter',
  'diff',
  'apiLauncher',
  'csharpConverter',
  'terminalLauncher'
] as const
export type FeatureId = (typeof FEATURE_IDS)[number]

export type BackupImportResult = { ok: true; config: AppConfig } | { ok: false; error: string }

export type TerminalOpenResult = { ok: true } | { ok: false; error: string }

export type ShellOpenResult = { ok: true } | { ok: false; error: string }
