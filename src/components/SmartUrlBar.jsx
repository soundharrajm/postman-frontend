import { useState, useRef, useEffect } from 'react'
import { C } from '../constants.jsx'

export default function SmartUrlBar({ value, onChange, onPasteUrl, onSend, envVars, collectionVars, onUpdateCollectionVar }) {
  const [popover,  setPopover]  = useState(null)
  const [popVal,   setPopVal]   = useState('')
  const [focused,  setFocused]  = useState(false)
  const inputRef  = useRef(null)
  const overlayRef = useRef(null)

  const varNames = [...new Set([...value.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]
  const resolve  = (name) => collectionVars?.[name] ?? envVars?.[name] ?? ''

  const openPop = (name) => { setPopover(name); setPopVal(collectionVars?.[name] ?? envVars?.[name] ?? '') }
  const savePop = () => { if (popover) onUpdateCollectionVar(popover, popVal); setPopover(null) }

  // Build overlay parts
  const parts = []
  let last = 0
  for (const m of value.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m.index > last) parts.push({ t: 'txt', v: value.slice(last, m.index) })
    parts.push({ t: 'var', name: m[1] })
    last = m.index + m[0].length
  }
  if (last < value.length) parts.push({ t: 'txt', v: value.slice(last) })

  // Sync overlay scroll with input scroll
  useEffect(() => {
    const input   = inputRef.current
    const overlay = overlayRef.current
    if (!input || !overlay) return
    const sync = () => { overlay.scrollLeft = input.scrollLeft }
    input.addEventListener('scroll', sync)
    sync()
    return () => input.removeEventListener('scroll', sync)
  }, [value])

  // Scroll input to end when not focused so {{var}} stays visible
  useEffect(() => {
    const el = inputRef.current
    if (!el || focused) return
    el.scrollLeft = el.scrollWidth
  }, [value, focused])

  const handleBlur = () => {
    setFocused(false)
    const el = inputRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }

  // Paste: only replace full URL when input is empty, else insert at cursor
  const handlePaste = (e) => {
    const p = e.clipboardData.getData('text').trim()
    const isCurl    = p.startsWith('curl')
    const isFullUrl = p.startsWith('http')
    const isEmpty   = !value.trim()

    if (isCurl) {
      e.preventDefault()
      if (onPasteUrl) onPasteUrl(p)
      return
    }
    if (isFullUrl && isEmpty) {
      e.preventDefault()
      if (onPasteUrl) onPasteUrl(p)
      return
    }
    // Has content — let browser insert at cursor (no overwrite)
  }

  const hasVars = varNames.length > 0

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSend() }}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder="https://api.example.com/...  or paste cURL"
        style={{
          width: '100%',
          background: '#fff',
          border: `1.5px solid ${C.border}`,
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 13,
          fontFamily: C.mono,
          boxSizing: 'border-box',
          outline: 'none',
          whiteSpace: 'nowrap',
          overflowX: 'auto',
          // When focused: show real text so cursor blink is visible
          // When blurred with vars: hide text so overlay colours show
          color: (hasVars && !focused) ? 'transparent' : '#1a1a2e',
          caretColor: '#1a1a2e',
        }}
      />

      {/* Colour overlay — only show when NOT focused so it doesn't hide cursor */}
      {hasVars && !focused && (
        <div
          ref={overlayRef}
          style={{
            position: 'absolute', inset: 0,
            padding: '10px 14px',
            fontSize: 13, fontFamily: C.mono,
            display: 'flex', alignItems: 'center',
            overflow: 'hidden', pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {parts.map((p, i) =>
            p.t === 'txt'
              ? <span key={i} style={{ color: '#1a1a2e', whiteSpace: 'pre', flexShrink: 0 }}>{p.v}</span>
              : <span key={i}
                  onClick={e => { e.stopPropagation(); inputRef.current?.focus(); openPop(p.name) }}
                  style={{
                    pointerEvents: 'all', cursor: 'pointer',
                    borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                    background: resolve(p.name) ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                    border: `1px solid ${resolve(p.name) ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.3)'}`,
                    color: resolve(p.name) ? C.green : C.red,
                    fontSize: 12, fontWeight: 600,
                  }}
                  title={resolve(p.name) ? `= ${resolve(p.name)}` : 'Click to set value'}>
                  {'{{' + p.name + '}}'}
                </span>
          )}
        </div>
      )}

      {/* Var edit popover */}
      {popover && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 300, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 14, width: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.pu, fontFamily: C.mono }}>{'{{' + popover + '}}'}</span>
            <button onClick={() => setPopover(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <input autoFocus value={popVal} onChange={e => setPopVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') savePop(); if (e.key === 'Escape') setPopover(null) }}
            placeholder={`Value for ${popover}`}
            style={{ width: '100%', background: '#f8f8fc', border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#1a1a2e', outline: 'none', fontFamily: C.mono, boxSizing: 'border-box', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={savePop} style={{ flex: 1, padding: '7px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.pu, color: '#fff' }}>Save</button>
            <button onClick={() => setPopover(null)} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: 'none', color: '#64748b' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
