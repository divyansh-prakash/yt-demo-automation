import { useState } from 'react'
import { SidebarCard } from '../shared/SidebarCard'
import { SidebarSection } from '../shared/SidebarSection'
import { SliderField } from '../../shared/SliderField'
import { ControlField } from '../../shared/ControlField'
import type { AdEngineConfig } from '../../../types'

interface Props {
  config: AdEngineConfig
  setConfig: (u: Partial<AdEngineConfig>) => void
  defaultCollapsed?: boolean
}

function UnitToggle({ usePx, onToggle }: { usePx: boolean; onToggle: () => void }) {
  return (
    <button
      className={`unit-toggle${usePx ? ' active' : ''}`}
      onClick={e => { e.stopPropagation(); onToggle() }}
      title="Toggle between percentage and pixel values"
    >
      {usePx ? 'px' : '%'}
    </button>
  )
}

export function AdOverlayCard({ config: c, setConfig, defaultCollapsed }: Props) {
  const [usePx, setUsePx] = useState(false)

  return (
    <SidebarCard
      icon="📺" iconBg="#e6eeff"
      title="Ad Overlay"
      tooltip="Controls how the mid-roll ad video appears over the main video at the configured timestamp."
      defaultCollapsed={defaultCollapsed}
    >
      <SidebarSection
        title="Video position & size"
        tooltip="Where the ad video sits on screen and how large it appears. Toggle % / px for pixel-perfect placement."
        defaultOpen
        action={<UnitToggle usePx={usePx} onToggle={() => setUsePx(p => !p)} />}
      >
        <div className="ctrl-grid">
          <ControlField label="X"     value={c.avX}      min={0}  max={100} dim="x" usePx={usePx} onChange={v => setConfig({ avX: v })} />
          <ControlField label="Y"     value={c.avY}      min={0}  max={100} dim="y" usePx={usePx} onChange={v => setConfig({ avY: v })} />
          <ControlField label="Scale" value={c.avScale}  min={10} max={100} dim="w" usePx={usePx} onChange={v => setConfig({ avScale: v })} />
          <SliderField  label="Corner radius" value={c.avRadius} min={0} max={80} unit="px" onChange={v => setConfig({ avRadius: v })} />
        </div>
      </SidebarSection>

      <SidebarSection
        title="Rectangle backing"
        tooltip="A solid colour box behind the ad video. Gives the ad a clean, contained look."
        action={<UnitToggle usePx={usePx} onToggle={() => setUsePx(p => !p)} />}
      >
        <div className="color-row">
          <input
            type="color"
            className="color-swatch"
            value={c.rectColor}
            onChange={e => setConfig({ rectColor: e.target.value })}
          />
          <span className="color-text">{c.rectColor}</span>
        </div>
        <div className="ctrl-grid">
          <ControlField label="Width"  value={c.rectW}       min={5}  max={100} dim="w" usePx={usePx} onChange={v => setConfig({ rectW: v })} />
          <ControlField label="Height" value={c.rectH}       min={5}  max={100} dim="h" usePx={usePx} onChange={v => setConfig({ rectH: v })} />
          <ControlField label="X"      value={c.rectX}       min={0}  max={100} dim="x" usePx={usePx} onChange={v => setConfig({ rectX: v })} />
          <ControlField label="Y"      value={c.rectY}       min={0}  max={100} dim="y" usePx={usePx} onChange={v => setConfig({ rectY: v })} />
          <SliderField  label="Opacity" value={c.rectOpacity} min={0} max={100} unit="%" fullWidth onChange={v => setConfig({ rectOpacity: v })} />
        </div>
      </SidebarSection>

      <SidebarSection
        title="Banner image position"
        tooltip="Positions the brand logo or CTA image overlaid on the ad video during playback."
        defaultOpen
      >
        <div className="ctrl-grid">
          <SliderField label="X"     value={c.bnX}     min={0} max={100} unit="%" onChange={v => setConfig({ bnX: v })} />
          <SliderField label="Y"     value={c.bnY}     min={0} max={100} unit="%" onChange={v => setConfig({ bnY: v })} />
          <SliderField label="Scale" value={c.bnScale} min={5} max={100} unit="%" fullWidth onChange={v => setConfig({ bnScale: v })} />
        </div>
      </SidebarSection>

    </SidebarCard>
  )
}
