import { useState } from 'react'
import { InfoTooltip } from '../../shared/InfoTooltip'

interface Props {
  title: string
  tooltip?: string
  defaultOpen?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}

export function SidebarSection({ title, tooltip, defaultOpen = false, action, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`s-sec${open ? ' open' : ''}`}>
      <div className="s-sec-header">
        {/* Chevron — only this triggers expand/collapse */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            flexShrink: 0, color: 'var(--text2)',
          }}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <svg
            className="s-sec-chevron"
            viewBox="0 0 13 13" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M3 2.5L9 6.5L3 10.5" />
          </svg>
        </button>
        <span className="s-sec-title">{title}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
        {action}
      </div>
      <div className="s-sec-body">{children}</div>
    </div>
  )
}
