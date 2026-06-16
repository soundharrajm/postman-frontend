import { useState } from 'react'
import { C } from '../constants.jsx'

export default function IdExtractor({ onClose }) {
  const [input,   setInput]   = useState('')
  const [output,  setOutput]  = useState('')
  const [copied,  setCopied]  = useState(false)
  const [format,  setFormat]  = useState('quoted') // quoted | plain | csv

  const extract = () => {
    // Match UUIDs, hex IDs, alphanumeric IDs (min 6 chars)
    const patterns = [
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, // UUID
      /\b[0-9a-f]{24}\b/gi,   // MongoDB ObjectId
      /\b[0-9a-f]{16}\b/gi,   // hex 16
      /\b[A-Z0-9_-]{6,}\b/g,  // uppercase IDs like content IDs
    ]

    const found = new Set()
    for (const pattern of patterns) {
      const matches = input.match(pattern) || []
      matches.forEach(m => found.add(m))
    }

    if (!found.size) { setOutput('No IDs found'); return }

    const ids = [...found]
    let result = ''

    if (format === 'quoted') {
      result = ids.map((id, i) =>
        `"${id}"${i < ids.length - 1 ? ',' : ''}`
      ).join('\n')
    } else if (format === 'plain') {
      result = ids.join('\n')
    } else if (format === 'csv') {
      result = ids.map((id, i) =>
        `"${id}"${i < ids.length - 1 ? ',' : ''}`
      ).join(' ')
    }

    setOutput(result)
  }

  const copy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 5000)
  }

  const fmtBtn = (f, label) => ({
    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    border:      format === f ? `1.5px solid ${C.pu}` : `1px solid ${C.border}`,
    background:  format === f ? 'rgba(124,106,247,0.08)' : '#fff',
    color:       format === f ? C.pu : '#64748b',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, width: 580, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,106,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔑</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>ID Extractor</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Paste content → extract IDs as quoted list</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
          {/* Input */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}` }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Input — paste anything
            </div>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={'Paste JSON, CSV, text, URLs...\n\nExample:\n{"id":"abc-123","name":"test"}\nid: xyz-456\nhttps://api.com/items/def-789'}
              style={{ flex: 1, border: 'none', outline: 'none', padding: 14, fontSize: 12, fontFamily: C.mono, resize: 'none', color: '#1a1a2e', lineHeight: 1.6, background: '#fafafa' }}
            />
          </div>

          {/* Output */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>Output</span>
              {output && output !== 'No IDs found' && (
                <button onClick={copy} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', border: copied ? '1px solid rgba(22,163,74,0.3)' : `1px solid ${C.border}`, background: copied ? 'rgba(22,163,74,0.06)' : '#fff', color: copied ? C.green : '#64748b' }}>
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              )}
            </div>
            <pre style={{ flex: 1, margin: 0, padding: 14, fontSize: 12, fontFamily: C.mono, color: output === 'No IDs found' ? '#94a3b8' : '#1a1a2e', lineHeight: 1.8, overflowY: 'auto', whiteSpace: 'pre-wrap', background: '#fff' }}>
              {output || 'IDs will appear here...'}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Format:</span>
          <button onClick={() => setFormat('quoted')} style={fmtBtn('quoted', 'Quoted lines')}>Quoted lines</button>
          <button onClick={() => setFormat('plain')}  style={fmtBtn('plain',  'Plain lines')}>Plain lines</button>
          <button onClick={() => setFormat('csv')}    style={fmtBtn('csv',    'Inline CSV')}>Inline CSV</button>
          <div style={{ flex: 1 }} />
          <button onClick={extract} style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.pu, color: '#fff' }}>
            Extract IDs
          </button>
        </div>
      </div>
    </div>
  )
}
