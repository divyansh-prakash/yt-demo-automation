import { SidebarCard }    from '../shared/SidebarCard'
import { SidebarSection } from '../shared/SidebarSection'
import { SliderField }    from '../../shared/SliderField'
import type { AdEngineConfig } from '../../../types'

interface Props {
  ctxUploaded: string
  adUploaded: string
  bannerUploaded: string
  slideImgUploaded: string
  config: AdEngineConfig
  setConfig: (u: Partial<AdEngineConfig>) => void
  onUpload: (type: 'ctx' | 'ad', input: HTMLInputElement) => void
  onBanner: (input: HTMLInputElement) => void
  onSlideImg: (input: HTMLInputElement) => void
  onClearUpload: (type: 'ctx' | 'ad') => void
  onClearBanner: () => void
  onClearSlideImg: () => void
}

export function MediaCard({
  ctxUploaded, adUploaded, bannerUploaded, slideImgUploaded,
  config: c, setConfig,
  onUpload, onBanner, onSlideImg,
  onClearUpload, onClearBanner, onClearSlideImg,
}: Props) {
  return (
    <SidebarCard
      icon="📁" iconBg="var(--accent-bg)"
      title="Media" badge="START HERE"
      tooltip="Upload the YouTube screen recording, your ad video, and the banner images."
    >
      <div className="s-card-body">

        <div className={`upload-zone${ctxUploaded ? ' filled' : ''}`}>
          <input type="file" accept="video/*" onChange={e => onUpload('ctx', e.target as HTMLInputElement)} />
          {ctxUploaded && (
            <button className="upload-remove" onClick={e => { e.preventDefault(); e.stopPropagation(); onClearUpload('ctx') }} title="Remove">×</button>
          )}
          <div className="upload-icon-box">▶</div>
          <div className="upload-info">
            <div className="upload-name">Context Video</div>
            <div className="upload-hint">YouTube screen recording</div>
            {ctxUploaded && <div className="upload-file">{ctxUploaded}</div>}
          </div>
          {ctxUploaded && <div className="upload-check">✓</div>}
        </div>

        <div className={`upload-zone${adUploaded ? ' filled' : ''}`}>
          <input type="file" accept="video/*" onChange={e => onUpload('ad', e.target as HTMLInputElement)} />
          {adUploaded && (
            <button className="upload-remove" onClick={e => { e.preventDefault(); e.stopPropagation(); onClearUpload('ad') }} title="Remove">×</button>
          )}
          <div className="upload-icon-box">★</div>
          <div className="upload-info">
            <div className="upload-name">Ad Video</div>
            <div className="upload-hint">Mid-roll creative · MP4 / MOV</div>
            {adUploaded && <div className="upload-file">{adUploaded}</div>}
          </div>
          {adUploaded && <div className="upload-check">✓</div>}
        </div>

        <div className={`upload-zone${bannerUploaded ? ' filled' : ''}`}>
          <input type="file" accept="image/*" onChange={e => onBanner(e.target as HTMLInputElement)} />
          {bannerUploaded && (
            <button className="upload-remove" onClick={e => { e.preventDefault(); e.stopPropagation(); onClearBanner() }} title="Remove">×</button>
          )}
          <div className="upload-icon-box">🖼</div>
          <div className="upload-info">
            <div className="upload-name">Ad Banner Image</div>
            <div className="upload-hint">Logo / CTA over ad video · PNG</div>
            {bannerUploaded && <div className="upload-file">{bannerUploaded}</div>}
          </div>
          {bannerUploaded && <div className="upload-check">✓</div>}
        </div>

        <div className={`upload-zone${slideImgUploaded ? ' filled' : ''}`}>
          <input type="file" accept="image/*" onChange={e => onSlideImg(e.target as HTMLInputElement)} />
          {slideImgUploaded && (
            <button className="upload-remove" onClick={e => { e.preventDefault(); e.stopPropagation(); onClearSlideImg() }} title="Remove">×</button>
          )}
          <div className="upload-icon-box">🎞</div>
          <div className="upload-info">
            <div className="upload-name">Slide Banner Image</div>
            <div className="upload-hint">Slides into suggested videos area · PNG</div>
            {slideImgUploaded && <div className="upload-file">{slideImgUploaded}</div>}
          </div>
          {slideImgUploaded && <div className="upload-check">✓</div>}
        </div>

      </div>

      {ctxUploaded && (
        <SidebarSection
          title="Context video transform"
          tooltip="Adjust how the context video is rendered on the canvas."
        >
          <div className="ctrl-grid">
            <SliderField label="Scale" unit="%" value={c.cvScale} min={10} max={200} onChange={v => setConfig({ cvScale: v })} />
            <div className="ctrl-field">
              <div className="ctrl-label">Corner R <span className="ctrl-val">{c.cvRadius}px</span></div>
              <input type="range" className="ctrl-slider" min={0} max={80} value={c.cvRadius}
                onChange={e => setConfig({ cvRadius: +e.target.value })} />
            </div>
            <SliderField label="X offset" unit="%" value={c.cvX} min={0} max={100} onChange={v => setConfig({ cvX: v })} />
            <SliderField label="Y offset" unit="%" value={c.cvY} min={0} max={100} onChange={v => setConfig({ cvY: v })} />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Fit mode</div>
            <select className="ctrl-select" value={c.cvFit}
              onChange={e => setConfig({ cvFit: e.target.value as AdEngineConfig['cvFit'] })}
              style={{ width: '100%' }}>
              <option value="fill">Fill — crop to fit, no squeeze</option>
              <option value="contain">Contain — letterbox</option>
              <option value="stretch">Stretch — may distort</option>
            </select>
          </div>
        </SidebarSection>
      )}
    </SidebarCard>
  )
}
