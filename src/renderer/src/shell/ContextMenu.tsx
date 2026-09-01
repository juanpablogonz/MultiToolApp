import { useEffect, useRef, type ReactNode } from 'react'

export interface ContextMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

const MENU_WIDTH = 190

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointer(e: MouseEvent): void {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      onClose()
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handlePointer)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(y, window.innerHeight - items.length * 34 - 16)

  return (
    <div ref={ref} className="context-menu" style={{ left, top, width: MENU_WIDTH }}>
      {items.map((item, i) => (
        <button
          key={i}
          className={`context-menu-item${item.danger ? ' context-menu-item-danger' : ''}`}
          onClick={() => {
            item.onClick()
            onClose()
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
