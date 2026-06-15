import { useState, useRef, useEffect } from 'react'

interface Props {
  message: string
  placeholder?: string
  confirmLabel: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function NameModal({ message, placeholder = 'Config name', confirmLabel, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleConfirm = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    onCancel()
  }

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <input
          ref={inputRef}
          className="name-modal-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === 'Enter') handleConfirm()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="confirm-actions">
          <button className="confirm-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="confirm-btn-confirm"
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
