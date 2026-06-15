import { useState, useRef, useCallback } from 'react'

export default function ResizablePanes({ top, bottom }) {
  const [topPct, setTopPct] = useState(50)
  const containerRef = useRef(null)
  const dragging = useRef(false)

  const onMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientY - rect.top) / rect.height) * 100
      setTopPct(Math.min(Math.max(pct, 15), 85))
    }

    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top pane */}
      <div style={{ height: `${topPct}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {top}
      </div>

      {/* Drag handle */}
      <div onMouseDown={onMouseDown} style={{
        height: 6, flexShrink: 0, cursor: 'row-resize',
        background: 'transparent',
        borderTop: '2px solid rgba(0,0,0,0.08)',
        borderBottom: '2px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,106,247,0.15)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div style={{ width: 40, height: 2, borderRadius: 2, background: 'rgba(0,0,0,0.15)' }} />
      </div>

      {/* Bottom pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {bottom}
      </div>
    </div>
  )
}
