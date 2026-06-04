import { useState, useRef } from 'react'

interface Props {
  text: string
}

export function InfoTooltip({ text }: Props) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [visible, setVisible] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const show = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({
      top: r.bottom + 7,
      left: Math.min(r.left, window.innerWidth - 226),
    })
    setVisible(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        className="info-btn"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
      >
        i
      </button>
      {visible && (
        <div className="info-tooltip" style={{ top: pos.top, left: pos.left }}>
          {text}
        </div>
      )}
    </>
  )
}
