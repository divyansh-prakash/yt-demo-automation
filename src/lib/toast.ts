import { toast } from 'sonner'

// Wraps sonner so existing showToast(msg, { color, duration }) call sites need no changes.
export function showToast(message: string, options: { color?: string; duration?: number } | string = '#39e88f') {
  const { color = '#39e88f', duration = 3200 } =
    typeof options === 'string' ? { color: options, duration: 3200 } : options

  const opts = { duration }
  if (color === '#39e88f') return toast.success(message, opts)
  if (color === '#ef4444') return toast.error(message, opts)
  if (color === '#d97706' || color === '#ffb830') return toast.warning(message, opts)
  return toast(message, opts)
}

// Confirmation toast — shows message with two action buttons.
// Calls onConfirm if user clicks the confirm button, does nothing on cancel.
export function confirmToast(message: string, description: string, confirmLabel: string, onConfirm: () => void) {
  toast(message, {
    description,
    duration: Infinity,
    position: 'top-center',
    action:  { label: confirmLabel, onClick: onConfirm },
    cancel:  { label: 'Cancel', onClick: () => {} },
  })
}
