import { useEffect, useRef, useState } from 'react'
import type { ApiEntry, ApiEnvironment, ApiLogLine, ApiRuntimeStatus } from '@shared/types'
import { useConfig } from '../../config/ConfigContext'
import { FeaturePage } from '../../shell/FeaturePage'
import { ConfirmDialog } from '../../shell/ConfirmDialog'
import { IconPencil, IconPlay, IconStop, IconTrash } from '../../shell/Icons'

const ENV_OPTIONS: { value: ApiEnvironment; label: string }[] = [
  { value: 'develop', label: 'Develop' },
  { value: 'testing', label: 'Testing' },
  { value: 'production', label: 'Production' }
]

function newApi(): ApiEntry {
  return {
    id: crypto.randomUUID(),
    nombre: 'Nueva API',
    csprojPath: '',
    args: '',
    variablesEntorno: {},
    habilitada: true,
    entorno: 'develop'
  }
}

function envToText(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

function textToEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return env
}

export function ApiLauncherView() {
  const { config, updateConfig } = useConfig()
  const [statuses, setStatuses] = useState<Record<string, ApiRuntimeStatus>>({})
  const [logs, setLogs] = useState<Record<string, ApiLogLine[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ApiEntry | null>(null)
  const [envText, setEnvText] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ message: string; action: () => void } | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  const apis = config?.apiLauncher.apis ?? []

  useEffect(() => {
    const offLog = window.multiToolApp.apiLauncher.onLog((line) => {
      setLogs((prev) => {
        const list = [...(prev[line.id] ?? []), line].slice(-500)
        return { ...prev, [line.id]: list }
      })
    })
    const offStatus = window.multiToolApp.apiLauncher.onStatus((status) => {
      setStatuses((prev) => ({ ...prev, [status.id]: status }))
    })
    return () => {
      offLog()
      offStatus()
    }
  }, [])

  useEffect(() => {
    if (apis.length === 0) return
    window.multiToolApp.apiLauncher.statusAll(apis.map((a) => a.id)).then((list) => {
      setStatuses((prev) => {
        const next = { ...prev }
        for (const s of list) next[s.id] = s
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apis.length])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' })
  }, [logs, expandedId])

  function isRunning(id: string): boolean {
    return statuses[id]?.running ?? false
  }

  async function start(api: ApiEntry): Promise<void> {
    if (!api.csprojPath) return
    setExpandedId(api.id)
    await window.multiToolApp.apiLauncher.start(api)
  }

  async function stop(id: string): Promise<void> {
    await window.multiToolApp.apiLauncher.stop(id)
  }

  async function startAll(): Promise<void> {
    for (const api of apis) {
      if (api.habilitada && api.csprojPath && !isRunning(api.id)) await start(api)
    }
  }

  function toggleHabilitada(id: string): void {
    updateConfig((draft) => ({
      ...draft,
      apiLauncher: {
        apis: draft.apiLauncher.apis.map((a) => (a.id === id ? { ...a, habilitada: !a.habilitada } : a))
      }
    }))
  }

  async function stopAll(): Promise<void> {
    for (const api of apis) {
      if (isRunning(api.id)) await stop(api.id)
    }
  }

  function openNew(): void {
    const api = newApi()
    setEditing(api)
    setEnvText('')
  }

  function openEdit(api: ApiEntry): void {
    setEditing(api)
    setEnvText(envToText(api.variablesEntorno))
  }

  async function pickCsproj(): Promise<void> {
    if (!editing) return
    const file = await window.multiToolApp.dialog.pickCsproj()
    if (file) setEditing({ ...editing, csprojPath: file })
  }

  function saveApi(): void {
    if (!editing) return
    const api: ApiEntry = { ...editing, variablesEntorno: textToEnv(envText) }
    updateConfig((draft) => {
      const exists = draft.apiLauncher.apis.some((a) => a.id === api.id)
      return {
        ...draft,
        apiLauncher: {
          apis: exists
            ? draft.apiLauncher.apis.map((a) => (a.id === api.id ? api : a))
            : [...draft.apiLauncher.apis, api]
        }
      }
    })
    setEditing(null)
  }

  function deleteApi(id: string): void {
    updateConfig((draft) => ({
      ...draft,
      apiLauncher: { apis: draft.apiLauncher.apis.filter((a) => a.id !== id) }
    }))
  }

  return (
    <FeaturePage
      submenu={
        <>
          <span className="submenu-label">APIs</span>
          <button className="submenu-tab submenu-tab-add" onClick={openNew}>
            + Nueva API
          </button>
        </>
      }
    >
      <div className="toolbar">
        <button className="primary" onClick={startAll}>
          <IconPlay size={14} /> Levantar todas
        </button>
        <button onClick={stopAll}>
          <IconStop size={14} /> Detener todas
        </button>
      </div>

      <div className="api-list">
        {apis.map((api) => {
          const running = isRunning(api.id)
          const expanded = expandedId === api.id
          return (
            <div key={api.id} className={`api-card${api.habilitada ? '' : ' api-card-disabled'}`}>
              <div className="api-card-header">
                <button
                  className={`switch${api.habilitada ? ' on' : ''}`}
                  role="switch"
                  aria-checked={api.habilitada}
                  title={api.habilitada ? 'Deshabilitar (la salta "Levantar todas")' : 'Habilitar'}
                  onClick={() => toggleHabilitada(api.id)}
                />
                <span className={`status-dot${running ? ' running' : ''}`} />
                <span className="api-name">{api.nombre}</span>
                <span className={`env-badge env-badge-${api.entorno}`}>
                  {ENV_OPTIONS.find((o) => o.value === api.entorno)?.label}
                </span>
                <span className="api-path">{api.csprojPath || '(sin proyecto configurado)'}</span>
                <div className="api-actions">
                  {running ? (
                    <button onClick={() => stop(api.id)}>
                      <IconStop size={14} /> Detener
                    </button>
                  ) : (
                    <button className="primary" onClick={() => start(api)} disabled={!api.csprojPath}>
                      <IconPlay size={14} /> Iniciar
                    </button>
                  )}
                  <button onClick={() => setExpandedId(expanded ? null : api.id)}>
                    {expanded ? 'Ocultar log' : 'Ver log'}
                  </button>
                  <button onClick={() => openEdit(api)} title="Editar">
                    <IconPencil size={14} />
                  </button>
                  <button
                    title="Eliminar"
                    onClick={() =>
                      setPendingDelete({
                        message: `¿Eliminar la API "${api.nombre}"?`,
                        action: () => deleteApi(api.id)
                      })
                    }
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
              {expanded && (
                <div className="api-log">
                  {(logs[api.id] ?? []).map((line, i) => (
                    <div key={i} className={`api-log-line api-log-${line.stream}`}>
                      {line.text}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )
        })}
        {apis.length === 0 && <p className="empty-hint">Todavía no configuraste ninguna API. Usá "+ Nueva API".</p>}
      </div>

      {editing && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Configurar API</h3>
            <label>
              Nombre
              <input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
            </label>
            <label>
              Proyecto a ejecutar (.csproj) — si referencia otros proyectos, no hace falta
              indicarlos: se compilan solos
              <div className="input-with-button">
                <input
                  value={editing.csprojPath}
                  onChange={(e) => setEditing({ ...editing, csprojPath: e.target.value })}
                />
                <button onClick={pickCsproj}>Elegir .csproj...</button>
              </div>
            </label>
            <div className="modal-field">
              Entorno (BusinessProperties.UseDev / UseTest en appsettings.json, si existen)
              <div className="radio-group">
                {ENV_OPTIONS.map((opt) => (
                  <label key={opt.value} className="radio-option">
                    <input
                      type="radio"
                      name="entorno"
                      checked={editing.entorno === opt.value}
                      onChange={() => setEditing({ ...editing, entorno: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <label>
              Argumentos extra (opcional)
              <input value={editing.args} onChange={(e) => setEditing({ ...editing, args: e.target.value })} />
            </label>
            <label>
              Variables de entorno (una por línea, KEY=VALOR)
              <textarea rows={4} value={envText} onChange={(e) => setEnvText(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary" onClick={saveApi}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            pendingDelete.action()
            setPendingDelete(null)
          }}
        />
      )}
    </FeaturePage>
  )
}
