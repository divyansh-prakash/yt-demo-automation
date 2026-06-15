interface Props {
  message: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ message, description, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <p className="confirm-description">{description}</p>
        <div className="confirm-actions">
          <button className="confirm-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn-confirm" onClick={() => { onConfirm(); onCancel() }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
