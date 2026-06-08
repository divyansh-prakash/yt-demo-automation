import { useState, useCallback, useEffect } from 'react'
import type { AdEngineConfig } from '../types'
import { DEFAULT_CONFIG } from './useAdEngine'

export interface Preset {
  id:        string
  name:      string
  config:    AdEngineConfig
  createdAt: number
}

const STORAGE_KEY = 'ae-presets'
const ACTIVE_KEY  = 'ae-active-preset'

function load(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function save(presets: Preset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function usePresets(onLoad: (config: AdEngineConfig) => void) {
  const [presets, setPresets] = useState<Preset[]>(() => {
    const stored = load()
    // Seed a default preset if none exist
    if (stored.length === 0) {
      const seed: Preset = {
        id: generateId(), name: 'Config 1',
        config: DEFAULT_CONFIG, createdAt: Date.now(),
      }
      save([seed])
      return [seed]
    }
    return stored
  })

  const [activeId, setActiveId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_KEY) || presets[0]?.id || ''
  })

  // On mount: apply the stored active preset so config is restored after refresh
  useEffect(() => {
    const stored = load()
    const id = localStorage.getItem(ACTIVE_KEY) || stored[0]?.id
    const active = stored.find(p => p.id === id)
    if (active) onLoad(active.config)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setActive = useCallback((id: string) => {
    setActiveId(id)
    localStorage.setItem(ACTIVE_KEY, id)
    const p = load().find(p => p.id === id)
    if (p) onLoad(p.config)
  }, [onLoad])

  const saveActive = useCallback((config: AdEngineConfig, name?: string) => {
    // Strip only the fields we do not want shared across saved presets.
    // Timing controls are part of the preset and should persist.
    const persistent: AdEngineConfig = {
      ...config,
      tags:      DEFAULT_CONFIG.tags,
    }
    setPresets(prev => {
      const idx = prev.findIndex(p => p.id === activeId)
      let next: Preset[]
      if (idx >= 0) {
        next = prev.map((p, i) => i === idx ? { ...p, config: persistent, name: name ?? p.name } : p)
      } else {
        const newPreset: Preset = { id: generateId(), name: name ?? `Config ${prev.length + 1}`, config: persistent, createdAt: Date.now() }
        next = [...prev, newPreset]
        setActiveId(newPreset.id)
        localStorage.setItem(ACTIVE_KEY, newPreset.id)
      }
      save(next)
      return next
    })
  }, [activeId])

  const addPreset = useCallback((config: AdEngineConfig) => {
    const newPreset: Preset = {
      id: generateId(),
      name: `Config ${load().length + 1}`,
      config, createdAt: Date.now(),
    }
    setPresets(prev => {
      const next = [...prev, newPreset]
      save(next)
      return next
    })
    setActiveId(newPreset.id)
    localStorage.setItem(ACTIVE_KEY, newPreset.id)
  }, [])

  const renamePreset = useCallback((id: string, name: string) => {
    setPresets(prev => {
      const next = prev.map(p => p.id === id ? { ...p, name } : p)
      save(next)
      return next
    })
  }, [])

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length === 0) {
        const seed: Preset = { id: generateId(), name: 'Config 1', config: DEFAULT_CONFIG, createdAt: Date.now() }
        save([seed])
        setActiveId(seed.id)
        localStorage.setItem(ACTIVE_KEY, seed.id)
        return [seed]
      }
      save(next)
      if (id === activeId) {
        setActiveId(next[0].id)
        localStorage.setItem(ACTIVE_KEY, next[0].id)
        onLoad(next[0].config)
      }
      return next
    })
  }, [activeId, onLoad])

  return { presets, activeId, setActive, saveActive, addPreset, renamePreset, deletePreset }
}
