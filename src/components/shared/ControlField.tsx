// Canvas recording dimensions — used for px ↔ % conversion
export const DIM = { x: 1280, y: 720, w: 1280, h: 720 } as const
export type Dim = keyof typeof DIM

interface Props {
  label: string
  value: number        // always stored as % (0–100)
  min: number
  max: number
  step?: number
  dim?: Dim            // enables px ↔ % mode when provided
  usePx: boolean
  fullWidth?: boolean
  onChange: (pct: number) => void
}

export function ControlField({ label, value, min, max, step = 1, dim, usePx, fullWidth, onChange }: Props) {
  const showPx = usePx && !!dim

  if (showPx) {
    const maxPx   = DIM[dim!]
    const pxValue = Math.round(value / 100 * maxPx)
    const minPx   = Math.round(min / 100 * maxPx)

    return (
      <div className={`ctrl-field${fullWidth ? ' full' : ''}`}>
        <div className="ctrl-label">
          {label}
          <span className="ctrl-val">{pxValue}px</span>
        </div>
        <input
          type="number"
          className="ctrl-number"
          value={pxValue}
          min={minPx}
          max={maxPx}
          onChange={e => {
            const px  = Math.max(minPx, Math.min(maxPx, +e.target.value))
            onChange(px / maxPx * 100)
          }}
        />
      </div>
    )
  }

  return (
    <div className={`ctrl-field${fullWidth ? ' full' : ''}`}>
      <div className="ctrl-label">
        {label}
        <span className="ctrl-val">{Math.round(value)}%</span>
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
