import { useEffect } from 'react'
import { useAdEngine } from '../../hooks/useAdEngine'
import { useAdExport } from '../../hooks/useAdExport'
import { Sidebar }    from './Sidebar'
import { CanvasCard } from './canvas/CanvasCard'
import type { AdEngineConfig } from '../../types'

interface Props {
  showToast: (msg: string, options?: { color?: string, duration?: number } | string) => void
  activeConfigName?: string
  onUpdate: (config: AdEngineConfig) => Promise<void> | void
  onSaveAsNew: (config: AdEngineConfig) => Promise<void> | void
  presetToLoad?: { config: AdEngineConfig }
}

export function AdEngineDemo({ showToast, activeConfigName, onUpdate, onSaveAsNew, presetToLoad }: Props) {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      h.togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [h.togglePlay])

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
        activeConfigName={activeConfigName}
        onUpdate={() => onUpdate(h.getConfigSnapshot())}
        onSaveAsNew={() => onSaveAsNew(h.getConfigSnapshot())}
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
