import { useState, useEffect } from 'react'
import { C, SC } from '../constants.js'
import { getApiUrl } from '../utils/helpers.js'

function CodeGen({ req }) {
  const [lang,   setLang]   = useState('fetch')
  const [code,   setCode]   = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!req) return
    fetch(getApiUrl() + '/codegen', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...req, language: lang }),
    }).then(r => r.json()).then(d => setCode(d.code)).catch(() => setCode('// Backend not reachable'))
  }, [lang, req])

  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const tab = (t) => ({ padding: '4px 11px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: lang === t ? `1.5px solid ${C.pu}` : `1px solid ${C.border}`, background: lang === t ? 'rgba(124,106,247,0.08)' : '#fff', color: lang === t ? C.pu : '#64748b' })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, alignItems: 'center' }}>
        {['fetch', 'axios', 'curl', 'python'].map(l => <button key={l} onClick={() => setLang(l)} style={tab(l)}>{l}</button>)}
        <button onClick={copy} style={{ marginLeft: 'auto', padding: '4px 11px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: '#fff', color: copied ? C.green : '#64748b' }}>{copied ? '✓ Copied' : '📋 Copy'}</button>
      </div>
      <pre style={{ flex: 1, margin: 0, padding: 16, overflowY: 'auto', fontSize: 12, fontFamily: C.mono, color: '#1a1a2e', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8f8fc' }}>{code || '// Select a language'}</pre>
    </div>
  )
}

export default function ResponseViewer({ response, loading, elapsed }) {
  const [tab,  setTab]  = useState('body')
  const [view, setView] = useState('pretty')

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: `3px solid rgba(124,106,247,0.2)`, borderTop: `3px solid ${C.pu}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#94a3b8' }}>Sending…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!response) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#cbd5e1' }}>
      <div style={{ fontSize: 44 }}>⚡</div>
      <p style={{ fontSize: 13, margin: 0 }}>Send a request to see the response</p>
    </div>
  )

  const sc   = SC(response.status)
  const hdrs = Object.entries(response.headers || {})
  let pretty = response.body
  try { pretty = JSON.stringify(JSON.parse(response.body), null, 2) } catch {}

  const tabBtn = (t, label) => ({
    padding: '5px 13px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border:     tab === t ? `1.5px solid ${C.pu}` : `1px solid ${C.border}`,
    background: tab === t ? 'rgba(124,106,247,0.08)' : '#fff',
    color:      tab === t ? C.pu : '#64748b',
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: '#f8f8fc', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: sc, background: sc + '15', border: `1px solid ${sc}35`, borderRadius: 6, padding: '3px 10px', fontFamily: C.mono }}>{response.status} {response.statusText}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{elapsed}ms</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{response.size}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[['body', 'Body'], ['headers', `Headers (${hdrs.length})`], ['cookies', 'Cookies'], ['code', 'Code']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(t, label)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      {tab === 'body' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, padding: '7px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, alignItems: 'center' }}>
            {['pretty', 'raw', 'preview'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: view === v ? `1.5px solid ${C.pu}` : `1px solid ${C.border}`, background: view === v ? 'rgba(124,106,247,0.06)' : '#fff', color: view === v ? C.pu : '#64748b' }}>{v}</button>
            ))}
            <button onClick={() => navigator.clipboard.writeText(response.body)} style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: '#fff', color: '#64748b' }}>📋 Copy</button>
          </div>
          {view === 'preview'
            ? <iframe srcDoc={response.body} style={{ flex: 1, border: 'none', background: '#fff' }} />
            : <pre style={{ flex: 1, margin: 0, padding: 16, overflowY: 'auto', fontSize: 12, fontFamily: C.mono, color: '#1a1a2e', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#f8f8fc' }}>{view === 'pretty' ? pretty : response.body}</pre>
          }
        </div>
      )}

      {/* Headers */}
      {tab === 'headers' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {hdrs.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ flex: 1, fontSize: 12, color: C.pu, fontFamily: C.mono, fontWeight: 600 }}>{k}</span>
              <span style={{ flex: 2, fontSize: 12, color: '#475569', fontFamily: C.mono, wordBreak: 'break-all' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cookies */}
      {tab === 'cookies' && (
        <div style={{ flex: 1, padding: 16, fontSize: 12, color: '#94a3b8' }}>
          {(response.cookies || []).length === 0 ? 'No cookies' : (response.cookies || []).map((c, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontFamily: C.mono, color: '#475569' }}>{c}</div>
          ))}
        </div>
      )}

      {/* Code */}
      {tab === 'code' && <CodeGen req={response._req} />}
    </div>
  )
}
