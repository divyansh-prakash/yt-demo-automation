import { useState, useCallback } from 'react'
import { Toast, useToast }  from './components/shared/Toast'
import { Header }           from './components/Header'
import { AdEngineDemo }     from './components/ad-engine/AdEngineDemo'
import { useTheme }         from './hooks/useTheme'
import { usePresets }       from './hooks/usePresets'
import type { AdEngineConfig } from './types'
import './styles/tokens.css'
import './styles/app.css'

function App() {
  const { theme, toggle }         = useTheme()
  const { toastState, showToast } = useToast()

  // Wrap the loaded config in an object so the same config can be reloaded
  // (new object reference always triggers AdEngineDemo's useEffect)
  const [presetToLoad, setPresetToLoad] = useState<{ config: AdEngineConfig } | undefined>()

  const handleLoadPreset = useCallback((config: AdEngineConfig) => {
    setPresetToLoad({ config })
  }, [])

  const { presets, activeId, setActive, saveActive, addPreset } = usePresets(handleLoadPreset)

  const handleSave = useCallback((config: AdEngineConfig) => {
    saveActive(config)
    showToast('Config saved successfully.', { color: '#39e88f', duration: 2600 })
  }, [saveActive, showToast])

  const handleSelectPreset = useCallback((id: string) => {
    setActive(id)
    // setActive calls handleLoadPreset internally via usePresets
  }, [setActive])

  return (
    <div className="app-layout">
      <Toast {...toastState} />

      <Header
        theme={theme}
        onToggleTheme={toggle}
        presets={presets}
        activeId={activeId}
        onSelectPreset={handleSelectPreset}
        onAddPreset={() => addPreset(presets.find(p => p.id === activeId)?.config ?? presets[0].config)}
      />

      <AdEngineDemo
        showToast={showToast}
        onSave={handleSave}
        presetToLoad={presetToLoad}
      />
    </div>
  )
}

export default App
