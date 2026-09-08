import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { ApiEntry, ApiEnvironment, ApiLogLine, ApiProfile, ApiRuntimeStatus } from '@shared/types'
import { useConfig } from '../../config/ConfigContext'
import { FeaturePage } from '../../shell/FeaturePage'
import { ConfirmDialog } from '../../shell/ConfirmDialog'
import { ContextMenu, type ContextMenuItem } from '../../shell/ContextMenu'
import { IconPencil, IconPlay, IconStar, IconStop, IconTrash } from '../../shell/Icons'

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

function newProfile(nombre: string): ApiProfile {
  return { id: crypto.randomUUID(), nombre, principal: false, apis: [] }
}

function orderProfiles(perfiles: ApiProfile[]): ApiProfile[] {
  const principal = perfiles.find((p) => p.principal)
  const resto = perfiles.filter((p) => !p.principal)
  return principal ? [principal, ...resto] : resto
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

interface MenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export function ApiLauncherView() {
  const { config, updateConfig } = useConfig()
  const [statuses, setStatuses] = useState<Record<string, ApiRuntimeStatus>>({})
  const [logs, setLogs] = useState<Record<string, ApiLogLine[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ApiEntry | null>(null)
  const [envText, setEnvText] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ message: string; action: () => void } | null>(null)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<ApiProfile | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  const perfilesOrdenados = useMemo(
    () => orderProfiles(config?.apiLauncher.perfiles ?? []),
    [config]
  )
  const activeProfile = useMemo(
    () => perfilesOrdenados.find((p) => p.id === activeProfileId) ?? perfilesOrdenados[0] ?? null,
    [perfilesOrdenados, activeProfileId]
  )
  const apis = activeProfile?.apis ?? []
  const allApiIds = useMemo(() => perfilesOrdenados.flatMap((p) => p.apis.map((a) => a.id)), [perfilesOrdenados])

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
    if (allApiIds.length === 0) return
    window.multiToolApp.apiLauncher.statusAll(allApiIds).then((list) => {
      setStatuses((prev) => {
        const next = { ...prev }
        for (const s of list) next[s.id] = s
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allApiIds.length])

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

  async function stopAll(): Promise<void> {
    for (const api of apis) {
      if (isRunning(api.id)) await stop(api.id)
    }
  }

  function toggleHabilitada(id: string): void {
    if (!activeProfile) return
    updateConfig((draft) => ({
      ...draft,
      apiLauncher: {
        perfiles: draft.apiLauncher.perfiles.map((p) =>
          p.id !== activeProfile.id
            ? p
            : { ...p, apis: p.apis.map((a) => (a.id === id ? { ...a, habilitada: !a.habilitada } : a)) }
        )
      }
    }))
  }

  function addProfile(): void {
    const nombre = `Perfil ${perfilesOrdenados.length + 1}`
    updateConfig((draft) => ({
      ...draft,
      apiLauncher: { perfiles: [...draft.apiLauncher.perfiles, newProfile(nombre)] }
    }))
  }

  function removeProfile(id: string): void {
    if (perfilesOrdenados.length <= 1) return
    updateConfig((draft) => ({
      ...draft,
      apiLauncher: { perfiles: draft.apiLauncher.perfiles.filter((p) => p.id !== id) }
    }))
  }

  function saveProfile(updated: ApiProfile): void {
    updateConfig((draft) => {
      const perfiles = draft.apiLauncher.perfiles.map((p) => {
        if (p.id === updated.id) return updated
        // solo puede haber un perfil principal a la vez
        if (updated.principal && p.principal) return { ...p, principal: false }
        return p
      })
      return { ...draft, apiLauncher: { perfiles } }
    })
    setEditingProfile(null)
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
    if (!editing || !activeProfile) return
    const api: ApiEntry = { ...editing, variablesEntorno: textToEnv(envText) }
    updateConfig((draft) => ({
      ...draft,
      apiLauncher: {
        perfiles: draft.apiLauncher.perfiles.map((p) => {
          if (p.id !== activeProfile.id) return p
          const exists = p.apis.some((a) => a.id === api.id)
          return { ...p, apis: exists ? p.apis.map((a) => (a.id === api.id ? api : a)) : [...p.apis, api] }
        })
      }
    }))
    setEditing(null)
  }

  function deleteApi(id: string): void {
    if (!activeProfile) return
    updateConfig((draft) => ({
      ...draft,
      apiLauncher: {
        perfiles: draft.apiLauncher.perfiles.map((p) =>
          p.id !== activeProfile.id ? p : { ...p, apis: p.apis.filter((a) => a.id !== id) }
        )
      }
    }))
  }

  function openProfileMenu(e: ReactMouseEvent, p: ApiProfile): void {
    e.preventDefault()
    e.stopPropagation()
    const items: ContextMenuItem[] = [
      { label: 'Editar perfil', icon: <IconPencil size={14} />, onClick: () => setEditingProfile(p) }
    ]
    if (perfilesOrdenados.length > 1) {
      items.push({
        label: 'Eliminar perfil',
        icon: <IconTrash size={14} />,
        danger: true,
        onClick: () =>
          setPendingDelete({
            message: `¿Eliminar el perfil "${p.nombre}" y todas sus APIs?`,
            action: () => removeProfile(p.id)
          })
      })
    }
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  function handleTabDragStart(p: ApiProfile): void {
    if (p.principal) return
    setDraggingId(p.id)
  }

  function handleTabDragOver(e: DragEvent, target: ApiProfile): void {
    if (!draggingId || target.principal) return
    e.preventDefault()
    setDragOverId(target.id)
    if (draggingId === target.id) return
    updateConfig((draft) => {
      const list = [...draft.apiLauncher.perfiles]
      const from = list.findIndex((p) => p.id === draggingId)
      const to = list.findIndex((p) => p.id === target.id)
      if (from === -1 || to === -1 || from === to) return draft
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return { ...draft, apiLauncher: { perfiles: list } }
    })
  }

  function handleTabDragEnd(): void {
    setDraggingId(null)
    setDragOverId(null)
  }

  if (!config || !activeProfile) return <FeaturePage submenu={null}>Cargando...</FeaturePage>

  return (
    <FeaturePage
      submenu={
        <>
          {perfilesOrdenados.map((p) => (
            <button
              key={p.id}
              draggable={!p.principal}
              onDragStart={() => handleTabDragStart(p)}
              onDragOver={(e) => handleTabDragOver(e, p)}
              onDragEnd={handleTabDragEnd}
              onDrop={(e) => e.preventDefault()}
              className={`submenu-tab${p.id === activeProfile.id ? ' active' : ''}${
                draggingId === p.id ? ' dragging' : ''
              }${dragOverId === p.id && draggingId !== p.id ? ' drag-over' : ''}`}
              onClick={() => setActiveProfileId(p.id)}
              onContextMenu={(e) => openProfileMenu(e, p)}
            >
              {p.principal && <IconStar size={13} />}
              {p.nombre}
            </button>
          ))}
          <button className="submenu-tab submenu-tab-add" onClick={addProfile}>
            + Perfil
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
        <button onClick={openNew}>+ Nueva API</button>
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

      {editingProfile && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Editar perfil</h3>
            <label>
              Nombre (máx. 20 caracteres)
              <input
                value={editingProfile.nombre}
                maxLength={20}
                onChange={(e) => setEditingProfile({ ...editingProfile, nombre: e.target.value })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editingProfile.principal}
                onChange={(e) => setEditingProfile({ ...editingProfile, principal: e.target.checked })}
              />
              Perfil principal (aparece siempre primero)
            </label>
            <div className="modal-actions">
              <button onClick={() => setEditingProfile(null)}>Cancelar</button>
              <button className="primary" onClick={() => saveProfile(editingProfile)}>
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

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </FeaturePage>
  )
}
