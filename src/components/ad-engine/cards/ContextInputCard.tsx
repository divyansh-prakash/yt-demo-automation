import { SidebarCard } from '../shared/SidebarCard'
import type { AdEngineConfig } from '../../../types'

const TAG_CLASSES = ['tag-c1', 'tag-c2', 'tag-c3', 'tag-c4', 'tag-c5']

interface Props {
  config: AdEngineConfig
  setConfig: (u: Partial<AdEngineConfig>) => void
}

export function ContextInputCard({ config: c, setConfig }: Props) {
  const updateTag = (i: number, value: string) => {
    const tags = [...c.tags]
    tags[i] = value
    setConfig({ tags })
  }

  const removeTag = (i: number) => {
    setConfig({ tags: c.tags.filter((_, idx) => idx !== i) })
  }

  const addTag = () => {
    setConfig({ tags: [...c.tags, ''] })
  }

  return (
    <SidebarCard
      icon="🏷" iconBg="#f0eeff"
      title="Context Input"
      tooltip="Labels describing what the video is about. The AI scan simulation uses these to show contextual ad matching."
    >
      <div className="s-card-body">
        <div className="tags-list">
          {c.tags.map((tag, i) => (
            <div key={i} className="tag-row">
              <span className={`tag-pill ${TAG_CLASSES[i % TAG_CLASSES.length]}`}>
                C{i + 1}
              </span>
              <input
                className="tag-input"
                type="text"
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
        <button className="tag-add" onClick={addTag}>
          + Add context tag
        </button>
      </div>
    </SidebarCard>
  )
}
