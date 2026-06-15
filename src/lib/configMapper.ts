import type { AdEngineConfig } from '../types'
import { DEFAULT_CONFIG } from '../hooks/useAdEngine'

// Nested shape stored on the BE — mirrors config-server/src/types.ts
export interface StoredConfig {
  id: string
  name: string
  created_at: string
  updated_at: string
  context_video:   { scale: number; x: number; y: number; radius: number; fit: 'fill' | 'contain' | 'stretch' }
  background_rect: { color: string; opacity: number; x: number; y: number; width: number; height: number; radius: number }
  ad_overlay:      { x: number; y: number; scale: number; radius: number }
  banner_image:    { x: number; y: number; scale: number }
  timer:           { x: number; y: number; font_size: number }
  timing:          { trigger_min: number; trigger_sec: number; ad_duration: 6 | 15 | 30 }
  context_panel:   { animation: 'fade' | 'slide-left' | 'slide-up' | 'pop'; ctx_offset: { x: number; y: number }; sem_offset: { x: number; y: number }; video_offset: { x: number; y: number } }
  slide_banner: {
    mask:   { x: number; y: number; width: number; height: number }
    motion: { amount: number; duration: number; direction: 'up' | 'down' | 'left' | 'right'; easing: 'ease' | 'linear' | 'bounce' | 'elastic' }
    image:  { scale: number; offset_x: number; offset_y: number }
    panel:  { color: string; opacity: number; x: number; y: number; width: number; height: number; radius: number }
  }
}

export function toStoredConfig(config: AdEngineConfig, name: string): Omit<StoredConfig, 'id' | 'created_at' | 'updated_at'> {
  return {
    name,
    context_video:   { scale: config.cvScale, x: config.cvX, y: config.cvY, radius: config.cvRadius, fit: config.cvFit },
    background_rect: { color: config.rectColor, opacity: config.rectOpacity, x: config.rectX, y: config.rectY, width: config.rectW, height: config.rectH, radius: config.rectRadius },
    ad_overlay:      { x: config.avX, y: config.avY, scale: config.avScale, radius: config.avRadius },
    banner_image:    { x: config.bnX, y: config.bnY, scale: config.bnScale },
    timer:           { x: config.tmX, y: config.tmY, font_size: config.tmFont },
    timing:          { trigger_min: config.tsMin, trigger_sec: config.tsSec, ad_duration: config.adDur },
    context_panel:   { animation: config.tagAnimation, ctx_offset: { x: config.ctxTagsOffX, y: config.ctxTagsOffY }, sem_offset: { x: config.semTagsOffX, y: config.semTagsOffY }, video_offset: { x: config.videoTagsOffX, y: config.videoTagsOffY } },
    slide_banner: {
      mask:   { x: config.maskX, y: config.maskY, width: config.maskW, height: config.maskH },
      motion: { amount: config.slideAmt, duration: config.slideDur, direction: config.slideDir, easing: config.easing },
      image:  { scale: config.slideImgScale, offset_x: config.slideImgOffX, offset_y: config.slideImgOffY },
      panel:  { color: config.panelColor, opacity: config.panelOpacity, x: config.bannerPanelX, y: config.bannerPanelY, width: config.bannerPanelW, height: config.bannerPanelH, radius: config.bannerPanelRadius },
    },
  }
}

export function fromStoredConfig(stored: StoredConfig): AdEngineConfig {
  const cv = stored.context_video
  const br = stored.background_rect
  const av = stored.ad_overlay
  const bi = stored.banner_image
  const tm = stored.timer
  const ti = stored.timing
  const cp = stored.context_panel
  const sb = stored.slide_banner

  return {
    // tags/semantics/videoTags are transient UI state — seed from defaults
    tags:      DEFAULT_CONFIG.tags,
    semantics: DEFAULT_CONFIG.semantics,
    videoTags: DEFAULT_CONFIG.videoTags,

    cvScale: cv.scale, cvX: cv.x, cvY: cv.y, cvRadius: cv.radius, cvFit: cv.fit,
    rectColor: br.color, rectOpacity: br.opacity, rectX: br.x, rectY: br.y, rectW: br.width, rectH: br.height, rectRadius: br.radius,
    avX: av.x, avY: av.y, avScale: av.scale, avRadius: av.radius,
    bnX: bi.x, bnY: bi.y, bnScale: bi.scale,
    tmX: tm.x, tmY: tm.y, tmFont: tm.font_size,
    tsMin: ti.trigger_min, tsSec: ti.trigger_sec, adDur: ti.ad_duration,
    tagAnimation: cp.animation, ctxTagsOffX: cp.ctx_offset.x, ctxTagsOffY: cp.ctx_offset.y, semTagsOffX: cp.sem_offset.x, semTagsOffY: cp.sem_offset.y, videoTagsOffX: cp.video_offset.x, videoTagsOffY: cp.video_offset.y,
    maskX: sb.mask.x, maskY: sb.mask.y, maskW: sb.mask.width, maskH: sb.mask.height,
    slideAmt: sb.motion.amount, slideDur: sb.motion.duration, slideDir: sb.motion.direction, easing: sb.motion.easing,
    slideImgScale: sb.image.scale, slideImgOffX: sb.image.offset_x, slideImgOffY: sb.image.offset_y,
    panelColor: sb.panel.color, panelOpacity: sb.panel.opacity, bannerPanelX: sb.panel.x, bannerPanelY: sb.panel.y, bannerPanelW: sb.panel.width, bannerPanelH: sb.panel.height, bannerPanelRadius: sb.panel.radius,
  }
}
