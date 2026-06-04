import { useState } from 'react'
import { InfoTooltip } from '../../shared/InfoTooltip'

interface Props {
  icon: string
  iconBg: string
  title: string
  badge?: string
  tooltip?: string
  defaultCollapsed?: boolean
  children: React.ReactNode
}

export function SidebarCard({ icon, iconBg, title, badge, tooltip, defaultCollapsed = false, children }: Props) {
  const [open, setOpen] = useState(!defaultCollapsed)

  return (
    <div className="s-card">
      <div className="s-card-header">
        <div className="s-card-icon" style={{ background: iconBg }}>{icon}</div>
        <span className="s-card-title">{title}</span>
        {badge && <span className="s-card-badge">{badge}</span>}
        {tooltip && <InfoTooltip text={tooltip} />}

        {/* Collapse toggle — click target is only this button */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none', border: 'none', padding: 4,
            marginLeft: 'auto', cursor: 'pointer', display: 'flex',
            alignItems: 'center', color: 'var(--text3)', borderRadius: 4,
            flexShrink: 0,
          }}
          title={open ? 'Collapse' : 'Expand'}
        >
          <svg
            style={{
              width: 14, height: 14,
              transition: 'transform 0.18s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            viewBox="0 0 14 14" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M3 5l4 4 4-4" />
          </svg>
        </button>
      </div>

      {open && children}
    </div>
  )
}
