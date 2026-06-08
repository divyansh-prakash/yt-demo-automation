import { useState } from 'react'
import { SidebarCard } from '../shared/SidebarCard'
import { SidebarSection } from '../shared/SidebarSection'
import { SliderField } from '../../shared/SliderField'
import type { AdEngineConfig } from '../../../types'

const W = 1280, H = 720

interface Props {
  config: AdEngineConfig
  setConfig: (u: Partial<AdEngineConfig>) => void
  defaultCollapsed?: boolean
}

export function SlideBannerCard({ config: c, setConfig, defaultCollapsed }: Props) {
  const [maskUnit, setMaskUnit] = useState<'px' | '%'>('px')

  const toDisplay  = (px: number, axis: 'x' | 'y') =>
    maskUnit === '%' ? +((px / (axis === 'x' ? W : H)) * 100).toFixed(1) : px
  const fromInput  = (v: number, axis: 'x' | 'y') =>
    maskUnit === '%' ? Math.round(v / 100 * (axis === 'x' ? W : H)) : v

  const fmt = (px: number, axis: 'x' | 'y') =>
    maskUnit === '%' ? `${toDisplay(px, axis)}%` : `${px}px`

  return (
    <SidebarCard
      icon="🎞" iconBg="#fff0e6"
      title="Slide Banner"
      tooltip="An animated panel that slides in over the suggested videos section of the YouTube screen."
      defaultCollapsed={defaultCollapsed}
    >
      <SidebarSection
        title="Mask region"
        tooltip="The rectangular area where the slide animation happens. Match this to the suggested videos panel in your recording."
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button
            className={`unit-toggle${maskUnit === 'px' ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); setMaskUnit(u => u === 'px' ? '%' : 'px') }}
            title="Toggle between pixel and percentage values"
          >
            {maskUnit === 'px' ? 'px' : '%'}
          </button>
        </div>
        <div className="ctrl-grid">
          <div className="ctrl-field">
            <div className="ctrl-label">Left <span className="ctrl-val">{fmt(c.maskX, 'x')}</span></div>
            <input type="number" className="ctrl-number" value={toDisplay(c.maskX, 'x')} min={0}
              onChange={e => setConfig({ maskX: fromInput(+e.target.value, 'x') })} />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Top <span className="ctrl-val">{fmt(c.maskY, 'y')}</span></div>
            <input type="number" className="ctrl-number" value={toDisplay(c.maskY, 'y')} min={0}
              onChange={e => setConfig({ maskY: fromInput(+e.target.value, 'y') })} />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Width <span className="ctrl-val">{fmt(c.maskW, 'x')}</span></div>
            <input type="number" className="ctrl-number" value={toDisplay(c.maskW, 'x')} min={1}
              onChange={e => setConfig({ maskW: Math.max(1, fromInput(+e.target.value, 'x')) })} />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Height <span className="ctrl-val">{fmt(c.maskH, 'y')}</span></div>
            <input type="number" className="ctrl-number" value={toDisplay(c.maskH, 'y')} min={1}
              onChange={e => setConfig({ maskH: Math.max(1, fromInput(+e.target.value, 'y')) })} />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection
        title="Slide motion"
        tooltip="How far and in which direction the panel slides in, and how it accelerates."
      >
        <SliderField label="Distance" unit="px" value={c.slideAmt} min={0} max={200} onChange={v => setConfig({ slideAmt: v })} />
        <SliderField label="Duration" unit="s" value={c.slideDur} min={0.1} max={5} step={0.1} onChange={v => setConfig({ slideDur: v })} />
        <div className="ctrl-dir-row">
          <select className="ctrl-select" value={c.slideDir} onChange={e => setConfig({ slideDir: e.target.value as AdEngineConfig['slideDir'] })}>
            <option value="up">Up ↑</option>
            <option value="down">Down ↓</option>
            <option value="left">Left ←</option>
            <option value="right">Right →</option>
          </select>
          <select className="ctrl-select" value={c.easing} onChange={e => setConfig({ easing: e.target.value as AdEngineConfig['easing'] })}>
            <option value="ease">Ease in-out</option>
            <option value="linear">Linear</option>
            <option value="bounce">Bounce</option>
            <option value="elastic">Elastic</option>
          </select>
        </div>
      </SidebarSection>

      <SidebarSection
        title="Image position"
        tooltip="Position and scale of the slide banner image within the mask region."
      >
        <div className="ctrl-grid">
          <SliderField label="X offset" unit="px" value={c.slideImgOffX} min={-200} max={200} onChange={v => setConfig({ slideImgOffX: v })} />
          <SliderField label="Y offset" unit="px" value={c.slideImgOffY} min={-200} max={200} onChange={v => setConfig({ slideImgOffY: v })} />
          <SliderField label="Scale" value={c.slideImgScale} min={0.1} max={5} step={0.05} fullWidth onChange={v => setConfig({ slideImgScale: v })} />
        </div>
      </SidebarSection>

      <SidebarSection
        title="Colour panel"
        tooltip="A coloured background that slides in with the banner to create a clean reveal behind the image."
      >
        <div className="color-row">
          <input
            type="color"
            className="color-swatch"
            value={c.panelColor}
            onChange={e => setConfig({ panelColor: e.target.value })}
          />
          <span className="color-text">{c.panelColor}</span>
        </div>
        <SliderField label="Opacity" unit="%" value={Math.round(c.panelOpacity * 100)} min={0} max={100} onChange={v => setConfig({ panelOpacity: v / 100 })} />
        <div className="ctrl-field">
          <div className="ctrl-label">Panel height <span className="ctrl-val">{c.panelHeight === 0 ? 'auto' : `${c.panelHeight}px`}</span></div>
          <input type="number" className="ctrl-number" value={c.panelHeight} min={0} onChange={e => setConfig({ panelHeight: +e.target.value })} />
        </div>
        <div className="ctrl-field">
          <div className="ctrl-label">Panel offset <span className="ctrl-val">{c.panelOffset}px</span></div>
          <input type="number" className="ctrl-number" value={c.panelOffset} onChange={e => setConfig({ panelOffset: +e.target.value })} />
        </div>
      </SidebarSection>
    </SidebarCard>
  )
}
