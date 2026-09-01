import { useMemo, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { CopyButton, CopyProfile } from '@shared/types'
import { useConfig } from '../../config/ConfigContext'
import { FeaturePage } from '../../shell/FeaturePage'
import { ConfirmDialog } from '../../shell/ConfirmDialog'
import { ContextMenu, type ContextMenuItem } from '../../shell/ContextMenu'
import { IconPencil, IconStar, IconTrash } from '../../shell/Icons'
import { useClipboard } from '../../shell/useClipboard'

function newButton(): CopyButton {
  return {
    id: crypto.randomUUID(),
    nombre: 'Nuevo botón',
    texto: '',
    actualizado: new Date().toISOString()
  }
}

function newProfile(nombre: string): CopyProfile {
  return { id: crypto.randomUUID(), nombre, principal: false, botones: [] }
}

function orderProfiles(perfiles: CopyProfile[]): CopyProfile[] {
  const principal = perfiles.find((p) => p.principal)
  const resto = perfiles.filter((p) => !p.principal)
  return principal ? [principal, ...resto] : resto
}

interface MenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export function CopyPasteView() {
  const { config, updateConfig } = useConfig()
  const { copy: copyToClipboard } = useClipboard()
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [editing, setEditing] = useState<CopyButton | null>(null)
  const [editingProfile, setEditingProfile] = useState<CopyProfile | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ message: string; action: () => void } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const perfilesOrdenados = useMemo(() => orderProfiles(config?.copyPaste.perfiles ?? []), [config])
  const activeProfile = useMemo(
    () => perfilesOrdenados.find((p) => p.id === activeProfileId) ?? perfilesOrdenados[0] ?? null,
    [perfilesOrdenados, activeProfileId]
  )

  function copy(texto: string, nombre: string): void {
    copyToClipboard(texto, nombre)
  }

  function addProfile(): void {
    const nombre = `Perfil ${perfilesOrdenados.length + 1}`
    updateConfig((draft) => ({
      ...draft,
      copyPaste: { perfiles: [...draft.copyPaste.perfiles, newProfile(nombre)] }
    }))
  }

  function removeProfile(id: string): void {
    if (perfilesOrdenados.length <= 1) return
    updateConfig((draft) => ({
      ...draft,
      copyPaste: { perfiles: draft.copyPaste.perfiles.filter((p) => p.id !== id) }
    }))
  }

  function saveProfile(updated: CopyProfile): void {
    updateConfig((draft) => {
      const perfiles = draft.copyPaste.perfiles.map((p) => {
        if (p.id === updated.id) return updated
        // solo puede haber un perfil principal a la vez
        if (updated.principal && p.principal) return { ...p, principal: false }
        return p
      })
      return { ...draft, copyPaste: { perfiles } }
    })
    setEditingProfile(null)
  }

  function addButton(): void {
    if (!activeProfile) return
    const btn = newButton()
    updateConfig((draft) => ({
      ...draft,
      copyPaste: {
        perfiles: draft.copyPaste.perfiles.map((p) =>
          p.id === activeProfile.id ? { ...p, botones: [...p.botones, btn] } : p
        )
      }
    }))
    setEditing(btn)
  }

  function saveButton(updated: CopyButton): void {
    if (!activeProfile) return
    updateConfig((draft) => ({
      ...draft,
      copyPaste: {
        perfiles: draft.copyPaste.perfiles.map((p) =>
          p.id !== activeProfile.id
            ? p
            : {
                ...p,
                botones: p.botones.map((b) =>
                  b.id === updated.id ? { ...updated, actualizado: new Date().toISOString() } : b
                )
              }
        )
      }
    }))
    setEditing(null)
  }

  function deleteButton(id: string): void {
    if (!activeProfile) return
    updateConfig((draft) => ({
      ...draft,
      copyPaste: {
        perfiles: draft.copyPaste.perfiles.map((p) =>
          p.id !== activeProfile.id ? p : { ...p, botones: p.botones.filter((b) => b.id !== id) }
        )
      }
    }))
  }

  function openButtonMenu(e: ReactMouseEvent, b: CopyButton): void {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Editar', icon: <IconPencil size={14} />, onClick: () => setEditing(b) },
        {
          label: 'Eliminar',
          icon: <IconTrash size={14} />,
          danger: true,
          onClick: () =>
            setPendingDelete({
              message: `¿Eliminar el botón "${b.nombre}"?`,
              action: () => deleteButton(b.id)
            })
        }
      ]
    })
  }

  function openProfileMenu(e: ReactMouseEvent, p: CopyProfile): void {
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
            message: `¿Eliminar el perfil "${p.nombre}" y todos sus botones?`,
            action: () => removeProfile(p.id)
          })
      })
    }
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  function handleTabDragStart(p: CopyProfile): void {
    if (p.principal) return
    setDraggingId(p.id)
  }

  function handleTabDragOver(e: DragEvent, target: CopyProfile): void {
    if (!draggingId || target.principal) return
    e.preventDefault()
    setDragOverId(target.id)
    if (draggingId === target.id) return
    updateConfig((draft) => {
      const list = [...draft.copyPaste.perfiles]
      const from = list.findIndex((p) => p.id === draggingId)
      const to = list.findIndex((p) => p.id === target.id)
      if (from === -1 || to === -1 || from === to) return draft
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return { ...draft, copyPaste: { perfiles: list } }
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
      <div className="copy-grid">
        {activeProfile.botones.map((b) => (
          <div
            key={b.id}
            className="copy-tile"
            onClick={() => copy(b.texto, b.nombre)}
            onContextMenu={(e) => openButtonMenu(e, b)}
          >
            <span className="copy-tile-name">{b.nombre}</span>
          </div>
        ))}
        <button className="copy-tile copy-tile-add" onClick={addButton}>
          + Nuevo botón
        </button>
      </div>

      {editing && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Editar botón</h3>
            <label>
              Nombre (máx. 30 caracteres)
              <input
                value={editing.nombre}
                maxLength={30}
                onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
              />
            </label>
            <label>
              Texto a copiar
              <textarea
                rows={6}
                value={editing.texto}
                onChange={(e) => setEditing({ ...editing, texto: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary" onClick={() => saveButton(editing)}>
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
