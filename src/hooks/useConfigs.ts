import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { toStoredConfig, fromStoredConfig } from '../lib/configMapper'
import type { StoredConfig } from '../lib/configMapper'
import type { AdEngineConfig } from '../types'

export type { StoredConfig }

export function useConfigs(onLoad: (config: AdEngineConfig) => void) {
  const [configs, setConfigs]   = useState<StoredConfig[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [loading, setLoading]   = useState(true)

  // On mount: fetch all configs + session, apply active config
  useEffect(() => {
    async function init() {
      try {
        const [allConfigs, session] = await Promise.all([api.configs.list(), api.session.get()])
        setConfigs(allConfigs)

        const resolved = allConfigs.find(c => c.id === session.active_config_id) ?? allConfigs[0]
        if (resolved) {
          setActiveId(resolved.id)
          onLoad(fromStoredConfig(resolved))
        }
      } catch (err) {
        console.error('Failed to load configs', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setActive = useCallback((id: string) => {
    const config = configs.find(c => c.id === id)
    if (!config) return
    setActiveId(id)
    onLoad(fromStoredConfig(config))
    api.session.set(id).catch(console.error)
  }, [configs, onLoad])

  // Save current config — updates existing if activeId matches, otherwise creates new
  const saveConfig = useCallback(async (config: AdEngineConfig, name: string): Promise<'ok' | 'duplicate'> => {
    const existing = configs.find(c => c.id === activeId)
    try {
      if (existing) {
        const updated = await api.configs.update(existing.id, toStoredConfig(config, name))
        setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c))
      } else {
        const created = await api.configs.create(toStoredConfig(config, name))
        setConfigs(prev => [...prev, created])
        setActiveId(created.id)
        api.session.set(created.id).catch(console.error)
      }
      return 'ok'
    } catch (err) {
      if ((err as Error & { status?: number }).status === 409) return 'duplicate'
      throw err
    }
  }, [configs, activeId])

  // Add a new config from current state (+ button)
  const addConfig = useCallback(async (config: AdEngineConfig, name: string): Promise<'ok' | 'duplicate'> => {
    try {
      const created = await api.configs.create(toStoredConfig(config, name))
      setConfigs(prev => [...prev, created])
      setActiveId(created.id)
      onLoad(fromStoredConfig(created))
      api.session.set(created.id).catch(console.error)
      return 'ok'
    } catch (err) {
      if ((err as Error & { status?: number }).status === 409) return 'duplicate'
      throw err
    }
  }, [onLoad])

  const deleteConfig = useCallback(async (id: string) => {
    await api.configs.delete(id)
    setConfigs(prev => {
      const next = prev.filter(c => c.id !== id)
      if (id === activeId && next.length > 0) {
        setActiveId(next[0].id)
        onLoad(fromStoredConfig(next[0]))
        api.session.set(next[0].id).catch(console.error)
      }
      return next
    })
  }, [activeId, onLoad])

  return { configs, activeId, loading, setActive, saveConfig, addConfig, deleteConfig }
}
