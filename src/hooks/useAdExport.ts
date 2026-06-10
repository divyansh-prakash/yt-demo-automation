import { useEffect, useRef, useState } from 'react'
import type { AdEngineConfig, AdEngineExportSnapshot, ExportFormat } from '../types'

interface ExportRuntime {
  adTriggerSec: number
  bannerTriggerSec: number
  adDur: number
  adRemaining: number
  adPlaying: boolean
  adTriggered: boolean
  bannerTriggered: boolean
  scanning: boolean
  scanAlpha: number
  scanLineY: number
  scanDir: 1 | -1
  playing: boolean
  countdown: ReturnType<typeof setInterval> | null
  adStartTime: number
}

interface ExportEnv {
  canvas: HTMLCanvasElement
  ctxVideo: HTMLVideoElement
  adVideo: HTMLVideoElement
  bannerImg: HTMLImageElement | null
  slideImg: HTMLImageElement | null
  config: AdEngineConfig
  runtime: ExportRuntime
  currentTimeRef: { current: number }
  scratchCanvas: HTMLCanvasElement
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function applyEasing(t: number, type: AdEngineConfig['easing']): number {
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

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (!r) { ctx.rect(x, y, w, h); return }
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawCtxVideo(ctx: CanvasRenderingContext2D, vid: HTMLVideoElement, W: number, H: number, config: AdEngineConfig) {
  const sc = config.cvScale / 100
  const xp = config.cvX / 100
  const yp = config.cvY / 100
  const vw = vid.videoWidth || W
  const vh = vid.videoHeight || H
  const vidAR = vw / vh
  const canAR = W / H
  let dw: number
  let dh: number

  if (config.cvFit === 'contain') {
    if (vidAR > canAR) { dw = W; dh = W / vidAR } else { dh = H; dw = H * vidAR }
  } else if (config.cvFit === 'stretch') {
    dw = W; dh = H
  } else {
    if (vidAR > canAR) { dh = H; dw = H * vidAR } else { dw = W; dh = W / vidAR }
  }

  dw *= sc
  dh *= sc
  const dx = (W - dw) * xp
  const dy = (H - dh) * yp

  ctx.save()
  if (config.cvRadius) {
    ctx.beginPath()
    rrect(ctx, dx, dy, dw, dh, config.cvRadius)
    ctx.clip()
  }
  ctx.drawImage(vid, dx, dy, dw, dh)
  ctx.restore()
}

function drawRect(ctx: CanvasRenderingContext2D, W: number, H: number, config: AdEngineConfig) {
  const rw = config.rectW / 100 * W
  const rh = config.rectH / 100 * H
  const rx = (W - rw) * (config.rectX / 100)
  const ry = (H - rh) * (config.rectY / 100)
  ctx.save()
  ctx.globalAlpha = config.rectOpacity / 100
  ctx.beginPath()
  rrect(ctx, rx, ry, rw, rh, config.rectRadius)
  ctx.fillStyle = config.rectColor
  ctx.fill()
  ctx.restore()
}

function adGeom(W: number, H: number, config: AdEngineConfig) {
  const adW = W * (config.avScale / 100)
  const adH = adW * (9 / 16)
  return {
    adX: (W - adW) * (config.avX / 100),
    adY: (H - adH) * (config.avY / 100),
    adW,
    adH,
  }
}

function drawAdVideo(ctx: CanvasRenderingContext2D, vid: HTMLVideoElement, W: number, H: number, config: AdEngineConfig) {
  const g = adGeom(W, H, config)
  ctx.save()
  if (config.avRadius) {
    ctx.beginPath()
    rrect(ctx, g.adX, g.adY, g.adW, g.adH, config.avRadius)
    ctx.clip()
  }
  ctx.drawImage(vid, g.adX, g.adY, g.adW, g.adH)
  ctx.restore()
  return g
}

function drawBanner(ctx: CanvasRenderingContext2D, config: AdEngineConfig, bannerImg: HTMLImageElement | null, adX: number, adY: number, adW: number, adH: number) {
  if (!bannerImg) return
  const bW = adW * (config.bnScale / 100)
  const bH = (bannerImg.naturalHeight / bannerImg.naturalWidth) * bW
  ctx.drawImage(bannerImg, adX + (adW - bW) * (config.bnX / 100), adY + (adH - bH) * (config.bnY / 100), bW, bH)
}

function drawTimer(ctx: CanvasRenderingContext2D, config: AdEngineConfig, adX: number, adY: number, adW: number, adH: number, rem: number) {
  const tf = config.tmFont
  const txt = `Ad: 0:${String(rem).padStart(2, '0')}`
  const tX = adX + adW * (config.tmX / 100)
  const tY = adY + adH * (config.tmY / 100)
  ctx.save()
  ctx.font = `bold ${tf}px Inter,sans-serif`
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillText(txt, tX + 1, tY + 1)
  ctx.fillStyle = '#fff'
  ctx.fillText(txt, tX, tY)
  ctx.restore()
}

function drawCtxLabel(ctx: CanvasRenderingContext2D, H: number) {
  const sc = (H || 400) / 400
  const fs = Math.round(13 * sc)
  const lW = Math.round(140 * sc)
  const lH = Math.round(60 * sc)
  const lX = Math.round(12 * sc)
  const lY = Math.round(12 * sc)
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  rrect(ctx, lX, lY, lW, lH, Math.round(8 * sc))
  ctx.fill()
  ctx.fillStyle = '#00c4a4'
  ctx.font = `bold ${fs}px Inter,sans-serif`
  ctx.fillText('CONTEXT VIDEO', lX + Math.round(10 * sc), lY + Math.round(20 * sc))
  ctx.fillStyle = '#aaa'
  ctx.font = `${Math.round(11 * sc)}px Inter,sans-serif`
  ctx.fillText('Analysing content…', lX + Math.round(10 * sc), lY + Math.round(40 * sc))
  ctx.restore()
}

function drawScanOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number, lineY: number) {
  const sc = H / 400
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(7,7,15,0.82)'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, 'transparent')
  g.addColorStop(0.4, 'rgba(0,196,164,0.8)')
  g.addColorStop(0.6, 'rgba(0,196,164,0.8)')
  g.addColorStop(1, 'transparent')
  ctx.strokeStyle = g
  ctx.lineWidth = Math.max(2, 3 * sc)
  ctx.shadowColor = '#00c4a4'
  ctx.shadowBlur = 18 * sc
  ctx.beginPath()
  ctx.moveTo(0, lineY)
  ctx.lineTo(W, lineY)
  ctx.stroke()
  ctx.shadowBlur = 0
  const fw = Math.round(220 * sc)
  const fh = Math.round(28 * sc)
  const fx = (W - fw) / 2
  const fy = Math.round(16 * sc)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  rrect(ctx, fx, fy, fw, fh, Math.round(6 * sc))
  ctx.fill()
  ctx.fillStyle = '#00c4a4'
  ctx.font = `bold ${Math.round(12 * sc)}px Inter,sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('⬤ AI CONTEXTUAL SCAN ACTIVE', W / 2, fy + Math.round(19 * sc))
  ctx.textAlign = 'left'
  ctx.restore()
}

function drawCtxOverlayTags(ctx: CanvasRenderingContext2D, config: AdEngineConfig, H: number) {
  const tagColors = ['#7c3aed', '#0891b2', '#db2777', '#16a34a', '#d97706']
  const sc = H / 400
  const pad = Math.round(8 * sc)
  const lh = Math.round(28 * sc)
  const lX = Math.round(14 * sc)
  const r = Math.round(10 * sc)
  let lY = Math.round(14 * sc)
  const fs = Math.round(12 * sc)
  ctx.save()
  ctx.font = `bold ${fs}px Inter,sans-serif`
  for (let i = 0; i < config.tags.length; i++) {
    const label = config.tags[i]
    if (!label) continue
    const color = tagColors[i % tagColors.length]
    const tw = ctx.measureText(label).width
    ctx.globalAlpha = 0.92
    ctx.fillStyle = color
    ctx.beginPath()
    rrect(ctx, lX, lY, tw + pad * 2, lh, r)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#fff'
    ctx.fillText(label, lX + pad, lY + lh - Math.round(8 * sc))
    lY += lh + Math.round(6 * sc)
  }
  ctx.restore()
}

// Mask animation only. Called BEFORE ad overlay so scratch captures clean video.
function drawSlideBanner(ctx: CanvasRenderingContext2D, env: ExportEnv) {
  const { config, runtime, slideImg, currentTimeRef, scratchCanvas } = env
  const { maskX: mx, maskY: my, maskW: mw, maskH: mh } = config
  if (!slideImg || !runtime.bannerTriggered) return

  const elapsed = Math.max(0, currentTimeRef.current - runtime.bannerTriggerSec)
  const sP = Math.min(1, Math.max(0, elapsed / Math.max(0.001, config.slideDur)))
  if (sP <= 0) return

  const ep = applyEasing(sP, config.easing)
  let dx = 0, dy = 0
  if (config.slideDir === 'up') dy = -config.slideAmt * ep
  else if (config.slideDir === 'down') dy = config.slideAmt * ep
  else if (config.slideDir === 'left') dx = -config.slideAmt * ep
  else dx = config.slideAmt * ep

  if (scratchCanvas.width !== mw || scratchCanvas.height !== mh) {
    scratchCanvas.width = mw; scratchCanvas.height = mh
  }
  const sc = scratchCanvas.getContext('2d')
  if (sc) { sc.clearRect(0, 0, mw, mh); sc.drawImage(ctx.canvas, mx, my, mw, mh, 0, 0, mw, mh) }

  ctx.save()
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip()
  ctx.globalAlpha = config.panelOpacity
  ctx.fillStyle = config.panelColor
  ctx.fillRect(mx, my, mw, mh)
  ctx.globalAlpha = 1
  ctx.drawImage(scratchCanvas, 0, 0, mw, mh, mx + dx, my + dy, mw, mh)
  ctx.restore()
}

// White panel — independent layer, drawn AFTER ad overlay so it's always on top.
function drawBannerPanel(ctx: CanvasRenderingContext2D, env: ExportEnv) {
  const { config, runtime, slideImg, currentTimeRef } = env
  if (!slideImg || !runtime.bannerTriggered) return

  const elapsed = Math.max(0, currentTimeRef.current - runtime.bannerTriggerSec)
  const alpha = Math.min(1, elapsed * 3)
  if (alpha <= 0) return

  ctx.save()
  ctx.globalAlpha = alpha * config.panelOpacity
  ctx.fillStyle = config.panelColor
  ctx.fillRect(config.bannerPanelX, config.bannerPanelY, config.bannerPanelW, config.bannerPanelH)
  ctx.globalAlpha = 1
  ctx.restore()
}

// Banner image — independent layer, drawn on top of white panel.
function drawSlideBannerImage(ctx: CanvasRenderingContext2D, env: ExportEnv) {
  const { config, runtime, slideImg, currentTimeRef } = env
  if (!slideImg || !runtime.bannerTriggered) return

  const elapsed = Math.max(0, currentTimeRef.current - runtime.bannerTriggerSec)
  const alpha = Math.min(1, elapsed * 3)
  if (alpha <= 0) return

  const aw = config.bannerPanelW * config.slideImgScale
  const ah = (slideImg.height / slideImg.width) * aw
  const ax = config.bannerPanelX + (config.bannerPanelW - aw) / 2 + config.slideImgOffX
  const ay = config.bannerPanelY + (config.bannerPanelH - ah) / 2 + config.slideImgOffY

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(slideImg, ax, ay, aw, ah)
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawFrame(env: ExportEnv) {
  const { canvas, ctxVideo, adVideo, runtime, config, currentTimeRef } = env
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)
  // Advance virtual time using wall-clock during the ad so the slide banner
  // animation progresses even though ctxVideo is paused at adTriggerSec.
  if (runtime.adPlaying && runtime.adStartTime > 0) {
    const adElapsed = (Date.now() - runtime.adStartTime) / 1000
    currentTimeRef.current = runtime.adTriggerSec + adElapsed
  } else {
    currentTimeRef.current = ctxVideo.currentTime
  }

  if (runtime.scanning) {
    if (ctxVideo.readyState >= 2) drawCtxVideo(ctx, ctxVideo, W, H, config)
    if (runtime.scanAlpha > 0) drawScanOverlay(ctx, W, H, runtime.scanAlpha, runtime.scanLineY)
    drawCtxOverlayTags(ctx, config, H)
    drawCtxLabel(ctx, H)
    return
  }

  if (ctxVideo.readyState >= 2) drawCtxVideo(ctx, ctxVideo, W, H, config)

  // Slide banner before ad overlay so its scratch captures only the context video.
  drawSlideBanner(ctx, env)

  if (runtime.adPlaying && adVideo.readyState >= 2) {
    drawRect(ctx, W, H, config)
    const { adX, adY, adW, adH } = drawAdVideo(ctx, adVideo, W, H, config)
    drawBanner(ctx, config, env.bannerImg, adX, adY, adW, adH)
    drawTimer(ctx, config, adX, adY, adW, adH, runtime.adRemaining)
  }

  // White panel + banner image after ad overlay so they're always on top.
  drawBannerPanel(ctx, env)
  drawSlideBannerImage(ctx, env)
}

function selectRecorderMime(preferredFormat: ExportFormat) {
  const mp4Mimes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42001E,mp4a.40.2',
    'video/mp4',
  ]
  const webmMimes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  const preferred = preferredFormat === 'mp4' ? mp4Mimes : webmMimes
  const fallback = preferredFormat === 'mp4' ? webmMimes : mp4Mimes
  const mime = [...preferred, ...fallback].find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

  return {
    mime,
    actualFormat: mime.startsWith('video/mp4') ? 'mp4' as const : 'webm' as const,
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => document.body.removeChild(a), 300)
}

function waitForMetadata(video: HTMLVideoElement) {
  return new Promise<void>(resolve => {
    if (video.readyState >= 1) { resolve(); return }
    const onLoad = () => {
      video.removeEventListener('loadedmetadata', onLoad)
      resolve()
    }
    video.addEventListener('loadedmetadata', onLoad)
    setTimeout(resolve, 4000)
  })
}

function seekAndWait(video: HTMLVideoElement, time: number) {
  return new Promise<void>(resolve => {
    if (Math.abs(video.currentTime - time) < 0.05) { resolve(); return }
    const onSeek = () => {
      video.removeEventListener('seeked', onSeek)
      resolve()
    }
    video.addEventListener('seeked', onSeek)
    video.currentTime = time
    setTimeout(resolve, 2000)
  })
}

function createHiddenVideo(url: string) {
  const video = document.createElement('video')
  video.src = url
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.playsInline = true
  return video
}

export function useAdExport(
  showToast: (msg: string, options?: { color?: string, duration?: number } | string) => void,
  getSnapshot: () => AdEngineExportSnapshot,
) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('webm')
  const [isExporting, setIsExporting] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  async function downloadDemo(preferredFormat: ExportFormat) {
    const snapshot = getSnapshot()
    if (!snapshot.ctxUrl || !snapshot.adUrl) {
      showToast('Upload both videos first', '#ef4444')
      return
    }
    if (isExporting) {
      showToast('Recording already in progress…', '#d97706')
      return
    }

    setIsExporting(true)
    showToast('Download has started. It may take some time.', { color: '#ffb830', duration: 3400 })

    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720

    const ctxVideo = createHiddenVideo(snapshot.ctxUrl)
    const adVideo = createHiddenVideo(snapshot.adUrl)

    const runtime: ExportRuntime = {
      adTriggerSec: snapshot.config.tsMin * 60 + snapshot.config.tsSec,
      bannerTriggerSec: snapshot.config.tsMin * 60 + snapshot.config.tsSec,
      adDur: snapshot.config.adDur,
      adRemaining: snapshot.config.adDur,
      adPlaying: false,
      adTriggered: false,
      bannerTriggered: false,
      scanning: false,
      scanAlpha: 0,
      scanLineY: 0,
      scanDir: 1,
      playing: false,
      countdown: null,
      adStartTime: 0,
    }

    const currentTimeRef = { current: 0 }
    let rafId: number | null = null
    let actx: AudioContext | null = null
    let dest: MediaStreamAudioDestinationNode | null = null
    const scratchCanvas = document.createElement('canvas')

    const env: ExportEnv = {
      canvas,
      ctxVideo,
      adVideo,
      bannerImg: snapshot.bannerImg,
      slideImg: snapshot.slideImg,
      config: snapshot.config,
      scratchCanvas,
      runtime,
      currentTimeRef,
    }

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (runtime.countdown) clearInterval(runtime.countdown)
      ctxVideo.pause()
      adVideo.pause()
      ctxVideo.src = ''
      adVideo.src = ''
      ctxVideo.load()
      adVideo.load()
      dest?.stream.getTracks().forEach(t => t.stop())
      actx?.close().catch(() => {})
      cleanupRef.current = null
    }
    cleanupRef.current = cleanup

    const renderLoop = () => {
      if (runtime.scanning) {
        runtime.scanLineY += 2.5 * runtime.scanDir
        if (runtime.scanLineY >= canvas.height || runtime.scanLineY <= 0) runtime.scanDir *= -1
      }
      drawFrame(env)
      rafId = requestAnimationFrame(renderLoop)
    }
    rafId = requestAnimationFrame(renderLoop)

    try {
      await Promise.all([waitForMetadata(ctxVideo), waitForMetadata(adVideo)])

      actx = new AudioContext()
      dest = actx.createMediaStreamDestination()
      const ctxNode = actx.createMediaElementSource(ctxVideo)
      const adNode = actx.createMediaElementSource(adVideo)
      ctxNode.connect(dest)
      adNode.connect(dest)

      const stream = canvas.captureStream(60)
      dest.stream.getAudioTracks().forEach(track => stream.addTrack(track))
      const chunks: Blob[] = []
      const { mime, actualFormat } = selectRecorderMime(preferredFormat)
      if (preferredFormat === 'mp4' && actualFormat !== 'mp4') {
        showToast('MP4 export is not supported here. Falling back to WebM.', '#d97706')
      }

      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
      recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data) }

      recorder.start(50)
      await sleep(150)

      runtime.scanning = true
      runtime.scanAlpha = 0
      runtime.scanLineY = 0
      runtime.scanDir = 1
      ctxVideo.muted = true
      await ctxVideo.play()

      const fadeAlpha = async (from: number, to: number, ms: number) => {
        runtime.scanAlpha = from
        const steps = 20
        const dt = ms / steps
        const delta = (to - from) / steps
        for (let i = 0; i < steps; i++) {
          await sleep(dt)
          runtime.scanAlpha = Math.max(0, Math.min(1, runtime.scanAlpha + delta))
        }
        runtime.scanAlpha = to
      }

      await fadeAlpha(0, 0.88, 300)
      await sleep(3800)
      await fadeAlpha(0.88, 0, 350)
      runtime.scanning = false
      runtime.scanAlpha = 0

      await seekAndWait(ctxVideo, 0)
      ctxVideo.muted = false
      await ctxVideo.play()
      runtime.playing = true

      await new Promise<void>(resolve => {
        ctxVideo.ontimeupdate = () => {
          const ct = ctxVideo.currentTime

          if (!runtime.bannerTriggered && ct >= runtime.bannerTriggerSec) {
            runtime.bannerTriggered = true
          }

          if (!runtime.adTriggered && ct >= runtime.adTriggerSec) {
            runtime.adTriggered = true
            ctxVideo.pause()
            runtime.adPlaying = true
            runtime.adRemaining = runtime.adDur
            adVideo.currentTime = 0
            adVideo.muted = false
            void adVideo.play()

            runtime.adStartTime = Date.now()
            const endAd = () => {
              if (!runtime.adPlaying) return
              if (runtime.countdown) clearInterval(runtime.countdown)
              runtime.countdown = null
              runtime.adPlaying = false
              adVideo.pause()
              adVideo.onended = null
              void ctxVideo.play()
            }

            runtime.countdown = setInterval(() => {
              const elapsed = (Date.now() - runtime.adStartTime) / 1000
              runtime.adRemaining = Math.max(0, runtime.adDur - Math.floor(elapsed))
              if (elapsed >= runtime.adDur) endAd()
            }, 250)

            adVideo.onended = () => {
              const elapsed = (Date.now() - runtime.adStartTime) / 1000
              if (elapsed < runtime.adDur) {
                adVideo.currentTime = 0
                void adVideo.play()
              } else {
                endAd()
              }
            }
          }
        }

        ctxVideo.onended = () => {
          ctxVideo.ontimeupdate = null
          ctxVideo.onended = null
          runtime.playing = false
          resolve()
        }
      })

      await sleep(300)

      await new Promise<void>(resolve => {
        recorder.onstop = () => {
          if (!chunks.length) {
            showToast('No recording data', '#ef4444')
            resolve()
            return
          }
          const blob = new Blob(chunks, { type: mime })
          const url = URL.createObjectURL(blob)
          triggerDownload(url, `ad-engine-demo.${actualFormat}`)
          setTimeout(() => URL.revokeObjectURL(url), 30000)
          showToast(actualFormat === 'mp4' ? 'Demo downloaded as MP4.' : 'Demo downloaded as WebM.', { color: '#39e88f', duration: 2800 })
          resolve()
        }
        recorder.stop()
      })
    } catch {
      showToast('Export failed. Please try again.', '#ef4444')
    } finally {
      cleanup()
      setIsExporting(false)
    }
  }

  return {
    exportFormat,
    setExportFormat,
    isExporting,
    downloadDemo,
  }
}
