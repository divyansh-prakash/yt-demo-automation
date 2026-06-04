import type { Preset } from '../hooks/usePresets'

interface Props {
  theme: string
  onToggleTheme: () => void
  presets: Preset[]
  activeId: string
  onSelectPreset: (id: string) => void
  onAddPreset: () => void
}

export function Header({ theme, onToggleTheme, presets, activeId, onSelectPreset, onAddPreset }: Props) {
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
          onChange={e => onSelectPreset(e.target.value)}
        >
          {presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="preset-divider" />
        <button className="preset-add" onClick={onAddPreset} title="New config">
          +
        </button>
      </div>

      <button className="hdr-theme-btn" onClick={onToggleTheme} title="Toggle theme">
        {theme === 'light' ? '☀' : '🌙'}
      </button>
    </header>
  )
}
