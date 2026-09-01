import { spawn, ChildProcess } from 'child_process'
import { dirname } from 'path'
import type { BrowserWindow } from 'electron'
import type { ApiEntry, ApiLogLine, ApiRuntimeStatus } from '@shared/types'
import { applyEnvironmentToAppSettings } from './appSettings'

interface RunningProcess {
  child: ChildProcess
  startedAt: string
}

const running = new Map<string, RunningProcess>()

function send(win: BrowserWindow, channel: string, payload: unknown): void {
  if (win.isDestroyed()) return
  win.webContents.send(channel, payload)
}

function emitLog(win: BrowserWindow, line: ApiLogLine): void {
  send(win, 'apiLauncher:log', line)
}

function emitStatus(win: BrowserWindow, status: ApiRuntimeStatus): void {
  send(win, 'apiLauncher:status', status)
}

export function getStatus(id: string): ApiRuntimeStatus {
  const proc = running.get(id)
  if (!proc) return { id, running: false }
  return { id, running: true, pid: proc.child.pid, startedAt: proc.startedAt }
}

export async function startApi(win: BrowserWindow, api: ApiEntry): Promise<ApiRuntimeStatus> {
  if (running.has(api.id)) return getStatus(api.id)

  const logSystem = (text: string): void =>
    emitLog(win, { id: api.id, stream: 'system', text, timestamp: new Date().toISOString() })

  logSystem(`Iniciando "${api.nombre}" (${api.csprojPath}) ...`)

  const envResult = await applyEnvironmentToAppSettings(api.csprojPath, api.entorno)
  logSystem(envResult.message)

  if (running.has(api.id)) return getStatus(api.id)

  const extraArgs = api.args.trim().length > 0 ? api.args.trim().split(/\s+/) : []
  const child = spawn('dotnet', ['run', '--project', api.csprojPath, ...extraArgs], {
    cwd: dirname(api.csprojPath),
    env: { ...process.env, ...api.variablesEntorno },
    shell: false
  })

  const startedAt = new Date().toISOString()
  running.set(api.id, { child, startedAt })

  child.stdout?.on('data', (chunk: Buffer) => {
    emitLog(win, { id: api.id, stream: 'stdout', text: chunk.toString(), timestamp: new Date().toISOString() })
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    emitLog(win, { id: api.id, stream: 'stderr', text: chunk.toString(), timestamp: new Date().toISOString() })
  })

  child.on('error', (err) => {
    logSystem(`Error al iniciar el proceso: ${err.message}`)
  })

  child.on('exit', (code) => {
    running.delete(api.id)
    logSystem(`Proceso finalizado (código ${code ?? 'desconocido'}).`)
    emitStatus(win, { id: api.id, running: false, exitCode: code })
  })

  const status = getStatus(api.id)
  emitStatus(win, status)
  return status
}

export function stopApi(id: string): ApiRuntimeStatus {
  const proc = running.get(id)
  if (!proc) return { id, running: false }
  // taskkill /T mata todo el árbol de procesos (dotnet suele generar procesos hijos).
  if (process.platform === 'win32' && proc.child.pid) {
    spawn('taskkill', ['/pid', String(proc.child.pid), '/T', '/F'])
  } else {
    proc.child.kill('SIGTERM')
  }
  return { id, running: true, pid: proc.child.pid, startedAt: proc.startedAt }
}

export function stopAll(): void {
  for (const id of running.keys()) stopApi(id)
}

export function getAllStatuses(ids: string[]): ApiRuntimeStatus[] {
  return ids.map(getStatus)
}
