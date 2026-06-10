import { useEffect, useState } from 'react'
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

function useTimeInput(initial: number, onCommit: (v: number) => void) {
  const [str, setStr] = useState(String(initial))

  useEffect(() => {
    setStr(String(initial))
  }, [initial])

  return {
    value: str,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setStr(e.target.value)
      if (e.target.value !== '') onCommit(Math.min(59, Math.max(0, +e.target.value)))
    },
    onBlur: () => {
      const n = str === '' || isNaN(+str) ? 0 : Math.min(59, Math.max(0, +str))
      setStr(String(n))
      onCommit(n)
    },
  }
}

export function TimingCard({ config: c, setConfig }: Props) {
  const tsMin    = useTimeInput(c.tsMin,     v => setConfig({ tsMin: v }))
  const tsSec    = useTimeInput(c.tsSec,     v => setConfig({ tsSec: v }))



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
            <input className="timing-input" type="number" min={0} max={59} {...tsMin} />
            <span className="timing-sep">:</span>
            <input className="timing-input" type="number" min={0} max={59} {...tsSec} />
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
              <span className="ctrl-val">{c.tmFont}px</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                style={BTN}
                disabled={c.tmFont <= 1}
                onClick={() => setConfig({ tmFont: Math.max(1, c.tmFont - 1) })}
              >−</button>
              <input
                type="range" className="ctrl-slider"
                min={1} max={72} step={1}
                value={c.tmFont}
                onChange={e => setConfig({ tmFont: +e.target.value })}
                style={{ flex: 1 }}
              />
              <button
                style={BTN}
                onClick={() => setConfig({ tmFont: Math.min(72, c.tmFont + 1) })}
              >+</button>
            </div>
          </div>
        </div>


      </div>
    </SidebarCard>
  )
}
