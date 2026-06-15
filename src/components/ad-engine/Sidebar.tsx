import { MediaCard }        from './cards/MediaCard'
import { AdOverlayCard }    from './cards/AdOverlayCard'
import { SlideBannerCard }  from './cards/SlideBannerCard'
import { ContextInputCard } from './cards/ContextInputCard'
import { TimingCard }       from './cards/TimingCard'
import type { AdEngineConfig } from '../../types'

interface Props {
  config: AdEngineConfig
  setConfig: (u: Partial<AdEngineConfig>) => void
  ctxUploaded: string
  adUploaded: string
  bannerUploaded: string
  slideImgUploaded: string
  onUpload: (type: 'ctx' | 'ad', input: HTMLInputElement) => void
  onBanner: (input: HTMLInputElement) => void
  onSlideImg: (input: HTMLInputElement) => void
  onClearUpload: (type: 'ctx' | 'ad') => void
  onClearBanner: () => void
  onClearSlideImg: () => void
  activeConfigName?: string
  onUpdate: () => void
  onSaveAsNew: () => void
}

export function Sidebar({
  config, setConfig,
  ctxUploaded, adUploaded, bannerUploaded, slideImgUploaded,
  onUpload, onBanner, onSlideImg,
  onClearUpload, onClearBanner, onClearSlideImg,
  activeConfigName, onUpdate, onSaveAsNew,
}: Props) {
  return (
    <aside className="sidebar">
      <MediaCard
        ctxUploaded={ctxUploaded}
        adUploaded={adUploaded}
        bannerUploaded={bannerUploaded}
        slideImgUploaded={slideImgUploaded}
        config={config}
        setConfig={setConfig}
        onUpload={onUpload}
        onBanner={onBanner}
        onSlideImg={onSlideImg}
        onClearUpload={onClearUpload}
        onClearBanner={onClearBanner}
        onClearSlideImg={onClearSlideImg}
      />
      <ContextInputCard config={config} setConfig={setConfig} />
      <TimingCard       config={config} setConfig={setConfig} />
      <AdOverlayCard   config={config} setConfig={setConfig} defaultCollapsed />
      <SlideBannerCard config={config} setConfig={setConfig} defaultCollapsed />

      {activeConfigName ? (
        <div className="save-config-group">
          <button className="save-config-btn save-update-btn" onClick={onUpdate}>
            Update
          </button>
          <button className="save-config-btn save-new-btn" onClick={onSaveAsNew}>
            Save as New
          </button>
        </div>
      ) : (
        <button className="save-config-btn" onClick={onSaveAsNew}>
          💾 Save Config
        </button>
      )}
    </aside>
  )
}
