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
  panelAnimStartTime: number
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

function drawContextPanel(ctx: CanvasRenderingContext2D, config: AdEngineConfig, H: number, panelT: number) {
  const tags = config.tags.filter(Boolean)
  const semantics = config.semantics.filter(Boolean)
  const videoTags = config.videoTags.filter(Boolean)
  if (!tags.length && !semantics.length && !videoTags.length) return

  const sc = H / 720
  const ctxLX = Math.round((24 + config.ctxTagsOffX) * sc)
  const semLX = Math.round((24 + config.semTagsOffX) * sc)
  const vtLX  = Math.round((24 + config.videoTagsOffX) * sc)
  const TEAL = '#4ecdc4'
  const anim = config.tagAnimation
  const ITEM_DUR = 0.25

  const applyAnim = (et: number, ecx: number, ecy: number) => {
    ctx.globalAlpha = et
    if (anim === 'slide-left') ctx.translate(Math.round(-50 * sc * (1 - et)), 0)
    else if (anim === 'slide-up') ctx.translate(0, Math.round(20 * sc * (1 - et)))
    else if (anim === 'pop') {
      const s2 = 0.7 + 0.3 * et
      ctx.translate(ecx, ecy); ctx.scale(s2, s2); ctx.translate(-ecx, -ecy)
    }
  }

  const hdrFs = Math.round(13 * sc)
  const tagFs = Math.round(12 * sc)
  const semFs = Math.round(13 * sc)
  const nTags = tags.length, nSems = semantics.length, nVTags = videoTags.length
  const tagStagger = nTags > 1 ? Math.min(0.1, 0.25 / (nTags - 1)) : 0
  const semBaseStart = Math.min(0.52, 0.40 + Math.max(nTags, 1) * tagStagger + 0.05)
  const semStagger = nSems > 1 ? Math.min(0.1, 0.12 / (nSems - 1)) : 0
  const vtBaseStart = Math.min(0.62, semBaseStart + 0.04 + Math.max(nSems, 1) * semStagger)
  const vtStagger = nVTags > 1 ? Math.min(0.06, 0.14 / (nVTags - 1)) : 0
  const VT_DUR = 0.22

  let y = Math.round((48 + config.ctxTagsOffY) * sc)

  {
    const et = applyEasing(Math.max(0, Math.min(1, (panelT - 0.30) / ITEM_DUR)), 'ease')
    if (et > 0) {
      ctx.save(); ctx.font = `bold ${hdrFs}px Inter,sans-serif`
      const hw = ctx.measureText('CONTEXT').width
      applyAnim(et, ctxLX + hw / 2, y - hdrFs * 0.4)
      ctx.fillStyle = TEAL; ctx.fillText('CONTEXT', ctxLX, y); ctx.restore()
    }
  }
  y += Math.round(22 * sc)

  for (let i = 0; i < nTags; i++) {
    const et = applyEasing(Math.max(0, Math.min(1, (panelT - (0.40 + i * tagStagger)) / ITEM_DUR)), 'ease')
    ctx.font = `bold ${tagFs}px Inter,sans-serif`
    const label = tags[i].toUpperCase()
    const tw = ctx.measureText(label).width
    const pH = Math.round(30 * sc), hPad = Math.round(14 * sc)
    const pW = Math.min(tw + hPad * 2, Math.round(212 * sc))
    if (et > 0) {
      ctx.save(); applyAnim(et, ctxLX + pW / 2, y + pH / 2)
      ctx.globalAlpha = et * 0.9; ctx.fillStyle = TEAL
      ctx.beginPath(); rrect(ctx, ctxLX, y, pW, pH, pH / 2); ctx.fill()
      ctx.globalAlpha = et; ctx.fillStyle = '#fff'
      ctx.font = `bold ${tagFs}px Inter,sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, ctxLX + hPad, y + pH - Math.round(8 * sc)); ctx.restore()
    }
    y += pH + Math.round(8 * sc)
  }
  y += Math.round((24 + config.semTagsOffY) * sc)

  {
    const et = applyEasing(Math.max(0, Math.min(1, (panelT - semBaseStart) / ITEM_DUR)), 'ease')
    if (et > 0) {
      ctx.save(); ctx.font = `bold ${hdrFs}px Inter,sans-serif`
      const hw = ctx.measureText('SEMANTICS').width
      applyAnim(et, semLX + hw / 2, y - hdrFs * 0.4)
      ctx.fillStyle = TEAL; ctx.fillText('SEMANTICS', semLX, y); ctx.restore()
    }
  }
  y += Math.round(24 * sc)

  for (let i = 0; i < nSems; i++) {
    const et = applyEasing(Math.max(0, Math.min(1, (panelT - (semBaseStart + 0.05 + i * semStagger)) / ITEM_DUR)), 'ease')
    const sem = semantics[i]
    if (et > 0) {
      ctx.save(); ctx.font = `${semFs}px Inter,sans-serif`
      const sw = ctx.measureText(sem).width
      applyAnim(et, semLX + sw / 2, y - semFs * 0.4)
      ctx.fillStyle = '#fff'; ctx.fillText(sem, semLX, y); ctx.restore()
    }
    y += Math.round(22 * sc)
  }

  if (!nVTags) return
  y += Math.round((24 + config.videoTagsOffY) * sc)

  {
    const et = applyEasing(Math.max(0, Math.min(1, (panelT - vtBaseStart) / ITEM_DUR)), 'ease')
    if (et > 0) {
      ctx.save(); ctx.font = `bold ${hdrFs}px Inter,sans-serif`
      const hw = ctx.measureText('VIDEO TAGS').width
      applyAnim(et, vtLX + hw / 2, y - hdrFs * 0.4)
      ctx.fillStyle = TEAL; ctx.fillText('VIDEO TAGS', vtLX, y); ctx.restore()
    }
  }
  y += Math.round(22 * sc)

  const dotR = Math.round(9 * sc)
  const dotGap = Math.round(7 * sc)
  for (let i = 0; i < nVTags; i++) {
    const et = applyEasing(Math.max(0, Math.min(1, (panelT - (vtBaseStart + 0.04 + i * vtStagger)) / VT_DUR)), 'ease')
    if (et > 0) {
      ctx.font = `bold ${tagFs}px Inter,sans-serif`
      const label = videoTags[i].toUpperCase()
      const lw = ctx.measureText(label).width
      ctx.save()
      applyAnim(et, vtLX + (dotR * 2 + dotGap + lw) / 2, y)
      ctx.fillStyle = TEAL
      ctx.beginPath(); ctx.arc(vtLX + dotR, y, dotR, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(dotR * 1.1)}px Inter,sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('✓', vtLX + dotR, y)
      ctx.font = `bold ${tagFs}px Inter,sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, vtLX + dotR * 2 + dotGap, y + Math.round(tagFs * 0.36))
      ctx.restore()
    }
    y += 2 * dotR + Math.round(8 * sc)
  }
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


function drawSlideBanner(ctx: CanvasRenderingContext2D, env: ExportEnv) {
  const { config, runtime, slideImg, currentTimeRef, ctxVideo } = env
  const { maskX: mx, maskY: my, maskW: mw, maskH: mh } = config
  if (!slideImg || !runtime.bannerTriggered) return

  const elapsed = Math.max(0, currentTimeRef.current - runtime.bannerTriggerSec)
  const sP = Math.min(1, Math.max(0, elapsed / Math.max(0.001, config.slideDur)))
  if (sP <= 0) return

  const ep = applyEasing(sP, config.easing)
  let sx = 0, sy = 0
  if (config.slideDir === 'up') sy = -config.slideAmt * ep
  else if (config.slideDir === 'down') sy = config.slideAmt * ep
  else if (config.slideDir === 'left') sx = -config.slideAmt * ep
  else sx = config.slideAmt * ep

  const W = env.canvas.width, H = env.canvas.height

  ctx.save()
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip()
  ctx.globalAlpha = config.panelOpacity
  ctx.fillStyle = config.panelColor
  ctx.fillRect(mx, my, mw, mh)
  ctx.globalAlpha = 1
  ctx.translate(sx, sy)
  if (ctxVideo.readyState >= 2) drawCtxVideo(ctx, ctxVideo, W, H, config)
  ctx.restore()
}

function drawBannerPanel(ctx: CanvasRenderingContext2D, env: ExportEnv) {
  const { config, runtime, slideImg, currentTimeRef } = env
  if (!slideImg || !runtime.bannerTriggered) return

  const { maskX: mx, maskY: my, maskW: mw, maskH: mh } = config
  const elapsed = Math.max(0, currentTimeRef.current - runtime.bannerTriggerSec)
  const sP = Math.min(1, elapsed / Math.max(0.001, config.slideDur))
  if (sP <= 0) return
  const ep = applyEasing(sP, config.easing)

  let ptx = 0, pty = 0
  if      (config.slideDir === 'down')  pty = -config.slideAmt * (1 - ep)
  else if (config.slideDir === 'up')    pty =  config.slideAmt * (1 - ep)
  else if (config.slideDir === 'right') ptx = -config.slideAmt * (1 - ep)
  else                                  ptx =  config.slideAmt * (1 - ep)

  ctx.save()
  ctx.globalAlpha = config.panelOpacity
  ctx.fillStyle = config.panelColor
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip()
  ctx.translate(ptx, pty)
  if (config.bannerPanelRadius) {
    ctx.beginPath()
    rrect(ctx, config.bannerPanelX, config.bannerPanelY, config.bannerPanelW, config.bannerPanelH, config.bannerPanelRadius)
    ctx.fill()
  } else {
    ctx.fillRect(config.bannerPanelX, config.bannerPanelY, config.bannerPanelW, config.bannerPanelH)
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawSlideBannerImage(ctx: CanvasRenderingContext2D, env: ExportEnv) {
  const { config, runtime, slideImg, currentTimeRef } = env
  if (!slideImg || !runtime.bannerTriggered) return

  const { maskX: mx, maskY: my, maskW: mw, maskH: mh } = config
  const elapsed = Math.max(0, currentTimeRef.current - runtime.bannerTriggerSec)
  const sP = Math.min(1, elapsed / Math.max(0.001, config.slideDur))
  if (sP <= 0) return
  const ep = applyEasing(sP, config.easing)

  let ptx = 0, pty = 0
  if      (config.slideDir === 'down')  pty = -config.slideAmt * (1 - ep)
  else if (config.slideDir === 'up')    pty =  config.slideAmt * (1 - ep)
  else if (config.slideDir === 'right') ptx = -config.slideAmt * (1 - ep)
  else                                  ptx =  config.slideAmt * (1 - ep)

  const aw = config.bannerPanelW * config.slideImgScale
  const ah = slideImg.naturalWidth > 0 ? (slideImg.naturalHeight / slideImg.naturalWidth) * aw : aw
  const ax = config.bannerPanelX + (config.bannerPanelW - aw) / 2 + config.slideImgOffX
  const ay = config.bannerPanelY + (config.bannerPanelH - ah) / 2 + config.slideImgOffY

  ctx.save()
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip()
  ctx.translate(ptx, pty)
  ctx.drawImage(slideImg, ax, ay, aw, ah)
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
  // After ad ends, add adDur offset so elapsed time never resets to 0
  // (which would re-trigger the slide banner animation).
  if (runtime.adPlaying && runtime.adStartTime > 0) {
    const adElapsed = (Date.now() - runtime.adStartTime) / 1000
    currentTimeRef.current = runtime.adTriggerSec + adElapsed
  } else if (runtime.adTriggered && !runtime.adPlaying) {
    currentTimeRef.current = ctxVideo.currentTime + runtime.adDur
  } else {
    currentTimeRef.current = ctxVideo.currentTime
  }

  if (runtime.scanning) {
    if (ctxVideo.readyState >= 2) drawCtxVideo(ctx, ctxVideo, W, H, config)
    if (runtime.scanAlpha > 0) drawScanOverlay(ctx, W, H, runtime.scanAlpha, runtime.scanLineY)
    return
  }

  // Panel mode — video scaled into right portion, context panel on left.
  const inPanelMode = runtime.playing || runtime.adPlaying || runtime.adTriggered
  if (inPanelMode) {
    if (!runtime.panelAnimStartTime) runtime.panelAnimStartTime = Date.now()
    const PANEL_ANIM_MS = 1000
    const panelT = Math.min(1, (Date.now() - runtime.panelAnimStartTime) / PANEL_ANIM_MS)
    const eT = applyEasing(panelT, 'ease')

    const VX_FINAL = 280
    const vScaleFinal = (W - VX_FINAL - 20) / W
    const VX = Math.round(VX_FINAL * eT)
    const vScale = 1 + (vScaleFinal - 1) * eT
    const vH = Math.round(H * vScale)
    const vW = Math.round(W * vScale)
    const VY = Math.round((H - vH) / 2)

    ctx.save()
    ctx.globalAlpha = Math.min(1, eT * 1.5)
    ctx.fillStyle = '#0d1b2e'; ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
    ctx.restore()

    ctx.save()
    ctx.beginPath(); rrect(ctx, VX, VY, vW, vH, Math.round(8 * eT)); ctx.clip()
    ctx.translate(VX, VY); ctx.scale(vScale, vScale)

    if (ctxVideo.readyState >= 2) drawCtxVideo(ctx, ctxVideo, W, H, config)
    drawSlideBanner(ctx, env)

    if (runtime.adPlaying && adVideo.readyState >= 2) {
      drawRect(ctx, W, H, config)
      const { adX, adY, adW, adH } = drawAdVideo(ctx, adVideo, W, H, config)
      drawBanner(ctx, config, env.bannerImg, adX, adY, adW, adH)
      drawTimer(ctx, config, adX, adY, adW, adH, runtime.adRemaining)
    }
    drawBannerPanel(ctx, env)
    drawSlideBannerImage(ctx, env)

    ctx.restore()
    drawContextPanel(ctx, config, H, panelT)
    return
  }

  // Idle fallback (shouldn't be reached during export, but keeps it complete).
  if (ctxVideo.readyState >= 2) drawCtxVideo(ctx, ctxVideo, W, H, config)
  drawSlideBanner(ctx, env)
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
      panelAnimStartTime: 0,
    }

    const currentTimeRef = { current: 0 }
    let rafId: number | null = null
    let actx: AudioContext | null = null
    let dest: MediaStreamAudioDestinationNode | null = null

    const env: ExportEnv = {
      canvas,
      ctxVideo,
      adVideo,
      bannerImg: snapshot.bannerImg,
      slideImg: snapshot.slideImg,
      config: snapshot.config,
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

      ctxVideo.muted = false
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

      let downloadSucceeded = false
      await new Promise<void>(resolve => {
        recorder.onstop = () => {
          if (!chunks.length) {
            resolve()
            return
          }
          const blob = new Blob(chunks, { type: mime })
          const url = URL.createObjectURL(blob)
          triggerDownload(url, `ad-engine-demo.${actualFormat}`)
          setTimeout(() => URL.revokeObjectURL(url), 30000)
          downloadSucceeded = true
          resolve()
        }
        recorder.stop()
      })

      if (downloadSucceeded) {
        showToast(actualFormat === 'mp4' ? 'Demo downloaded as MP4.' : 'Demo downloaded as WebM.', { color: '#39e88f', duration: 2800 })
      } else {
        showToast('No recording data captured.', '#ef4444')
      }
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
