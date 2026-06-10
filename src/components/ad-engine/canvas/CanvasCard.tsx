import { useRef, useState } from 'react'
import type { DemoState, LogLine, ExportFormat } from '../../../types'
import { DownloadControls } from './DownloadControls'

const ZOOM_STEPS = [1, 1.5, 2, 3, 4]

interface Props {
  canvasRef:   React.RefObject<HTMLCanvasElement | null>
  demoState:   DemoState
  logLines:    LogLine[]
  playerStatus: string
  isExporting: boolean
  progressPct:  number
  adMarkerPct:     number
  adEndPct:        number
  ctxDuration:     number   // raw seconds — used for placement timeline in preview
  trimIn:  number
  trimOut: number
  currentTime: string
  totalTime:   string
  exportFormat: ExportFormat
  ctxUploaded:   string
  adUploaded:    string
  onRun:     () => void
  onPlay:    () => void
  onReplay:  () => void
  onSeek:    (pct: number) => void
  onExport:  (format: ExportFormat) => void
  onExportFormatChange: (format: ExportFormat) => void
  onTrimDrag: (handle: 'in' | 'out', el: HTMLElement, e: React.MouseEvent | React.TouchEvent) => void
  onPreviewTrim: () => void
  onResetPreview: () => void
  onCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onCanvasMouseLeave: () => void
  isDragging: boolean
  hoveredEl: 'ad' | 'banner' | 'timer' | 'mask' | 'slide' | 'bannerPanel' | null
}

export function CanvasCard({
  canvasRef, demoState, logLines, playerStatus, isExporting,
  progressPct, adMarkerPct, adEndPct, ctxDuration, trimIn, trimOut,
  currentTime, totalTime, exportFormat, ctxUploaded, adUploaded,
  onRun, onPlay, onReplay, onResetPreview, onSeek, onExport, onExportFormatChange, onTrimDrag, onPreviewTrim,
  onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseLeave,
  isDragging, hoveredEl,
}: Props) {
  const trimTrackRef = useRef<HTMLDivElement>(null)
  const [zoomIdx, setZoomIdx] = useState(0)
  const [dragPct, setDragPct] = useState<number | null>(null)
  const seekRafRef = useRef<number | null>(null)
  // During drag, override the displayed progress immediately so the bar
  // tracks the cursor — don't wait for the RAF loop to update progressPct.
  const displayPct = dragPct !== null ? dragPct * 100 : progressPct
  const hasMedia         = !!(ctxUploaded || adUploaded)
  const hasRequiredMedia = !!(ctxUploaded && adUploaded)
  const zoom             = ZOOM_STEPS[zoomIdx]
  const isPlaying        = ['Playing', 'Ad Playing', 'Scanning…', 'Recording Trim…'].includes(playerStatus)

  const handleProgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek((e.clientX - rect.left) / rect.width)
  }

  const handlePtlMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = e.currentTarget
    const getPct = (ev: MouseEvent | React.MouseEvent) => {
      const rect = track.getBoundingClientRect()
      return Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
    }
    const pct = getPct(e)
    setDragPct(pct)
    onSeek(pct)

    const onMove = (ev: MouseEvent) => {
      const p = getPct(ev)
      setDragPct(p)                              // instant visual update
      if (seekRafRef.current) cancelAnimationFrame(seekRafRef.current)
      seekRafRef.current = requestAnimationFrame(() => { onSeek(p); seekRafRef.current = null })
    }
    const onUp = (ev: MouseEvent) => {
      if (seekRafRef.current) { cancelAnimationFrame(seekRafRef.current); seekRafRef.current = null }
      onSeek(getPct(ev))
      setDragPct(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <>
      <div className="canvas-card">

        {/* ── Header ── */}
        <div className="canvas-card-hdr">
          <span className="canvas-state-label">
            {demoState === 'idle' ? 'Preview' : demoState === 'running' ? 'Demo' : 'Output'}
          </span>

          {demoState === 'idle' && (
            <div className="canvas-status-pill live">
              <div className="canvas-status-dot" />LIVE
            </div>
          )}

          {demoState === 'idle' && hasMedia && (
            <>
              <button className="canvas-hdr-btn" onClick={onPlay} title="Play / Pause preview">
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button className="canvas-hdr-btn" onClick={onResetPreview} title="Reset to first frame">
                ↺ Reset
              </button>
            </>
          )}
          {demoState === 'running' && (
            <div className="canvas-status-pill running">
              <div className="canvas-status-dot" />
              {playerStatus.toUpperCase()}
            </div>
          )}
          {demoState === 'complete' && (
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              {currentTime} / {totalTime}
            </span>
          )}

          <div className="canvas-hdr-fill" />

          {/* Zoom controls */}
          <div className="canvas-zoom-row">
            <button
              className="zoom-btn"
              onClick={() => setZoomIdx(i => Math.max(0, i - 1))}
              disabled={zoomIdx === 0}
              title="Zoom out"
            >−</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              className="zoom-btn"
              onClick={() => setZoomIdx(i => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              disabled={zoomIdx === ZOOM_STEPS.length - 1}
              title="Zoom in"
            >+</button>
          </div>

          {/* Playback controls live in footer — header stays minimal */}
        </div>

        {/* ── Canvas area ── */}
        <div
          className="canvas-area"
          style={{
            overflow: zoom > 1 ? 'auto' : 'hidden',
            display:  'block',
          }}
        >
          {demoState === 'idle' && !hasMedia && (
            <div className="canvas-idle" style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
              <div className="canvas-idle-icon">▶</div>
              <div className="canvas-idle-text">Upload videos to begin</div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            id="ae-stage"
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseLeave={onCanvasMouseLeave}
            style={{
              display: (demoState !== 'idle' || hasMedia) ? 'block' : 'none',
              width:  zoom === 1 ? '100%' : `${1280 * zoom}px`,
              height: zoom === 1 ? 'auto' : `${720  * zoom}px`,
              cursor: isDragging ? 'grabbing' : hoveredEl ? 'grab' : 'default',
            }}
          />
        </div>

        {/* ── Footer ── */}
        <div className="canvas-footer">
          <div className="canvas-main-actions">
            <button
              className="canvas-run-btn"
              onClick={onRun}
              disabled={!hasRequiredMedia || demoState === 'running'}
            >
              <span>▶</span>
              {demoState === 'running' ? 'Running…' : 'Preview Ad'}
            </button>

            <DownloadControls
              exportFormat={exportFormat}
              isExporting={isExporting}
              disabled={!hasRequiredMedia}
              onExportFormatChange={onExportFormatChange}
              onExport={onExport}
            />
          </div>

          {/* Placement timeline — visible in preview and while demo runs */}
          {(demoState === 'idle' || demoState === 'running') && ctxDuration > 0 && (
            <div className="placement-tl">
              <div className="placement-tl-legend">
                {adMarkerPct > 0 && (
                  <span className="ptl-li ptl-ad">
                    ● Ad @ {Math.floor(adMarkerPct / 100 * ctxDuration / 60)}:{String(Math.floor((adMarkerPct / 100 * ctxDuration) % 60)).padStart(2,'0')}
                  </span>
                )}
              </div>
              <div className="placement-tl-bar">
                <div className="ptl-track" onMouseDown={handlePtlMouseDown} style={{ cursor: 'pointer' }}>
                  {/* Progress fill */}
                  {demoState === 'running' && (
                    <div className="ptl-fill" style={{ width: `${displayPct}%` }} />
                  )}

                  {/* Ad slot band — shows full duration between start and end */}
                  {adMarkerPct > 0 && adEndPct > adMarkerPct && (
                    <div
                      className="ptl-ad-band"
                      style={{ left: `${adMarkerPct}%`, width: `${adEndPct - adMarkerPct}%` }}
                    />
                  )}

                  {/* Ad start marker */}
                  {adMarkerPct > 0 && (
                    <div className="ptl-marker ptl-marker-ad" style={{ left: `${adMarkerPct}%` }}>
                      <div className="ptl-line" />
                      <span className="ptl-tag">Ad</span>
                    </div>
                  )}

                  {/* Ad end marker */}
                  {adEndPct > 0 && (
                    <div className="ptl-marker ptl-marker-ad-end" style={{ left: `${adEndPct}%` }}>
                      <div className="ptl-line" />
                      <span className="ptl-tag">End</span>
                    </div>
                  )}

                  {/* Playhead — visible when dragging in idle too */}
                  {(demoState === 'running' || dragPct !== null) && (
                    <div className="ptl-playhead" style={{ left: `${displayPct}%` }} />
                  )}
                </div>
              </div>
              <div className="ptl-time-row">
                <span>{demoState === 'running' ? currentTime : '0:00'}</span>
                <span>{totalTime}</span>
              </div>
            </div>
          )}

          {/* Playback controls — visible once demo has started */}
          {(demoState === 'running' || demoState === 'complete') && (
            <div className="tl-ctrl-row">
              <button className="tl-btn primary" onClick={onPlay}>
                {isPlaying ? '⏸ Pause' : '▶ Resume'}
              </button>
              <button className="tl-btn" onClick={onReplay}>
                ↺ Replay
              </button>
            </div>
          )}

          {demoState === 'complete' && (
            <div className="tl">
              <div className="tl-legend">
                <div className="tl-li"><div className="tl-dot" style={{ background: 'var(--amber)' }} />Ad trigger</div>
                <div className="tl-li"><div className="tl-dot" style={{ background: 'var(--blue)' }} />Playhead</div>
              </div>

              <div className="tl-bar" onClick={handleProgClick}>
                <div className="tl-fill" style={{ width: `${progressPct}%` }} />
                {adMarkerPct > 0 && (
                  <div className="tl-marker" style={{ left: `${adMarkerPct}%`, background: 'var(--amber)' }} />
                )}
                <div className="tl-marker" style={{ left: `${progressPct}%`, background: 'var(--blue)', width: 2 }} />
              </div>

              <div className="tl-labels">
                <span>{currentTime}</span>
                <span>{totalTime}</span>
              </div>

              <div className="trim-track" ref={trimTrackRef}>
                <div
                  className="trim-range"
                  style={{ left: `${trimIn * 100}%`, width: `${(trimOut - trimIn) * 100}%` }}
                />
                <div
                  className="trim-handle left"
                  style={{ left: `${trimIn * 100}%` }}
                  onMouseDown={e => trimTrackRef.current && onTrimDrag('in', trimTrackRef.current, e)}
                  onTouchStart={e => trimTrackRef.current && onTrimDrag('in', trimTrackRef.current, e)}
                />
                <div
                  className="trim-handle right"
                  style={{ left: `${trimOut * 100}%` }}
                  onMouseDown={e => trimTrackRef.current && onTrimDrag('out', trimTrackRef.current, e)}
                  onTouchStart={e => trimTrackRef.current && onTrimDrag('out', trimTrackRef.current, e)}
                />
              </div>
              <div className="trim-labels">
                <span style={{ color: 'var(--green)' }}>In: {(trimIn * 100).toFixed(0)}%</span>
                <span style={{ color: 'var(--rose)' }}>Out: {(trimOut * 100).toFixed(0)}%</span>
              </div>

              <div className="tl-ctrl-row">
                <button className="tl-btn" onClick={onPreviewTrim}>▶ Preview trim</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scan log */}
      {logLines.length > 0 && (
        <div className="scan-log">
          <div className="scan-log-hdr">Scanning Log</div>
          <div className="scan-log-lines">
            {logLines.map(l => (
              <div key={l.id} className="scan-log-line">
                <span className="log-icon">{l.icon}</span>
                <span className="log-text" dangerouslySetInnerHTML={{ __html: l.html }} />
                <span className="log-ts">{l.ts}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
