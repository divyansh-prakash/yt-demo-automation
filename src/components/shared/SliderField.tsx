interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  fullWidth?: boolean
  onChange: (v: number) => void
}

export function SliderField({ label, value, min, max, step = 1, unit = '', fullWidth, onChange }: Props) {
  return (
    <div className={`ctrl-field${fullWidth ? ' full' : ''}`}>
      <div className="ctrl-label">
        {label}
        <span className="ctrl-val">{Number.isInteger(value) ? value : Math.round(value)}{unit}</span>
      </div>
      <input
        type="range"
        className="ctrl-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
      />
    </div>
  )
}
