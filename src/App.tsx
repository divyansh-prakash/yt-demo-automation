import { useState, useCallback } from 'react'
import { Toaster } from 'sonner'
import { Header }           from './components/Header'
import { AdEngineDemo }     from './components/ad-engine/AdEngineDemo'
import { ConfirmModal }     from './components/shared/ConfirmModal'
import { NameModal }        from './components/shared/NameModal'
import { useTheme }         from './hooks/useTheme'
import { useConfigs }       from './hooks/useConfigs'
import { showToast } from './lib/toast'
import type { AdEngineConfig } from './types'
import './styles/tokens.css'
import './styles/app.css'

interface ModalState {
  message: string
  description: string
  confirmLabel: string
  onConfirm: () => void
}

interface NameModalState {
  message: string
  placeholder?: string
  confirmLabel: string
  onConfirm: (name: string) => void
}

function App() {
  const { theme, toggle } = useTheme()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [nameModal, setNameModal] = useState<NameModalState | null>(null)

  const [presetToLoad, setPresetToLoad] = useState<{ config: AdEngineConfig } | undefined>()

  const handleLoadPreset = useCallback((config: AdEngineConfig) => {
    setPresetToLoad({ config })
  }, [])

  const { configs, activeId, setActive, saveConfig, addConfig } = useConfigs(handleLoadPreset)

  const showModal = useCallback((state: ModalState) => setModal(state), [])
  const closeModal = useCallback(() => setModal(null), [])
  const closeNameModal = useCallback(() => setNameModal(null), [])

  const activeConfig = configs.find(c => c.id === activeId)

  const handleUpdate = useCallback((config: AdEngineConfig) => {
    if (!activeConfig) return
    showModal({
      message: `Update "${activeConfig.name}"?`,
      description: 'This will overwrite the currently saved version of this config.',
      confirmLabel: 'Update',
      onConfirm: async () => {
        const result = await saveConfig(config, activeConfig.name)
        if (result === 'duplicate') {
          showToast('Could not update — name conflict.', { color: '#ef4444', duration: 3000 })
        } else {
          showToast(`"${activeConfig.name}" updated.`, { color: '#39e88f', duration: 2600 })
        }
      },
    })
  }, [activeConfig, saveConfig, showModal])

  const handleSaveAsNew = useCallback((config: AdEngineConfig) => {
    setNameModal({
      message: 'Save as new config',
      placeholder: 'Config name',
      confirmLabel: 'Save',
      onConfirm: async (name) => {
        const result = await addConfig(config, name)
        if (result === 'duplicate') {
          showToast('A config with this name already exists.', { color: '#ef4444', duration: 3000 })
        } else {
          showToast(`"${name}" created.`, { color: '#39e88f', duration: 2600 })
        }
      },
    })
  }, [addConfig])

  const handleSelectConfig = useCallback((id: string) => {
    if (id === activeId) return
    const target = configs.find(c => c.id === id)
    if (!target) return

    showModal({
      message: `Switch to "${target.name}"?`,
      description: 'Your current layout settings will be replaced with the saved version of this config.',
      confirmLabel: 'Switch',
      onConfirm: () => setActive(id),
    })
  }, [configs, activeId, setActive, showModal])

  return (
    <div className="app-layout">
      <Toaster position="top-right" richColors />

      {modal && (
        <ConfirmModal
          message={modal.message}
          description={modal.description}
          confirmLabel={modal.confirmLabel}
          onConfirm={modal.onConfirm}
          onCancel={closeModal}
        />
      )}

      {nameModal && (
        <NameModal
          message={nameModal.message}
          placeholder={nameModal.placeholder}
          confirmLabel={nameModal.confirmLabel}
          onConfirm={nameModal.onConfirm}
          onCancel={closeNameModal}
        />
      )}

      <Header
        theme={theme}
        onToggleTheme={toggle}
        configs={configs}
        activeId={activeId}
        onSelectConfig={handleSelectConfig}
      />

      <AdEngineDemo
        showToast={showToast}
        activeConfigName={activeConfig?.name}
        onUpdate={handleUpdate}
        onSaveAsNew={handleSaveAsNew}
        presetToLoad={presetToLoad}
      />
    </div>
  )
}

export default App
