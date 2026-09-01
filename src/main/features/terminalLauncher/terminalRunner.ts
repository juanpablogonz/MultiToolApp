import { spawn } from 'child_process'
import { exec } from 'child_process'
import { promisify } from 'util'
import { access, stat } from 'fs/promises'
import type { TerminalKind, TerminalOpenResult } from '@shared/types'

const execAsync = promisify(exec)

let cachedGitBashPath: string | null | undefined

// Lee el mismo comando que usa el menú contextual de Windows ("Git Bash Here"),
// así encontramos git-bash.exe sin importar dónde lo haya instalado el usuario.
async function readGitBashFromContextMenu(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      'reg query "HKCR\\Directory\\Background\\shell\\git_shell\\command" /ve'
    )
    const match = stdout.match(/"([^"]+git-bash\.exe)"/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function findGitBashExe(): Promise<string | null> {
  if (cachedGitBashPath !== undefined) return cachedGitBashPath

  const candidates = [await readGitBashFromContextMenu()].filter((p): p is string => !!p)
  candidates.push(
    `${process.env.ProgramFiles}\\Git\\git-bash.exe`,
    `${process.env['ProgramFiles(x86)']}\\Git\\git-bash.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Git\\git-bash.exe`
  )

  for (const candidate of candidates) {
    try {
      await access(candidate)
      cachedGitBashPath = candidate
      return candidate
    } catch {
      continue
    }
  }

  cachedGitBashPath = null
  return null
}

interface LaunchSpec {
  exe: string
  args: string[]
  cwd?: string
}

async function buildLaunchSpec(
  kind: TerminalKind,
  path: string
): Promise<LaunchSpec | { error: string }> {
  if (kind === 'gitbash') {
    const exePath = await findGitBashExe()
    if (!exePath) {
      return { error: 'No se encontró Git Bash instalado. Instalá Git for Windows para usar este módulo.' }
    }
    return { exe: exePath, args: [`--cd=${path}`] }
  }
  // cmd.exe y powershell.exe son programas de consola: si heredan nuestro stdio
  // "ignore" (redirigido a NUL), leen EOF al toque y se cierran solos apenas abren.
  // `start` les crea una consola nueva de verdad en vez de heredar esos handles.
  const target = kind === 'cmd' ? 'cmd.exe' : 'powershell.exe'
  return { exe: 'cmd.exe', args: ['/c', 'start', '""', '/D', path, target] }
}

// PowerShell necesita las comillas simples escapadas (doblándolas) para armar
// el -Command que dispara el UAC vía Start-Process -Verb RunAs.
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

// Comilla un argumento individual si tiene espacios, para poder armar a mano una
// única línea de comando (ver por qué en launchElevated).
function quoteArgIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value
}

function launch(spec: LaunchSpec): TerminalOpenResult {
  try {
    const child = spawn(spec.exe, spec.args, { cwd: spec.cwd, detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo abrir la terminal.' }
  }
}

function launchElevated(spec: LaunchSpec): TerminalOpenResult {
  const parts = [`Start-Process -FilePath ${psQuote(spec.exe)}`]
  // Con -Verb RunAs, Start-Process pasa los argumentos a ShellExecuteEx como un único
  // string: si le mandamos un array, PowerShell los junta con espacios SIN volver a
  // citar los que tienen espacios (ej: la ruta de la carpeta), rompiendo el comando en
  // silencio. Por eso armamos nosotros un solo string ya citado correctamente.
  if (spec.args.length > 0) {
    const argString = spec.args.map(quoteArgIfNeeded).join(' ')
    parts.push(`-ArgumentList ${psQuote(argString)}`)
  }
  if (spec.cwd) parts.push(`-WorkingDirectory ${psQuote(spec.cwd)}`)
  parts.push('-Verb RunAs')
  const script = parts.join(' ')

  // El script tiene comillas simples, dobles y backslashes anidados (por la ruta).
  // Pasarlo como -Command de texto significa que Node lo re-escapa para la línea de
  // comandos de Windows y PowerShell lo vuelve a parsear del otro lado: dos pasadas
  // de escaping que rompen las comillas anidadas. -EncodedCommand evita todo eso:
  // viaja en Base64, sin ningún carácter que se pueda romper en el camino.
  const encoded = Buffer.from(script, 'utf16le').toString('base64')

  try {
    // powershell.exe con stdio "ignore" (sin consola real de verdad, redirigido a NUL)
    // no llega a disparar el UAC: Start-Process -Verb RunAs se pierde en silencio. Lo
    // envolvemos con `cmd /c start` (igual que el lanzador normal de cmd/powershell)
    // para que consiga una consola real antes de pedir la elevación; se cierra solo
    // apenas termina, así que ni se nota.
    const child = spawn(
      'cmd.exe',
      ['/c', 'start', '""', '/min', 'powershell.exe', '-NoProfile', '-EncodedCommand', encoded],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo abrir la terminal como administrador.' }
  }
}

export async function openTerminalAt(
  targetPath: string,
  kind: TerminalKind,
  comoAdministrador: boolean
): Promise<TerminalOpenResult> {
  const path = targetPath.trim()
  if (!path) return { ok: false, error: 'Este botón no tiene una ruta configurada.' }

  const safeKind: TerminalKind = kind === 'cmd' || kind === 'powershell' ? kind : 'gitbash'

  try {
    const info = await stat(path)
    if (!info.isDirectory()) return { ok: false, error: 'La ruta configurada no es una carpeta.' }
  } catch {
    return { ok: false, error: `La carpeta no existe: ${path}` }
  }

  const spec = await buildLaunchSpec(safeKind, path)
  if ('error' in spec) return { ok: false, error: spec.error }

  return comoAdministrador ? launchElevated(spec) : launch(spec)
}
