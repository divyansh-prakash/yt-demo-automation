import { useState } from 'react'
import { SidebarCard } from '../shared/SidebarCard'
import { SliderField } from '../../shared/SliderField'
import type { AdEngineConfig } from '../../../types'

const TAG_CLASSES = ['tag-c1', 'tag-c2', 'tag-c3', 'tag-c4', 'tag-c5']

interface Props {
  config: AdEngineConfig
  setConfig: (u: Partial<AdEngineConfig>) => void
}

function PosField({ label, value, usePx, min, max, onChange }: {
  label: string; value: number; usePx: boolean; min: number; max: number
  onChange: (v: number) => void
}) {
  if (usePx) {
    return (
      <div className="ctrl-field">
        <div className="ctrl-label">
          {label}
          <span className="ctrl-val">{value}px</span>
        </div>
        <input
          type="number" min={min} max={max} step={1} value={value}
          className="timing-input" style={{ width: '100%' }}
          onChange={e => onChange(Math.max(min, Math.min(max, +e.target.value || 0)))}
        />
      </div>
    )
  }
  return <SliderField label={label} value={value} min={min} max={max} unit="px" onChange={onChange} />
}

export function ContextInputCard({ config: c, setConfig }: Props) {
  const [usePx, setUsePx] = useState(false)
  const updateTag = (i: number, value: string) => {
    const tags = [...c.tags]; tags[i] = value; setConfig({ tags })
  }
  const removeTag = (i: number) => {
    setConfig({ tags: c.tags.filter((_, idx) => idx !== i) })
  }
  const addTag = () => setConfig({ tags: [...c.tags, ''] })

  const updateSemantic = (i: number, value: string) => {
    const semantics = [...c.semantics]; semantics[i] = value; setConfig({ semantics })
  }
  const removeSemantic = (i: number) => {
    setConfig({ semantics: c.semantics.filter((_, idx) => idx !== i) })
  }
  const addSemantic = () => setConfig({ semantics: [...c.semantics, ''] })

  const updateVideoTag = (i: number, value: string) => {
    const videoTags = [...c.videoTags]; videoTags[i] = value; setConfig({ videoTags })
  }
  const removeVideoTag = (i: number) => {
    setConfig({ videoTags: c.videoTags.filter((_, idx) => idx !== i) })
  }
  const addVideoTag = () => setConfig({ videoTags: [...c.videoTags, ''] })

  return (
    <SidebarCard
      icon="🏷" iconBg="#f0eeff"
      title="Context Input"
      tooltip="Labels shown in the context panel during the scan and demo. Context = entity tags (pills). Semantics = meaning labels (plain text)."
    >
      <div className="s-card-body">
        <div className="ctrl-field">
          <div className="ctrl-label">Tag entry animation</div>
          <select
            className="timing-dur"
            style={{ width: '100%' }}
            value={c.tagAnimation}
            onChange={e => setConfig({ tagAnimation: e.target.value as AdEngineConfig['tagAnimation'] })}
          >
            <option value="slide-left">Slide in from left</option>
            <option value="slide-up">Slide up</option>
            <option value="fade">Fade in</option>
            <option value="pop">Pop (scale)</option>
          </select>
        </div>

        <div className="s-divider" style={{ margin: '10px 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="s-section-label" style={{ margin: 0 }}>Positioning</div>
          <button
            className={`unit-toggle${usePx ? ' active' : ''}`}
            onClick={() => setUsePx(p => !p)}
            title="Toggle between slider and pixel input"
          >{usePx ? 'px' : 'drag'}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Context tags</div>
        <div className="ctrl-grid">
          <PosField label="X" value={c.ctxTagsOffX} usePx={usePx} min={-10} max={120} onChange={v => setConfig({ ctxTagsOffX: v })} />
          <PosField label="Y" value={c.ctxTagsOffY} usePx={usePx} min={-40} max={300} onChange={v => setConfig({ ctxTagsOffY: v })} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, marginTop: 8 }}>Semantic tags</div>
        <div className="ctrl-grid">
          <PosField label="X" value={c.semTagsOffX} usePx={usePx} min={-10} max={120} onChange={v => setConfig({ semTagsOffX: v })} />
          <PosField label="Gap" value={c.semTagsOffY} usePx={usePx} min={-100} max={200} onChange={v => setConfig({ semTagsOffY: v })} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, marginTop: 8 }}>Video tags</div>
        <div className="ctrl-grid">
          <PosField label="X" value={c.videoTagsOffX} usePx={usePx} min={-10} max={120} onChange={v => setConfig({ videoTagsOffX: v })} />
          <PosField label="Gap" value={c.videoTagsOffY} usePx={usePx} min={-100} max={200} onChange={v => setConfig({ videoTagsOffY: v })} />
        </div>

        <div className="s-divider" style={{ margin: '10px 0' }} />
        <div className="s-section-label">Context</div>
        <div className="tags-list">
          {c.tags.map((tag, i) => (
            <div key={i} className="tag-row">
              <span className={`tag-pill ${TAG_CLASSES[i % TAG_CLASSES.length]}`}>C{i + 1}</span>
              <input
                className="tag-input" type="text"
                placeholder={`Context label ${i + 1}…`}
                value={tag}
                onChange={e => updateTag(i, e.target.value)}
              />
              {c.tags.length > 1 && (
                <button className="tag-remove" onClick={() => removeTag(i)} title="Remove">×</button>
              )}
            </div>
          ))}
        </div>
        <button className="tag-add" onClick={addTag}>+ Add context tag</button>

        <div className="s-divider" style={{ margin: '10px 0' }} />

        <div className="s-section-label">Semantics</div>
        <div className="tags-list">
          {c.semantics.map((sem, i) => (
            <div key={i} className="tag-row">
              <span className={`tag-pill ${TAG_CLASSES[i % TAG_CLASSES.length]}`}>S{i + 1}</span>
              <input
                className="tag-input" type="text"
                placeholder={`Semantic label ${i + 1}…`}
                value={sem}
                onChange={e => updateSemantic(i, e.target.value)}
              />
              {c.semantics.length > 1 && (
                <button className="tag-remove" onClick={() => removeSemantic(i)} title="Remove">×</button>
              )}
            </div>
          ))}
        </div>
        <button className="tag-add" onClick={addSemantic}>+ Add semantic label</button>

        <div className="s-divider" style={{ margin: '10px 0' }} />

        <div className="s-section-label">Video tags</div>
        <div className="tags-list">
          {c.videoTags.map((vt, i) => (
            <div key={i} className="tag-row">
              <span className={`tag-pill ${TAG_CLASSES[i % TAG_CLASSES.length]}`}>V{i + 1}</span>
              <input
                className="tag-input" type="text"
                placeholder={`Video tag ${i + 1}…`}
                value={vt}
                onChange={e => updateVideoTag(i, e.target.value)}
              />
              {c.videoTags.length > 1 && (
                <button className="tag-remove" onClick={() => removeVideoTag(i)} title="Remove">×</button>
              )}
            </div>
          ))}
        </div>
        <button className="tag-add" onClick={addVideoTag}>+ Add video tag</button>
      </div>
    </SidebarCard>
  )
}
