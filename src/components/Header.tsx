import type { StoredConfig } from '../hooks/useConfigs'

interface Props {
  theme: string
  onToggleTheme: () => void
  configs: StoredConfig[]
  activeId: string
  onSelectConfig: (id: string) => void
}

export function Header({ theme, onToggleTheme, configs, activeId, onSelectConfig }: Props) {
  return (
    <header className="app-header">
      <div className="hdr-logo">
        <div className="hdr-dot" />
        <span className="hdr-name">Ad Demo</span>
      </div>
      <span className="hdr-version">v8</span>

      <div className="hdr-spacer" />

      <div className="preset-group">
        <select
          className="preset-select"
          value={activeId}
          onChange={e => onSelectConfig(e.target.value)}
        >
          {configs.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <button className="hdr-theme-btn" onClick={onToggleTheme} title="Toggle theme">
        {theme === 'light' ? '☀' : '🌙'}
      </button>
    </header>
  )
}
