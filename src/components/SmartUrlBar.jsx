import { useState, useRef, useEffect } from 'react'
import { C } from '../constants.jsx'

export default function SmartUrlBar({ value, onChange, onPasteUrl, onSend, envVars, collectionVars, onUpdateCollectionVar }) {
  const [popover, setPopover] = useState(null)
  const [popVal,  setPopVal]  = useState('')
  const inputRef = useRef(null)

  const varNames = [...new Set([...value.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]
  const resolve  = (name) => collectionVars?.[name] ?? envVars?.[name] ?? ''

  const openPop = (name) => { setPopover(name); setPopVal(collectionVars?.[name] ?? envVars?.[name] ?? '') }
  const savePop = () => { if (popover) onUpdateCollectionVar(popover, popVal); setPopover(null) }

  // ── Paste handler ──────────────────────────────────────────────────────────
  // Only replace full URL when:
  //   1. It's a curl command, OR
  //   2. It's a full URL (starts with http) AND the input is currently empty
  // Otherwise insert at cursor position so partial paths don't overwrite
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
      // Empty bar — safe to replace with the full URL
      e.preventDefault()
      if (onPasteUrl) onPasteUrl(p)
      return
    }

    if (isFullUrl && !isEmpty) {
      // Already has content — let the browser insert at cursor position naturally
      // This allows pasting a path segment mid-URL without overwriting
      return
    }

    // Non-URL paste — let browser handle normally
  }

  // ── Scroll input to end when value changes (keeps {{var}} visible) ─────────
  // This fixes the "cursor stuck mid-string on layout change" issue.
  // We always scroll the real input to its end after each render so the
  // visible end of the URL is always in view regardless of container width.
  useEffect(() => {
    const el = inputRef.current
    if (!el || document.activeElement === el) return
    // Only scroll when not focused — don't disturb typing position
    el.scrollLeft = el.scrollWidth
  }, [value])

  // On blur always scroll to end so {{var}} is visible
  const handleBlur = () => {
    const el = inputRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }

  // Build highlighted overlay parts
  const parts = []
  let last = 0
  for (const m of value.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m.index > last) parts.push({ t: 'txt', v: value.slice(last, m.index) })
    parts.push({ t: 'var', name: m[1] })
    last = m.index + m[0].length
  }
  if (last < value.length) parts.push({ t: 'txt', v: value.slice(last) })

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSend() }}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder="https://api.example.com/...  or paste cURL"
        style={{
          width: '100%', background: '#fff', border: `1.5px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13,
          // Text is transparent when vars exist — overlay renders the coloured version
          // But the real input is still there and handles all cursor/selection/typing
          color: varNames.length ? 'transparent' : '#1a1a2e',
          outline: 'none', fontFamily: C.mono, boxSizing: 'border-box',
          caretColor: '#1a1a2e',
          // overflow hidden + no wrap so the input scrolls horizontally
          // keeping the end of the URL (where {{var}} lives) visible
          whiteSpace: 'nowrap', overflowX: 'auto',
        }}
      />

      {/* Visual overlay — mirrors input scroll position so coloured text stays in sync */}
      {varNames.length > 0 && (
        <OverlaySync inputRef={inputRef} parts={parts} resolve={resolve} openPop={openPop} value={value} />
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

// ── OverlaySync ────────────────────────────────────────────────────────────
// Syncs its scrollLeft with the real input so coloured var pills stay
// aligned with what the user sees — even after horizontal scroll
function OverlaySync({ inputRef, parts, resolve, openPop, value }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const input = inputRef.current
    const overlay = overlayRef.current
    if (!input || !overlay) return

    const sync = () => { overlay.scrollLeft = input.scrollLeft }
    input.addEventListener('scroll', sync)
    sync()
    return () => input.removeEventListener('scroll', sync)
  }, [value])

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute', inset: 0, padding: '10px 14px', fontSize: 13,
        fontFamily: C.mono, display: 'flex', alignItems: 'center',
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
                pointerEvents: 'all', cursor: 'pointer', borderRadius: 4, padding: '1px 5px',
                flexShrink: 0,
                background: resolve(p.name) ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                border: `1px solid ${resolve(p.name) ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.3)'}`,
                color: resolve(p.name) ? C.green : C.red, fontSize: 12, fontWeight: 600,
              }}
              title={resolve(p.name) ? `= ${resolve(p.name)}` : 'Click to set value'}>
              {'{{' + p.name + '}}'}
            </span>
      )}
    </div>
  )
}
