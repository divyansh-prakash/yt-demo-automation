import { useEffect } from 'react'
import { useAdEngine } from '../../hooks/useAdEngine'
import { useAdExport } from '../../hooks/useAdExport'
import { Sidebar }    from './Sidebar'
import { CanvasCard } from './canvas/CanvasCard'
import type { AdEngineConfig } from '../../types'

interface Props {
  showToast: (msg: string, options?: { color?: string, duration?: number } | string) => void
  onSave: (config: AdEngineConfig) => void
  // When a preset is selected in the header, App passes the loaded config here.
  // Using a wrapper object so the same config can be re-loaded without the
  // effect being skipped (new object reference always triggers the effect).
  presetToLoad?: { config: AdEngineConfig }
}

export function AdEngineDemo({ showToast, onSave, presetToLoad }: Props) {
  const h = useAdEngine(showToast)
  const exporter = useAdExport(showToast, h.getExportSnapshot)

  // Apply preset config whenever the user switches presets
  useEffect(() => {
    if (presetToLoad) h.loadConfig(presetToLoad.config)
  }, [presetToLoad])

  useEffect(() => {
    h.sizePrev()
    const onResize = () => h.sizePrev()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="app-body">
      <video ref={h.ctxVidRef} style={{ display: 'none' }} playsInline crossOrigin="anonymous" />
      <video ref={h.adVidRef}  style={{ display: 'none' }} playsInline crossOrigin="anonymous" />

      <Sidebar
        config={h.config}
        setConfig={h.setConfig}
        ctxUploaded={h.ctxUploaded}
        adUploaded={h.adUploaded}
        bannerUploaded={h.bannerUploaded}
        slideImgUploaded={h.slideImgUploaded}
        onUpload={h.handleUpload}
        onBanner={h.handleBanner}
        onSlideImg={h.handleSlideImg}
        onClearUpload={h.clearUpload}
        onClearBanner={h.clearBanner}
        onClearSlideImg={h.clearSlideImg}
        onSave={() => onSave(h.getConfigSnapshot())}
      />

      <main className="right-col">
        <CanvasCard
          canvasRef={h.canvasRef}
          demoState={h.demoState}
          logLines={h.logLines}
          playerStatus={h.playerStatus}
          isExporting={exporter.isExporting}
          progressPct={h.progressPct}
          adMarkerPct={h.adMarkerPct}
          adEndPct={h.adEndPct}
          ctxDuration={h.ctxDuration}
          trimIn={h.trimIn}
          trimOut={h.trimOut}
          currentTime={h.currentTime}
          totalTime={h.totalTime}
          exportFormat={exporter.exportFormat}
          ctxUploaded={h.ctxUploaded}
          adUploaded={h.adUploaded}
          onRun={h.startDemo}
          onPlay={h.togglePlay}
          onReplay={h.replayDemo}
          onResetPreview={h.resetPreview}
          onSeek={h.seekTo}
          onExport={exporter.downloadDemo}
          onExportFormatChange={exporter.setExportFormat}
          onTrimDrag={h.startTrimDrag}
          onPreviewTrim={h.previewTrim}
          onCanvasMouseDown={h.onCanvasMouseDown}
          onCanvasMouseMove={h.onCanvasMouseMove}
          onCanvasMouseLeave={h.onCanvasMouseLeave}
          isDragging={h.isDragging}
          hoveredEl={h.hoveredEl}
        />
      </main>
    </div>
  )
}
