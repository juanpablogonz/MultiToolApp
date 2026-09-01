interface Props {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ message, confirmLabel = 'Eliminar', onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal confirm-modal">
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancelar</button>
          <button className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
