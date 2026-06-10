// ── Unified config for both overlay types ──────────────────────────────────

export interface AdEngineConfig {
  // Context video transform
  cvScale:  number
  cvX:      number
  cvY:      number
  cvRadius: number
  cvFit:    'fill' | 'contain' | 'stretch'

  // Rectangle backing (behind ad video)
  rectColor:   string
  rectOpacity: number
  rectX:       number
  rectY:       number
  rectW:       number
  rectH:       number
  rectRadius:  number

  // Ad video overlay
  avX:      number
  avY:      number
  avScale:  number
  avRadius: number

  // Banner image (overlaid on ad video)
  bnX:     number
  bnY:     number
  bnScale: number

  // Ad timer badge
  tmX:    number
  tmY:    number
  tmFont: number

  // Timing
  tsMin:     number        // ad trigger — minutes
  tsSec:     number        // ad trigger — seconds
  adDur:     6 | 15 | 30  // ad slot duration

  // Context tags (dynamic list)
  tags: string[]

  // Slide banner — mask region
  maskX: number
  maskY: number
  maskW: number
  maskH: number

  // Slide banner — motion
  slideAmt: number
  slideDur: number
  slideDir: 'up' | 'down' | 'left' | 'right'
  easing:   'ease' | 'linear' | 'bounce' | 'elastic'

  // Slide banner — image position within mask
  slideImgScale: number
  slideImgOffX:  number
  slideImgOffY:  number

  // Slide banner — colour panel (independent layer)
  panelColor:        string
  panelOpacity:      number
  bannerPanelX:      number
  bannerPanelY:      number
  bannerPanelW:      number
  bannerPanelH:      number
  bannerPanelRadius: number
}

// ── Runtime state (mutable, lives in a ref — never triggers re-renders) ────

export interface RuntimeState {
  // Media
  ctxUrl:    string | null
  adUrl:     string | null
  bannerImg:   HTMLImageElement | null  // overlay on ad video (Mode A banner)
  slideImg:    HTMLImageElement | null  // image in slide banner animation (Mode B)

  // Computed from config at demo start
  ctxDur:         number
  adTriggerSec:   number
  bannerTriggerSec: number
  adDur:          number
  adRemaining:    number

  // Playback flags
  adPlaying:      boolean
  adTriggered:    boolean
  bannerTriggered: boolean
  scanning:       boolean
  scanAlpha:      number
  scanLineY:      number
  scanDir:        number
  playing:        boolean

  // Infrastructure
  rafId:         number | null
  countdown:     ReturnType<typeof setInterval> | null
  recInProgress: boolean
  trimIn:        number
  trimOut:       number

  // Ad pause/resume tracking
  adStartTime:       number   // Date.now() when ad started or last resumed
  adElapsedAtPause:  number   // seconds of ad that had played when paused
}

// ── Demo state machine (drives canvas card UI) ─────────────────────────────

export type DemoState = 'idle' | 'running' | 'complete'

export type ExportFormat = 'webm' | 'mp4'

export interface AdEngineExportSnapshot {
  config: AdEngineConfig
  ctxUrl: string | null
  adUrl: string | null
  bannerImg: HTMLImageElement | null
  slideImg: HTMLImageElement | null
}

// ── Log lines (scan log) ───────────────────────────────────────────────────

export interface LogLine {
  id:   number
  ts:   string
  icon: string
  html: string
}

// ── Legacy type aliases (keep until old components are removed) ────────────

/** @deprecated use AdEngineConfig */
export type ContextualAdConfig = AdEngineConfig

/** @deprecated — single mode now, kept for App.tsx until rebuild */
export type AppMode = 'ctx' | 'slide'
