import { useRef, useState } from 'react'

interface ToastState {
  message: string
  color: string
  visible: boolean
}

interface ToastOptions {
  color?: string
  duration?: number
}

export function Toast({ message, color, visible }: ToastState) {
  const textColor = color === '#39e88f' || color === '#ffb830' ? '#000' : '#fff'
  return (
    <div
      className={`toast${visible ? ' show' : ''}`}
      style={{ background: color, color: textColor }}
    >
      {message}
    </div>
  )
}

export function useToast() {
  const [state, setState] = useState<ToastState>({ message: '', color: '#39e88f', visible: false })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(message: string, options: ToastOptions | string = '#39e88f') {
    const { color = '#39e88f', duration = 3200 } =
      typeof options === 'string' ? { color: options, duration: 3200 } : options

    if (timerRef.current) clearTimeout(timerRef.current)
    setState({ message, color, visible: true })
    timerRef.current = setTimeout(() => setState(s => ({ ...s, visible: false })), duration)
  }

  return { toastState: state, showToast }
}
