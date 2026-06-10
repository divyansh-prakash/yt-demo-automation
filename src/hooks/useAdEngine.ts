import { useRef, useState, useEffect } from 'react'
import type { AdEngineConfig, RuntimeState, LogLine, DemoState, AdEngineExportSnapshot } from '../types'

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: AdEngineConfig = {
  cvScale: 100, cvX: 50, cvY: 50, cvRadius: 0, cvFit: 'fill',
  rectColor: '#1a1a2c', rectOpacity: 80,
  rectX: 50, rectY: 50, rectW: 60, rectH: 40, rectRadius: 0,
  avX: 50, avY: 50, avScale: 80, avRadius: 0,
  bnX: 50, bnY: 85, bnScale: 60,
  tmX: 8, tmY: 88, tmFont: 14,
  tsMin: 0, tsSec: 10, adDur: 15,
  tags: ['Match Highlights', 'World Cup Lithuania', 'FIFA Futsal World'],
  maskX: 850, maskY: 0, maskW: 430, maskH: 720,
  slideAmt: 120, slideDur: 0.6, slideDir: 'down', easing: 'ease',
  slideImgScale: 0.5, slideImgOffX: 0, slideImgOffY: 0,
  panelColor: '#ffffff', panelOpacity: 1,
  bannerPanelX: 850, bannerPanelY: 0, bannerPanelW: 430, bannerPanelH: 120, bannerPanelRadius: 0,
}

const DEFAULT_RT: RuntimeState = {
  ctxUrl: null, adUrl: null, bannerImg: null, slideImg: null,
  ctxDur: 0, adTriggerSec: 0, bannerTriggerSec: 0,
  adDur: 15, adRemaining: 15,
  adPlaying: false, adTriggered: false, bannerTriggered: false,
  scanning: false, scanAlpha: 0, scanLineY: 0, scanDir: 1,
  playing: false,
  rafId: null, countdown: null, recInProgress: false,
  trimIn: 0, trimOut: 1,
  adStartTime: 0, adElapsedAtPause: 0,
}

// ── Utilities ────────────────────────────────────────────────────────────────

const fmt  = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function applyEasing(t: number, type: string): number {
  t = Math.max(0, Math.min(1, t))
  if (type === 'linear') return t
  if (type === 'bounce') {
    if (t < 0.5) { const u = t * 2; return (1 - (1 - u) * (1 - u)) * 0.5 }
    const u = (t - 0.5) * 2; return 0.5 + u * u * 0.5
  }
  if (type === 'elastic') {
    if (t === 0 || t === 1) return t
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1
  }
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAdEngine(showToast: (msg: string, options?: { color?: string, duration?: number } | string) => void) {

  // ── Stable refs ──────────────────────────────────────────────────────────
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxVidRef     = useRef<HTMLVideoElement>(null)
  const adVidRef      = useRef<HTMLVideoElement>(null)
  const ST            = useRef<RuntimeState>({ ...DEFAULT_RT })
  const configRef     = useRef<AdEngineConfig>(DEFAULT_CONFIG)
  const currentTimeRef = useRef(0)  // synced in RAF loop, used by slide banner draw
  const logIdRef      = useRef(0)
  // Stored so togglePlay can restart the countdown after a mid-ad resume
  const adEndRef      = useRef<(() => void) | null>(null)

  // ── React state (drives re-renders) ──────────────────────────────────────
  const [config, setConfigState]    = useState<AdEngineConfig>(DEFAULT_CONFIG)
  const [demoState, setDemoState]   = useState<DemoState>('idle')
  const demoStateRef                = useRef<DemoState>('idle')

  // Keep ref in sync so redraw() (called from RAF, not React) can read current state
  function setDemo(state: DemoState) { demoStateRef.current = state; setDemoState(state) }
  const [logLines, setLogLines]   = useState<LogLine[]>([])
  const [playerStatus, setStatus] = useState('Ready')
  const [progressPct, setProgress]  = useState(0)
  const [ctxDuration, setCtxDuration] = useState(0)  // video duration, drives placement timeline
  const [trimIn, setTrimIn]   = useState(0)
  const [trimOut, setTrimOut] = useState(1)
  const [currentTime, setCurrent] = useState('0:00')
  const [totalTime, setTotal]     = useState('0:00')
  const [ctxUploaded, setCtxName]       = useState('')
  const [adUploaded, setAdName]         = useState('')
  const [bannerUploaded, setBannerName] = useState('')   // ad video overlay image
  const [slideImgUploaded, setSlideImgName] = useState('') // slide banner image

  useEffect(() => {
    // Start the draw loop immediately — keeps the canvas live in all states.
    // In idle state this shows the preview composition as videos are loaded.
    startLoop()
    return () => {
      if (ST.current.rafId) cancelAnimationFrame(ST.current.rafId)
      if (ST.current.countdown) clearInterval(ST.current.countdown)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Config updater ────────────────────────────────────────────────────────
  function setConfig(update: Partial<AdEngineConfig>) {
    // Spread DEFAULT_CONFIG first so any fields added after a preset was saved
    // (or missing due to HMR ref retention) always get a sensible value.
    const next = { ...DEFAULT_CONFIG, ...configRef.current, ...update }
    configRef.current = next
    setConfigState(next)
    requestAnimationFrame(liveRedraw)
  }

  // ── Canvas draw helpers ───────────────────────────────────────────────────

  function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (!r) { ctx.rect(x, y, w, h); return }
    r = Math.min(r, w / 2, h / 2)
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y,     x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x,     y + h, r)
    ctx.arcTo(x,     y + h, x,     y,     r)
    ctx.arcTo(x,     y,     x + w, y,     r)
    ctx.closePath()
  }

  function drawCtxVideo(ctx: CanvasRenderingContext2D, vid: HTMLVideoElement, W: number, H: number) {
    const c = configRef.current
    const sc = c.cvScale / 100, xp = c.cvX / 100, yp = c.cvY / 100
    const vw = vid.videoWidth || W, vh = vid.videoHeight || H
    const vidAR = vw / vh, canAR = W / H
    let dw: number, dh: number
    if (c.cvFit === 'contain') {
      if (vidAR > canAR) { dw = W; dh = W / vidAR } else { dh = H; dw = H * vidAR }
    } else if (c.cvFit === 'stretch') {
      dw = W; dh = H
    } else {
      if (vidAR > canAR) { dh = H; dw = H * vidAR } else { dw = W; dh = W / vidAR }
    }
    dw *= sc; dh *= sc
    const dx = (W - dw) * xp, dy = (H - dh) * yp
    ctx.save()
    if (c.cvRadius) { ctx.beginPath(); rrect(ctx, dx, dy, dw, dh, c.cvRadius); ctx.clip() }
    ctx.drawImage(vid, dx, dy, dw, dh)
    ctx.restore()
  }

  function drawRect(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const c = configRef.current
    const rw = c.rectW / 100 * W, rh = c.rectH / 100 * H
    const rx = (W - rw) * (c.rectX / 100), ry = (H - rh) * (c.rectY / 100)
    ctx.save()
    ctx.globalAlpha = c.rectOpacity / 100
    ctx.beginPath(); rrect(ctx, rx, ry, rw, rh, c.rectRadius)
    ctx.fillStyle = c.rectColor; ctx.fill()
    ctx.restore()
  }

  function adGeom(W: number, H: number) {
    const c = configRef.current
    const adW = W * (c.avScale / 100), adH = adW * (9 / 16)
    return { adX: (W - adW) * (c.avX / 100), adY: (H - adH) * (c.avY / 100), adW, adH }
  }

  function drawAdVideo(ctx: CanvasRenderingContext2D, vid: HTMLVideoElement, W: number, H: number) {
    const g = adGeom(W, H)
    const c = configRef.current
    ctx.save()
    if (c.avRadius) { ctx.beginPath(); rrect(ctx, g.adX, g.adY, g.adW, g.adH, c.avRadius); ctx.clip() }
    ctx.drawImage(vid, g.adX, g.adY, g.adW, g.adH)
    ctx.restore()
    return g
  }

  function drawBanner(ctx: CanvasRenderingContext2D, adX: number, adY: number, adW: number, adH: number) {
    const img = ST.current.bannerImg; if (!img) return
    const c = configRef.current
    const bW = adW * (c.bnScale / 100)
    const bH = (img.naturalHeight / img.naturalWidth) * bW
    ctx.drawImage(img, adX + (adW - bW) * (c.bnX / 100), adY + (adH - bH) * (c.bnY / 100), bW, bH)
  }

  function drawTimer(ctx: CanvasRenderingContext2D, adX: number, adY: number, adW: number, adH: number, rem: number) {
    const c = configRef.current
    const tf = Math.max(c.tmFont, Math.round(adH * 0.06))
    const txt = `Ad: 0:${String(rem).padStart(2, '0')}`
    const tX = adX + adW * (c.tmX / 100), tY = adY + adH * (c.tmY / 100)
    ctx.save()
    ctx.font = `bold ${tf}px Inter,sans-serif`
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(txt, tX + 1, tY + 1)
    ctx.fillStyle = '#fff'; ctx.fillText(txt, tX, tY)
    ctx.restore()
  }

  function drawCtxLabel(ctx: CanvasRenderingContext2D, _W: number, H: number) {
    const sc = (H || 400) / 400, fs = Math.round(13 * sc)
    const lW = Math.round(140 * sc), lH = Math.round(60 * sc)
    const lX = Math.round(12 * sc), lY = Math.round(12 * sc)
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath(); rrect(ctx, lX, lY, lW, lH, Math.round(8 * sc)); ctx.fill()
    ctx.fillStyle = '#00c4a4'; ctx.font = `bold ${fs}px Inter,sans-serif`
    ctx.fillText('CONTEXT VIDEO', lX + Math.round(10 * sc), lY + Math.round(20 * sc))
    ctx.fillStyle = '#aaa'; ctx.font = `${Math.round(11 * sc)}px Inter,sans-serif`
    ctx.fillText('Analysing content…', lX + Math.round(10 * sc), lY + Math.round(40 * sc))
    ctx.restore()
  }

  function drawScanOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number, lineY: number) {
    const sc = H / 400
    ctx.save(); ctx.globalAlpha = alpha
    ctx.fillStyle = 'rgba(7,7,15,0.82)'; ctx.fillRect(0, 0, W, H)
    const g = ctx.createLinearGradient(0, 0, W, 0)
    g.addColorStop(0, 'transparent')
    g.addColorStop(0.4, 'rgba(0,196,164,0.8)')
    g.addColorStop(0.6, 'rgba(0,196,164,0.8)')
    g.addColorStop(1, 'transparent')
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(2, 3 * sc)
    ctx.shadowColor = '#00c4a4'; ctx.shadowBlur = 18 * sc
    ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(W, lineY); ctx.stroke()
    ctx.shadowBlur = 0
    const fw = Math.round(220 * sc), fh = Math.round(28 * sc)
    const fx = (W - fw) / 2, fy = Math.round(16 * sc)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath()
    rrect(ctx, fx, fy, fw, fh, Math.round(6 * sc)); ctx.fill()
    ctx.fillStyle = '#00c4a4'; ctx.font = `bold ${Math.round(12 * sc)}px Inter,sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('⬤ AI CONTEXTUAL SCAN ACTIVE', W / 2, fy + Math.round(19 * sc))
    ctx.textAlign = 'left'; ctx.restore()
  }

  function drawCtxOverlayTags(ctx: CanvasRenderingContext2D, _W: number, H: number) {
    if (!ST.current.scanning) return
    const c = configRef.current
    const tagColors = ['#7c3aed', '#0891b2', '#db2777', '#16a34a', '#d97706']
    const sc = H / 400, pad = Math.round(8 * sc), lh = Math.round(28 * sc)
    const lX = Math.round(14 * sc), r = Math.round(10 * sc)
    let lY = Math.round(14 * sc)
    const fs = Math.round(12 * sc)
    ctx.save(); ctx.font = `bold ${fs}px Inter,sans-serif`
    for (let i = 0; i < c.tags.length; i++) {
      const label = c.tags[i]; if (!label) continue
      const color = tagColors[i % tagColors.length]
      const tw = ctx.measureText(label).width
      ctx.globalAlpha = 0.92; ctx.fillStyle = color
      ctx.beginPath(); rrect(ctx, lX, lY, tw + pad * 2, lh, r); ctx.fill()
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'
      ctx.fillText(label, lX + pad, lY + lh - Math.round(8 * sc))
      lY += lh + Math.round(6 * sc)
    }
    ctx.restore()
  }

  // ── Slide banner ─────────────────────────────────────────────────────────
  // Responsible ONLY for the mask region slide animation.
  // The white panel and banner image are separate independent layers.
  function drawSlideBanner(ctx: CanvasRenderingContext2D) {
    const c = configRef.current
    const s = ST.current
    const { maskX: mx, maskY: my, maskW: mw, maskH: mh } = c
    const isIdlePreview = !s.playing && !s.scanning

    // Idle: show mask outline so user can position it
    if (isIdlePreview) {
      ctx.save()
      ctx.strokeStyle = 'rgba(217,82,40,0.75)'
      ctx.lineWidth = 1.5; ctx.setLineDash([8, 5])
      ctx.strokeRect(mx, my, mw, mh)
      ctx.restore()
      return
    }

    if (!s.bannerTriggered) return

    const inElapsed = Math.max(0, currentTimeRef.current - s.bannerTriggerSec)
    const sP = Math.min(1, inElapsed / Math.max(0.001, c.slideDur))
    if (sP <= 0) return

    const ep = applyEasing(sP, c.easing)

    let dx = 0, dy = 0
    if      (c.slideDir === 'up')   dy = -c.slideAmt * ep
    else if (c.slideDir === 'down') dy =  c.slideAmt * ep
    else if (c.slideDir === 'left') dx = -c.slideAmt * ep
    else                             dx =  c.slideAmt * ep

    // Capture current mask region content before we overwrite it
    let scratch = scratchCanvasRef.current
    if (!scratch) { scratch = document.createElement('canvas'); scratchCanvasRef.current = scratch }
    if (scratch.width !== mw || scratch.height !== mh) { scratch.width = mw; scratch.height = mh }
    const sc = scratch.getContext('2d')
    if (sc) { sc.clearRect(0, 0, mw, mh); sc.drawImage(ctx.canvas, mx, my, mw, mh, 0, 0, mw, mh) }

    // Clip to mask, clear original content, draw shifted
    ctx.save()
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip()
    ctx.clearRect(mx, my, mw, mh)
    ctx.drawImage(scratch, 0, 0, mw, mh, mx + dx, my + dy, mw, mh)
    ctx.restore()
  }

  // White panel — independent layer, only visible when a slide image is loaded.
  function drawBannerPanel(ctx: CanvasRenderingContext2D) {
    if (!ST.current.slideImg) return
    const s = ST.current
    const c = configRef.current
    const isIdlePreview = !s.playing && !s.scanning
    if (!isIdlePreview && !s.bannerTriggered) return

    const inElapsed = isIdlePreview ? 999 : Math.max(0, currentTimeRef.current - s.bannerTriggerSec)
    const alpha = Math.min(1, inElapsed * 3)

    ctx.save()
    ctx.globalAlpha = alpha * c.panelOpacity
    ctx.fillStyle = c.panelColor
    if (c.bannerPanelRadius) {
      ctx.beginPath()
      rrect(ctx, c.bannerPanelX, c.bannerPanelY, c.bannerPanelW, c.bannerPanelH, c.bannerPanelRadius)
      ctx.fill()
    } else {
      ctx.fillRect(c.bannerPanelX, c.bannerPanelY, c.bannerPanelW, c.bannerPanelH)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // Banner image — independent layer, drawn on top of white panel.
  function drawSlideBannerImage(ctx: CanvasRenderingContext2D) {
    const img = ST.current.slideImg
    if (!img) return

    const s = ST.current
    const c = configRef.current
    const isIdlePreview = !s.playing && !s.scanning
    if (!isIdlePreview && !s.bannerTriggered) return

    const inElapsed = isIdlePreview ? 999 : Math.max(0, currentTimeRef.current - s.bannerTriggerSec)
    const alpha = Math.min(1, inElapsed * 3)

    // Centered within the panel, offset by slideImgOffX/Y
    const aw = c.bannerPanelW * c.slideImgScale
    const ah = img.naturalWidth > 0 ? (img.naturalHeight / img.naturalWidth) * aw : aw
    const ax = c.bannerPanelX + (c.bannerPanelW - aw) / 2 + c.slideImgOffX
    const ay = c.bannerPanelY + (c.bannerPanelH - ah) / 2 + c.slideImgOffY

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(img, ax, ay, aw, ah)
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // ── Main render function ───────────────────────────────────────────────────
  // Handles all visual states: idle preview, scan, demo playback.
  // Runs continuously via RAF so the canvas always reflects current config.

  function redraw() {
    const canvas = canvasRef.current; if (!canvas) return
    // Ensure recording dimensions on first draw
    if (canvas.width !== 1280 || canvas.height !== 720) {
      canvas.width = 1280; canvas.height = 720
    }
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = canvas.width, H = canvas.height
    const s = ST.current
    const cv = ctxVidRef.current, av = adVidRef.current

    ctx.clearRect(0, 0, W, H)

    // ── Scan phase ───────────────────────────────────────────────────────────
    if (s.scanning) {
      if (cv && cv.readyState >= 2) drawCtxVideo(ctx, cv, W, H)
      if (s.scanAlpha > 0) drawScanOverlay(ctx, W, H, s.scanAlpha, s.scanLineY)
      drawCtxOverlayTags(ctx, W, H)
      drawCtxLabel(ctx, W, H)
      return
    }

    // ── Base layer: context video ────────────────────────────────────────────
    if (cv && cv.readyState >= 2) drawCtxVideo(ctx, cv, W, H)

    // ── Slide banner mask animation — MUST be before ad overlay so the
    //    scratch capture only contains context video, not ad video ────────────
    drawSlideBanner(ctx)

    // ── Ad overlay + rectangle ───────────────────────────────────────────────
    // In idle/preview: always show overlay so user can position it while
    //   playing or paused (demoStateRef tracks whether we're in demo mode).
    // In running demo: only show overlay when ad is actually playing.
    const isIdleMode = demoStateRef.current === 'idle'
    const showAdOverlay = isIdleMode
      ? !s.scanning                             // preview: show whenever not scanning
      : (s.adPlaying || (!s.playing && !s.scanning))  // demo: only during ad

    if (showAdOverlay && av && av.readyState >= 2) {
      drawRect(ctx, W, H)
      const { adX, adY, adW, adH } = drawAdVideo(ctx, av, W, H)
      drawBanner(ctx, adX, adY, adW, adH)
      drawTimer(ctx, adX, adY, adW, adH, s.adPlaying ? s.adRemaining : configRef.current.adDur)
    }

    // ── White panel + banner image — drawn last so they're always on top ─────
    drawBannerPanel(ctx)
    drawSlideBannerImage(ctx)
  }

  // liveRedraw is now just an alias for redraw — both draw on the single canvas.
  // Kept so slider onChange handlers (setConfig) can call it without changes.
  function liveRedraw() { redraw() }

  function sizePrev() {
    const canvas = canvasRef.current; if (!canvas) return
    if (canvas.width !== 1280 || canvas.height !== 720) {
      canvas.width = 1280; canvas.height = 720
    }
  }

  function updateProgress() {
    const v = ctxVidRef.current; if (!v || !v.duration) return
    const s = ST.current
    const totalDuration = s.ctxDur + s.adDur  // true demo length
    let virtualTime = v.currentTime

    if (s.adPlaying && s.adStartTime > 0) {
      // Ad is playing — cv is paused at adTriggerSec.
      // Advance using wall-clock elapsed so the bar keeps moving during the ad.
      const elapsed = (Date.now() - s.adStartTime) / 1000
      virtualTime = Math.min(s.adTriggerSec + elapsed, totalDuration)
    } else if (s.adTriggered && !s.adPlaying && s.adDur > 0) {
      // Ad has ended — cv resumes from adTriggerSec.
      // Add adDur offset so the bar never goes backward and
      // the denominator is totalDuration (not just ctxDur).
      virtualTime = Math.min(v.currentTime + s.adDur, totalDuration)
    }

    currentTimeRef.current = virtualTime
    setProgress(totalDuration > 0 ? (virtualTime / totalDuration) * 100 : 0)
    setCurrent(fmt(virtualTime))
  }

  function startLoop() {
    function loop() {
      redraw(); updateProgress()
      ST.current.rafId = requestAnimationFrame(loop)
    }
    if (ST.current.rafId) cancelAnimationFrame(ST.current.rafId)
    ST.current.rafId = requestAnimationFrame(loop)
  }

  // ── Scan helpers ───────────────────────────────────────────────────────────

  function addLog(icon: string, html: string) {
    const now = new Date()
    const ts = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':')
    setLogLines(prev => [...prev, { id: logIdRef.current++, ts, icon, html }])
  }

  async function fadeAlpha(from: number, to: number, ms: number) {
    ST.current.scanAlpha = from
    const steps = 20, dt = ms / steps, delta = (to - from) / steps
    for (let i = 0; i < steps; i++) {
      await sleep(dt)
      ST.current.scanAlpha = Math.max(0, Math.min(1, ST.current.scanAlpha + delta))
    }
    ST.current.scanAlpha = to
  }

  function seekAndWait(vid: HTMLVideoElement, time: number) {
    return new Promise<void>(resolve => {
      if (Math.abs(vid.currentTime - time) < 0.05) { resolve(); return }
      const fn = () => { vid.removeEventListener('seeked', fn); resolve() }
      vid.addEventListener('seeked', fn)
      vid.currentTime = time
      setTimeout(resolve, 2000)
    })
  }

  // ── Demo flow ──────────────────────────────────────────────────────────────

  async function runFullDemo(skipScan: boolean) {
    const cv = ctxVidRef.current, av = adVidRef.current
    if (!cv || !av) return
    const s = ST.current
    if (s.countdown) { clearInterval(s.countdown); s.countdown = null }
    s.adPlaying = false; s.adTriggered = false; s.bannerTriggered = false
    s.scanning = false; s.scanAlpha = 0; s.playing = false

    const c = configRef.current
    s.adTriggerSec     = c.tsMin * 60 + c.tsSec
    s.bannerTriggerSec = s.adTriggerSec
    s.adDur = c.adDur; s.adRemaining = s.adDur

    if (!cv.duration || cv.readyState < 1) {
      cv.src = s.ctxUrl!; cv.load()
      await new Promise<void>(r => { cv.onloadedmetadata = () => r(); setTimeout(r, 4000) })
    }
    if (!av.duration || av.readyState < 1) {
      av.src = s.adUrl!; av.load()
      await new Promise<void>(r => { av.onloadedmetadata = () => r(); setTimeout(r, 4000) })
    }

    s.ctxDur = cv.duration
    setTotal(fmt(s.ctxDur + s.adDur))  // total demo = video + ad slot
    setCtxDuration(cv.duration)

    const canvas = canvasRef.current
    if (canvas) { canvas.width = 1280; canvas.height = 720 }

    startLoop(); await sleep(100)

    // ── Step 1: Start video from 0 immediately (unmuted, one continuous play) ──
    await seekAndWait(cv, 0)
    cv.muted = false; cv.play(); s.playing = true; s.adTriggered = false

    // ── Step 2: Wire up the playback watcher before scan starts ──
    // Monitors from second 0 so no trigger is ever missed regardless of scan duration.
    const playbackComplete = new Promise<void>(resolve => {
      cv.ontimeupdate = () => {
        const ct = cv.currentTime

        if (!s.bannerTriggered && ct >= s.bannerTriggerSec) {
          s.bannerTriggered = true
          addLog('🎞', `<span class="hi">Slide banner</span> triggered at ${fmt(s.bannerTriggerSec)}`)
        }

        if (!s.adTriggered && ct >= s.adTriggerSec) {
          s.adTriggered = true; cv.pause(); s.adPlaying = true; s.adRemaining = s.adDur
          setStatus('Ad Playing')
          av.currentTime = 0; av.muted = false; av.play()
          addLog('★', `<span class="hi">Ad placed</span> at ${fmt(s.adTriggerSec)} — ${s.adDur}s`)

          s.adStartTime = Date.now()
          s.adElapsedAtPause = 0

          const adEnd = () => {
            if (!s.adPlaying) return
            adEndRef.current = null
            clearInterval(s.countdown!); s.countdown = null
            s.adPlaying = false
            av.pause(); av.onended = null
            addLog('✅', 'Ad complete — context video resumed')
            setStatus('Playing'); cv.play(); s.playing = true
          }

          adEndRef.current = adEnd

          s.countdown = setInterval(() => {
            const e = (Date.now() - s.adStartTime) / 1000
            s.adRemaining = Math.max(0, s.adDur - Math.floor(e))
            if (e >= s.adDur) adEnd()
          }, 250)

          av.onended = () => {
            const e = (Date.now() - s.adStartTime) / 1000
            if (e < s.adDur) { av.currentTime = 0; av.play() } else adEnd()
          }
        }
      }
      cv.onended = () => {
        cv.ontimeupdate = null; cv.onended = null
        s.playing = false; setStatus('Ended'); resolve()
      }
    })

    // ── Step 3: Scan overlay runs on top of the already-playing video ──
    // No muting, no seeking — just a visual overlay for ~4.5s.
    if (!skipScan) {
      s.scanning = true; s.scanAlpha = 0; s.scanLineY = 0; s.scanDir = 1
      setStatus('Scanning…')

      const msgs: [number, string, string][] = [
        [300, '🔍', 'Initialising contextual analysis engine…'],
        [600, '🎬', `Detected: <span class="hi">${c.tags[0] ?? ''}</span>`],
        [600, '📊', `Brand affinity signal: <span class="hi">${c.tags[1] ?? ''}</span>`],
        [700, '🌍', `Context cluster: <span class="hi">${c.tags[2] ?? ''}</span>`],
        [500, '🤖', 'Running contextual match scoring…'],
        [700, '📍', `Ad placement confirmed at <span class="hi">${fmt(s.adTriggerSec)}</span> — highest context match`],
      ]

      await fadeAlpha(0, 0.88, 300)
      const scanAnim = () => {
        if (!s.scanning) return
        if (canvas) {
          s.scanLineY += 2.5 * s.scanDir
          if (s.scanLineY >= canvas.height || s.scanLineY <= 0) s.scanDir *= -1
        }
        if (s.scanning) requestAnimationFrame(scanAnim)
      }
      requestAnimationFrame(scanAnim)

      for (const [delay, icon, html] of msgs) { await sleep(delay); addLog(icon, html) }
      await sleep(400); await fadeAlpha(0.88, 0, 350)
      s.scanning = false; s.scanAlpha = 0
    }

    // ── Step 4: Scan done — video already playing, just update status ──
    if (!s.adPlaying) setStatus('Playing')
    addLog('▶', `Ad triggers at <span class="hi">${fmt(s.adTriggerSec)}</span>`)

    // Wait for the video to end (ad fires via ontimeupdate at the configured time)
    await playbackComplete
  }

  // ── Public handlers ────────────────────────────────────────────────────────

  function handleUpload(type: 'ctx' | 'ad', input: HTMLInputElement) {
    const f = input.files?.[0]; if (!f) return
    const url = URL.createObjectURL(f)
    if (type === 'ctx') {
      ST.current.ctxUrl = url
      const cv = ctxVidRef.current
      if (cv) {
        cv.src = url; cv.load()
        // Seek to 0 after metadata loads to force first frame decode
        cv.addEventListener('loadedmetadata', () => {
          cv.currentTime = 0
          setCtxDuration(cv.duration)  // drives the placement timeline in preview
        }, { once: true })
        cv.addEventListener('seeked', () => { sizePrev() }, { once: true })
      }
      setCtxName(f.name)
    } else {
      ST.current.adUrl = url
      const av = adVidRef.current
      if (av) {
        av.src = url; av.load()
        av.addEventListener('loadedmetadata', () => { av.currentTime = 0 }, { once: true })
        av.addEventListener('seeked', () => { sizePrev() }, { once: true })
      }
      setAdName(f.name)
    }
  }

  function handleBanner(input: HTMLInputElement) {
    const f = input.files?.[0]; if (!f) return
    const img = new Image()
    img.onload = () => { ST.current.bannerImg = img; liveRedraw() }
    img.src = URL.createObjectURL(f)
    setBannerName(f.name)
  }

  function handleSlideImg(input: HTMLInputElement) {
    const f = input.files?.[0]; if (!f) return
    const img = new Image()
    img.onload = () => { ST.current.slideImg = img; liveRedraw() }
    img.src = URL.createObjectURL(f)
    setSlideImgName(f.name)
    // Reset offsets so stale drag state from a previous image doesn't carry over
    setConfig({ slideImgOffX: 0, slideImgOffY: 0 })
    input.value = ''
  }

  function clearUpload(type: 'ctx' | 'ad') {
    const s = ST.current
    if (type === 'ctx') {
      if (s.ctxUrl) URL.revokeObjectURL(s.ctxUrl)
      s.ctxUrl = null
      const cv = ctxVidRef.current
      if (cv) { cv.removeAttribute('src'); cv.load() }
      setCtxName(''); setCtxDuration(0)
    } else {
      if (s.adUrl) URL.revokeObjectURL(s.adUrl)
      s.adUrl = null
      const av = adVidRef.current
      if (av) { av.removeAttribute('src'); av.load() }
      setAdName('')
    }
  }

  function clearBanner() {
    ST.current.bannerImg = null
    setBannerName('')
  }

  function clearSlideImg() {
    ST.current.slideImg = null
    setSlideImgName('')
  }

  const MIN_AD_TRIGGER_SEC = 10  // scan runs ~4.5s; enforce gap before ad fires

  function validateAdTrigger(): boolean {
    const c = configRef.current
    const triggerSec = c.tsMin * 60 + c.tsSec
    if (triggerSec < MIN_AD_TRIGGER_SEC) {
      showToast(
        `Ad trigger must be at least ${MIN_AD_TRIGGER_SEC}s — the scan runs for ~4.5s and the video needs time to play first.`,
        '#ef4444'
      )
      return false
    }
    return true
  }

  async function startDemo() {
    const s = ST.current
    if (!s.ctxUrl || !s.adUrl) { showToast('Upload both videos first', '#ef4444'); return }
    if (!validateAdTrigger()) return
    setLogLines([]); setDemo('running')
    const cv = ctxVidRef.current, av = adVidRef.current
    if (cv && s.ctxUrl) { cv.src = s.ctxUrl; cv.load() }
    if (av && s.adUrl) { av.src = s.adUrl; av.load() }
    await runFullDemo(false)
    setDemo('complete')
    setTrimIn(0); setTrimOut(1)
    addLog('⬇', 'Demo complete — click Export to record &amp; save')
  }

  async function replayDemo() {
    if (!validateAdTrigger()) return
    setLogLines([]); setDemo('running')
    const s = ST.current
    const cv = ctxVidRef.current, av = adVidRef.current
    if (cv && s.ctxUrl) { cv.src = s.ctxUrl; cv.load() }
    if (av && s.adUrl) { av.src = s.adUrl; av.load() }
    await runFullDemo(false)
    setDemo('complete')
    setTrimIn(0); setTrimOut(1)
  }

  function togglePlay() {
    const s = ST.current
    const cv = ctxVidRef.current
    const av = adVidRef.current
    if (!cv) return

    // s.adPlaying stays true while "in the ad slot" even when paused,
    // so check the actual video element state to know if the ad is running.
    const adActuallyPlaying = s.adPlaying && !!av && !av.paused
    const anythingPlaying   = s.playing || adActuallyPlaying

    if (anythingPlaying) {
      // ── Pause ────────────────────────────────────────────────────────────
      if (s.adPlaying) {
        // Snapshot elapsed ad time before stopping the clock
        s.adElapsedAtPause = (Date.now() - s.adStartTime) / 1000
        // Stop the countdown — wall-clock must not tick while paused
        if (s.countdown) { clearInterval(s.countdown); s.countdown = null }
        av?.pause()
        s.playing = false  // clear so resume branch fires correctly next click
      } else {
        cv.pause()
        s.playing = false
      }
      setStatus('Paused')

    } else {
      // ── Resume ───────────────────────────────────────────────────────────
      if (s.adPlaying) {
        // Shift adStartTime forward by however long we were paused,
        // so the remaining ad duration is preserved exactly
        s.adStartTime = Date.now() - s.adElapsedAtPause * 1000

        // Restart the countdown with the corrected reference time
        const endFn = adEndRef.current
        if (endFn) {
          s.countdown = setInterval(() => {
            const e = (Date.now() - s.adStartTime) / 1000
            s.adRemaining = Math.max(0, s.adDur - Math.floor(e))
            if (e >= s.adDur) endFn()
          }, 250)
        }
        av?.play()
        setStatus('Ad Playing')
      } else {
        cv.play()
        s.playing = true
        setStatus('Playing')
      }
    }
  }

  function seekTo(pct: number) {
    const s = ST.current, v = ctxVidRef.current
    if (!v || !v.duration || s.adPlaying || s.scanning) return
    v.currentTime = pct * s.ctxDur
    s.adTriggered   = v.currentTime >= s.adTriggerSec
    s.bannerTriggered = v.currentTime >= s.bannerTriggerSec
  }

  function startTrimDrag(handle: 'in' | 'out', trackEl: HTMLElement, e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const move = (ev: MouseEvent | TouchEvent) => {
      const t: { clientX: number } = 'touches' in ev ? ev.touches[0] : ev
      const rect = trackEl.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, (t.clientX - rect.left) / rect.width))
      const s = ST.current
      if (handle === 'in') { s.trimIn = Math.min(p, s.trimOut - 0.02); setTrimIn(s.trimIn) }
      else { s.trimOut = Math.max(p, s.trimIn + 0.02); setTrimOut(s.trimOut) }
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchend', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('touchmove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchend', up)
  }

  // Replaces the entire config in one shot — used when loading a saved preset.
  // Backfill any fields that didn't exist when the preset was saved.
  function loadConfig(newConfig: AdEngineConfig) {
    const merged = { ...DEFAULT_CONFIG, ...newConfig }
    configRef.current = { ...merged }
    setConfigState({ ...merged })
  }

  function resetPreview() {
    const v = ctxVidRef.current; if (!v) return
    v.pause()
    ST.current.playing = false
    setStatus('Ready')
    v.addEventListener('loadedmetadata', () => { v.currentTime = 0 }, { once: true })
    if (v.readyState >= 1) {
      v.currentTime = 0
    }
  }

  function previewTrim() {
    const v = ctxVidRef.current; if (!v || !v.duration) return
    const s = ST.current
    v.currentTime = s.trimIn * s.ctxDur
    if (!s.playing) { v.play(); s.playing = true; setStatus('Playing') }
  }

  function getExportSnapshot(): AdEngineExportSnapshot {
    return {
      config: { ...configRef.current },
      ctxUrl: ST.current.ctxUrl,
      adUrl: ST.current.adUrl,
      bannerImg: ST.current.bannerImg,
      slideImg: ST.current.slideImg,
    }
  }

  function getConfigSnapshot(): AdEngineConfig {
    return { ...configRef.current }
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  // ── Canvas drag-to-position ────────────────────────────────────────────────

  interface DragState {
    active: boolean
    type: 'ad' | 'banner' | 'timer' | 'mask' | 'slide' | 'bannerPanel' | null
    startMouseX: number
    startMouseY: number
    startCfgX: number
    startCfgY: number
  }
  const dragRef  = useRef<DragState>({ active: false, type: null, startMouseX: 0, startMouseY: 0, startCfgX: 0, startCfgY: 0 })
  const [hoveredEl, setHoveredEl] = useState<'ad' | 'banner' | 'timer' | 'mask' | 'slide' | 'bannerPanel' | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function toCanvasPos(e: MouseEvent | React.MouseEvent) {
    const canvas = canvasRef.current; if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }

  function hitTest(cx: number, cy: number): 'ad' | 'banner' | 'timer' | 'mask' | 'slide' | 'bannerPanel' | null {
    const c = configRef.current
    const W = 1280, H = 720
    const adW = W * (c.avScale / 100), adH = adW * (9 / 16)
    const adX = (W - adW) * (c.avX / 100), adY = (H - adH) * (c.avY / 100)

    // ── Timer (topmost layer) ────────────────────────────────────────────────
    const tf = Math.max(c.tmFont, Math.round(adH * 0.06))
    const tX = adX + adW * (c.tmX / 100)
    const tY = adY + adH * (c.tmY / 100)
    if (cx >= tX - 4 && cx <= tX + tf * 6 && cy >= tY - tf * 1.3 && cy <= tY + tf * 0.3) {
      return 'timer'
    }

    // ── Banner image (ad overlay) ─────────────────────────────────────────────
    const img = ST.current.bannerImg
    if (img) {
      const bW = adW * (c.bnScale / 100)
      const bH = (img.naturalHeight / img.naturalWidth) * bW
      const bX = adX + (adW - bW) * (c.bnX / 100)
      const bY = adY + (adH - bH) * (c.bnY / 100)
      if (cx >= bX && cx <= bX + bW && cy >= bY && cy <= bY + bH) return 'banner'
    }

    // ── Slide image (checked before panel since it sits on top) ──────────────
    const slideImg = ST.current.slideImg
    if (slideImg) {
      const aw = c.bannerPanelW * c.slideImgScale
      const ah = (slideImg.naturalHeight / slideImg.naturalWidth) * aw
      const ax = c.bannerPanelX + (c.bannerPanelW - aw) / 2 + c.slideImgOffX
      const ay = c.bannerPanelY + (c.bannerPanelH - ah) / 2 + c.slideImgOffY
      if (cx >= ax && cx <= ax + aw && cy >= ay && cy <= ay + ah) return 'slide'
    }

    // ── Banner panel ──────────────────────────────────────────────────────────
    if (slideImg &&
        cx >= c.bannerPanelX && cx <= c.bannerPanelX + c.bannerPanelW &&
        cy >= c.bannerPanelY && cy <= c.bannerPanelY + c.bannerPanelH) return 'bannerPanel'

    // ── Mask rectangle ────────────────────────────────────────────────────────
    const { maskX: mx, maskY: my, maskW: mw, maskH: mh } = c
    if (cx >= mx && cx <= mx + mw && cy >= my && cy <= my + mh) return 'mask'

    // ── Ad video overlay ──────────────────────────────────────────────────────
    if (cx >= adX && cx <= adX + adW && cy >= adY && cy <= adY + adH) return 'ad'
    return null
  }

  function onCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = toCanvasPos(e); if (!pos) return
    const hit = hitTest(pos.x, pos.y); if (!hit) return
    e.preventDefault()
    const c = configRef.current
    const startX = hit === 'ad'          ? c.avX
                 : hit === 'banner'      ? c.bnX
                 : hit === 'timer'       ? c.tmX
                 : hit === 'mask'        ? c.maskX
                 : hit === 'slide'       ? c.slideImgOffX
                 : hit === 'bannerPanel' ? c.bannerPanelX
                 : c.tmX
    const startY = hit === 'ad'          ? c.avY
                 : hit === 'banner'      ? c.bnY
                 : hit === 'timer'       ? c.tmY
                 : hit === 'mask'        ? c.maskY
                 : hit === 'slide'       ? c.slideImgOffY
                 : hit === 'bannerPanel' ? c.bannerPanelY
                 : c.tmY
    dragRef.current = {
      active: true, type: hit,
      startMouseX: pos.x, startMouseY: pos.y,
      startCfgX: startX, startCfgY: startY,
    }
    setIsDragging(true)

    // Global listeners so drag works even if mouse leaves canvas
    const onMove = (ev: MouseEvent) => {
      const p = toCanvasPos(ev); if (!p || !dragRef.current.active) return
      const dx = p.x - dragRef.current.startMouseX
      const dy = p.y - dragRef.current.startMouseY
      const cfg = configRef.current
      const W = 1280, H = 720
      const adW = W * (cfg.avScale / 100), adH = adW * (9 / 16)

      if (dragRef.current.type === 'ad') {
        const roomX = W - adW, roomY = H - adH
        const origX = roomX * (dragRef.current.startCfgX / 100)
        const origY = roomY * (dragRef.current.startCfgY / 100)
        setConfig({
          avX: Math.max(0, Math.min(100, (origX + dx) / Math.max(1, roomX) * 100)),
          avY: Math.max(0, Math.min(100, (origY + dy) / Math.max(1, roomY) * 100)),
        })

      } else if (dragRef.current.type === 'banner') {
        const img = ST.current.bannerImg; if (!img) return
        const bW = adW * (cfg.bnScale / 100)
        const bH = (img.naturalHeight / img.naturalWidth) * bW
        const roomX = Math.max(1, adW - bW), roomY = Math.max(1, adH - bH)
        const origX = roomX * (dragRef.current.startCfgX / 100)
        const origY = roomY * (dragRef.current.startCfgY / 100)
        setConfig({
          bnX: Math.max(0, Math.min(100, (origX + dx) / roomX * 100)),
          bnY: Math.max(0, Math.min(100, (origY + dy) / roomY * 100)),
        })

      } else if (dragRef.current.type === 'timer') {
        setConfig({
          tmX: Math.max(0, Math.min(95, dragRef.current.startCfgX + dx / Math.max(1, adW) * 100)),
          tmY: Math.max(0, Math.min(95, dragRef.current.startCfgY + dy / Math.max(1, adH) * 100)),
        })

      } else if (dragRef.current.type === 'mask') {
        // maskX/Y are absolute px on the 1280×720 canvas
        const newMx = dragRef.current.startCfgX + dx
        const newMy = dragRef.current.startCfgY + dy
        setConfig({
          maskX: Math.max(0, Math.min(W - cfg.maskW, newMx)),
          maskY: Math.max(0, Math.min(H - cfg.maskH, newMy)),
        })

      } else if (dragRef.current.type === 'slide') {
        setConfig({
          slideImgOffX: dragRef.current.startCfgX + dx,
          slideImgOffY: dragRef.current.startCfgY + dy,
        })

      } else if (dragRef.current.type === 'bannerPanel') {
        setConfig({
          bannerPanelX: Math.max(0, Math.min(W - cfg.bannerPanelW, dragRef.current.startCfgX + dx)),
          bannerPanelY: Math.max(0, Math.min(H - cfg.bannerPanelH, dragRef.current.startCfgY + dy)),
        })
      }
    }

    const onUp = () => {
      dragRef.current.active = false
      dragRef.current.type = null
      setIsDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (dragRef.current.active) return  // global listener handles it
    const pos = toCanvasPos(e)
    setHoveredEl(pos ? hitTest(pos.x, pos.y) : null)
  }

  function onCanvasMouseLeave() {
    if (!dragRef.current.active) setHoveredEl(null)
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    canvasRef, ctxVidRef, adVidRef,
    config, setConfig,
    demoState,
    logLines, playerStatus,
    progressPct,
    // Marker positions derived from config + duration — always accurate in any state
    adMarkerPct:     ctxDuration > 0 ? Math.min((config.tsMin * 60 + config.tsSec) / (ctxDuration + config.adDur) * 100, 97) : 0,
    adEndPct:        ctxDuration > 0 ? Math.min((config.tsMin * 60 + config.tsSec + config.adDur) / (ctxDuration + config.adDur) * 100, 99) : 0,
    ctxDuration,
    trimIn, trimOut,
    currentTime, totalTime,
    ctxUploaded, adUploaded, bannerUploaded, slideImgUploaded,
    handleUpload, handleBanner, handleSlideImg,
    clearUpload, clearBanner, clearSlideImg,
    loadConfig,
    startDemo, replayDemo, togglePlay, seekTo, resetPreview,
    startTrimDrag, previewTrim,
    getExportSnapshot,
    getConfigSnapshot,
    sizePrev, liveRedraw,
    // Canvas drag
    onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseLeave,
    isDragging, hoveredEl,
  }
}
