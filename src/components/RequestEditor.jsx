import { useState } from 'react'
import { C, MC, METHODS } from '../constants.js'
import { parseCurl, buildCurl } from '../utils/helpers.js'
import KeyValueEditor from './KeyValueEditor.jsx'
import AuthEditor     from './AuthEditor.jsx'
import SmartUrlBar    from './SmartUrlBar.jsx'

export default function RequestEditor({ request, onUpdate, onSend, loading, envVars, collectionVars, onUpdateCollectionVar, onOpenCsvRunner }) {
  const [tab, setTab] = useState('params')
  const mc = MC[request.method] || MC.GET

  const resolve = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => collectionVars?.[k] ?? envVars[k] ?? `{{${k}}}`)

  const urlWithParams = () => {
    const en = (request.params || []).filter(p => p.enabled && p.key)
    if (!en.length) return resolve(request.url)
    const qs = en.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(resolve(p.value))}`).join('&')
    const base = resolve(request.url)
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
          onChange={url => {
            if (url.trimStart?.().startsWith('curl')) {
              try { const c = parseCurl(url); onUpdate({ ...request, method: c.method, url: c.url, headers: c.headers.length ? c.headers : request.headers, body: c.body || request.body, bodyType: c.body ? 'json' : request.bodyType }); return } catch {}
            }
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
          style={{ padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#64748b', flexShrink: 0 }}>
          📋 cURL
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
