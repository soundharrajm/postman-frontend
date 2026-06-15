import { useState } from 'react'
import { C, MC, METHODS } from '../constants.jsx'
import { parseCurl, buildCurl } from '../utils/helpers.js'
import KeyValueEditor from './KeyValueEditor.jsx'
import AuthEditor     from './AuthEditor.jsx'
import SmartUrlBar    from './SmartUrlBar.jsx'

export default function RequestEditor({ request, onUpdate, onSend, loading, envVars, collectionVars, onUpdateCollectionVar, onOpenCsvRunner }) {
  const [tab, setTab] = useState('params')
  const [copied, setCopied] = useState(false)
  const mc = MC[request.method] || MC.GET

  const resolve = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => collectionVars?.[k] ?? envVars[k] ?? `{{${k}}}`)

  const urlWithParams = () => {
    const en = (request.params || []).filter(p => p.enabled && p.key)
    if (!en.length) return resolve(request.url)
    // Merge: URL params + Params tab, deduplicate by key (Params tab wins)
    let base = resolve(request.url)
    try {
      const u = new URL(base)
      // Remove keys that exist in Params tab to avoid duplicates
      const tabKeys = en.map(p => p.key)
      tabKeys.forEach(k => u.searchParams.delete(k))
      // Add Params tab values
      en.forEach(p => u.searchParams.append(p.key, resolve(p.value)))
      return u.toString()
    } catch {}
    // Fallback for non-parseable URLs
    const qs = en.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(resolve(p.value))}`).join('&')
    return `${base}${base.includes('?') ? '&' : '?'}${qs}`
  }

  const tabBtn = (t, label) => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border:      tab === t ? `1.5px solid ${C.pu}` : `1px solid ${C.border}`,
    background:  tab === t ? 'rgba(124,106,247,0.08)' : '#fff',
    color:       tab === t ? C.pu : '#64748b',
  })

  const copyAsCurl = () => {
    const curl = buildCurl(request, urlWithParams())
    navigator.clipboard.writeText(curl)
    setCopied(true)
    setTimeout(() => setCopied(false), 5000)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Request name */}
      <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
        <input value={request.name} onChange={e => onUpdate({ ...request, name: e.target.value })}
          style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontWeight: 600, color: '#1a1a2e', fontFamily: 'inherit', width: '100%' }} />
      </div>

      {/* URL bar */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', flexShrink: 0 }}>
        <select value={request.method} onChange={e => onUpdate({ ...request, method: e.target.value })}
          style={{ background: mc.bg, border: `1.5px solid ${mc.border}`, borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 700, color: mc.text, cursor: 'pointer', outline: 'none', fontFamily: C.mono }}>
          {METHODS.map(m => <option key={m} value={m} style={{ background: '#fff', color: '#1a1a2e' }}>{m}</option>)}
        </select>

        <SmartUrlBar
          value={request.url}
          onChange={url => onUpdate({ ...request, url })}
          onPasteUrl={url => {
            if (url.trimStart?.().startsWith('curl')) {
              try { const c = parseCurl(url); onUpdate({ ...request, method: c.method, url: c.url, headers: c.headers.length ? c.headers : request.headers, body: c.body || request.body, bodyType: c.body ? 'json' : request.bodyType }); return } catch {}
            }
            // Auto-parse query params only on paste
            try {
              const u = new URL(url)
              if (u.search) {
                const newParams = []
                u.searchParams.forEach((v, k) => newParams.push({ id: Math.random().toString(36).slice(2), key: k, value: v, enabled: true }))
                if (newParams.length) {
                  const baseUrl = u.origin + u.pathname
                  const existingNonEmpty = (request.params || []).filter(p => p.key && !newParams.find(np => np.key === p.key))
                  onUpdate({ ...request, url: baseUrl, params: [...newParams, ...existingNonEmpty, { id: Math.random().toString(36).slice(2), key: '', value: '', enabled: true }] })
                  return
                }
              }
            } catch {}
            onUpdate({ ...request, url })
          }}
          onSend={() => onSend(urlWithParams())}
          envVars={envVars}
          collectionVars={collectionVars}
          onUpdateCollectionVar={onUpdateCollectionVar}
        />

        <button onClick={() => onSend(urlWithParams())} disabled={loading || !request.url.trim()}
          style={{ padding: '10px 28px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading || !request.url.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: 'none', background: loading || !request.url.trim() ? 'rgba(124,106,247,0.3)' : C.pu, color: '#fff', flexShrink: 0 }}>
          {loading ? '⏳' : 'Send'}
        </button>

        <button onClick={copyAsCurl} title="Copy as cURL"
          style={{ padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${copied ? 'rgba(22,163,74,0.3)' : C.border}`, background: copied ? 'rgba(22,163,74,0.06)' : '#f8f8fc', color: copied ? C.green : '#64748b', flexShrink: 0, transition: 'all .2s' }}>
          {copied ? '✓ Copied' : '📋 cURL'}
        </button>

        <button onClick={onOpenCsvRunner}
          style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${C.pu}`, background: 'rgba(124,106,247,0.06)', color: C.pu, flexShrink: 0 }}>
          📊 CSV Run
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '4px 16px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[
          { key: 'params',  label: 'Params',  count: request.params.filter(p=>p.enabled&&p.key).length },
          { key: 'headers', label: 'Headers', count: request.headers.filter(h=>h.enabled&&h.key).length },
          { key: 'body',    label: 'Body',    count: 0 },
          { key: 'auth',    label: 'Auth',    count: request.auth.type !== 'none' ? 1 : 0 },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)} style={tabBtn(key, label)}>
            {label}
            {count > 0 && (
              <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: tab === key ? C.pu : '#fff', background: tab === key ? 'rgba(124,106,247,0.2)' : '#94a3b8', borderRadius: 10, padding: '1px 6px', minWidth: 16, display: 'inline-block', textAlign: 'center' }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'params'  && <KeyValueEditor rows={request.params}  onChange={p => onUpdate({ ...request, params: p })} />}
        {tab === 'headers' && <KeyValueEditor rows={request.headers} onChange={h => onUpdate({ ...request, headers: h })} />}
        {tab === 'auth'    && <AuthEditor auth={request.auth} onChange={a => onUpdate({ ...request, auth: a })} />}
        {tab === 'body' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {['json', 'form', 'raw', 'none'].map(t => (
                <button key={t} onClick={() => onUpdate({ ...request, bodyType: t })}
                  style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', border: request.bodyType === t ? `1.5px solid ${C.pu}` : `1px solid ${C.border}`, background: request.bodyType === t ? 'rgba(124,106,247,0.08)' : '#fff', color: request.bodyType === t ? C.pu : '#64748b' }}>{t}</button>
              ))}
            </div>
            {request.bodyType !== 'none' && request.bodyType !== 'form' && (
              <textarea value={request.body} onChange={e => onUpdate({ ...request, body: e.target.value })}
                placeholder={request.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body'}
                style={{ width: '100%', minHeight: 200, background: '#f8f8fc', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 12, color: '#1a1a2e', outline: 'none', fontFamily: C.mono, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
            )}
            {request.bodyType === 'form' && (
              <KeyValueEditor rows={request.params} onChange={p => onUpdate({ ...request, params: p })} placeholder={['Field', 'Value']} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
