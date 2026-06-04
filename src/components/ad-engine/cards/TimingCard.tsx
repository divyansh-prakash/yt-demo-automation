import { SidebarCard } from '../shared/SidebarCard'
import { SliderField } from '../../shared/SliderField'
import type { AdEngineConfig } from '../../../types'

const BTN = {
  width: 28, height: 28, border: '1px solid var(--border)',
  background: 'var(--surface)', borderRadius: 'var(--radius-xs)',
  cursor: 'pointer', fontSize: 16, fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, color: 'var(--text2)',
} as const

interface Props {
  config: AdEngineConfig
  setConfig: (u: Partial<AdEngineConfig>) => void
}

export function TimingCard({ config: c, setConfig }: Props) {
  // Compute the effective (actually rendered) timer font size.
  // drawTimer enforces a minimum of adH * 0.06 so small values have no effect.
  const adW          = 1280 * (c.avScale / 100)
  const adH          = adW * (9 / 16)
  const tmFontFloor  = Math.round(adH * 0.06)
  const effectiveFont = Math.max(c.tmFont, tmFontFloor)

  return (
    <SidebarCard
      icon="⏱" iconBg="#fff8e6"
      title="Ad Timer"
      tooltip="Sets when each element appears and how the ad timer badge looks."
    >
      <div className="s-card-body" style={{ gap: 14 }}>

        {/* Ad trigger */}
        <div className="timing-block">
          <div className="timing-block-label">Ad appears at</div>
          <div className="timing-hint">When the mid-roll ad interrupts the video</div>
          <div className="timing-row">
            <input
              className="timing-input" type="number" min={0} max={59}
              value={c.tsMin} onChange={e => setConfig({ tsMin: +e.target.value })}
            />
            <span className="timing-sep">:</span>
            <input
              className="timing-input" type="number" min={0} max={59}
              value={c.tsSec} onChange={e => setConfig({ tsSec: +e.target.value })}
            />
            <select
              className="timing-dur"
              value={c.adDur}
              onChange={e => setConfig({ adDur: +e.target.value as AdEngineConfig['adDur'] })}
            >
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={6}>6s</option>
            </select>
          </div>
        </div>

        <div className="s-divider" />

        {/* Ad timer badge — position + font, grouped with ad timing */}
        <div className="timing-block">
          <div className="timing-block-label">Ad timer badge</div>
          <div className="timing-hint">Countdown shown during the ad — drag it on the canvas to reposition</div>
          <div className="ctrl-grid" style={{ marginTop: 8 }}>
            <SliderField label="X" value={c.tmX} min={0} max={95} unit="%" onChange={v => setConfig({ tmX: v })} />
            <SliderField label="Y" value={c.tmY} min={0} max={95} unit="%" onChange={v => setConfig({ tmY: v })} />
          </div>
          <div className="ctrl-field" style={{ marginTop: 6 }}>
            <div className="ctrl-label">
              Font size
              <span className="ctrl-val">{effectiveFont}px</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                style={BTN}
                disabled={effectiveFont <= tmFontFloor}
                onClick={() => setConfig({ tmFont: Math.max(tmFontFloor, effectiveFont - 1) })}
              >−</button>
              <input
                type="range" className="ctrl-slider"
                min={tmFontFloor} max={72} step={1}
                value={effectiveFont}
                onChange={e => setConfig({ tmFont: +e.target.value })}
                style={{ flex: 1 }}
              />
              <button
                style={BTN}
                onClick={() => setConfig({ tmFont: Math.min(72, effectiveFont + 1) })}
              >+</button>
            </div>
          </div>
        </div>

        <div className="s-divider" />

        {/* Banner trigger */}
        <div className="timing-block">
          <div className="timing-block-label">Banner slides in at</div>
          <div className="timing-hint">When the slide banner animates into frame</div>
          <div className="timing-row">
            <input
              className="timing-input" type="number" min={0} max={59}
              value={c.bannerMin} onChange={e => setConfig({ bannerMin: +e.target.value })}
            />
            <span className="timing-sep">:</span>
            <input
              className="timing-input" type="number" min={0} max={59}
              value={c.bannerSec} onChange={e => setConfig({ bannerSec: +e.target.value })}
            />
          </div>
        </div>

      </div>
    </SidebarCard>
  )
}
