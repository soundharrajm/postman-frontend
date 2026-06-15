import { useState, useRef, useEffect, useCallback } from 'react'

// Backend URL — reads from localStorage so user can update it in the UI
const getApiUrl = () =>
  localStorage.getItem('apiforge_backend_url') ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

function apiFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  })
}

// ── Design tokens ──────────────────────────────────────────────────────
const C = {
  bg:     '#0b0b14',
  panel:  '#0f0f1c',
  card:   '#141425',
  border: 'rgba(255,255,255,0.07)',
  pu:     '#7c6af7',
  pu2:    '#a89ff7',
  green:  '#22c55e',
  red:    '#ef4444',
  amber:  '#f59e0b',
  blue:   '#3b82f6',
  mono:   "'JetBrains Mono', monospace",
}

const METHOD_COLORS = {
  GET:    { bg:'rgba(34,197,94,0.12)',   border:'rgba(34,197,94,0.3)',   text:'#22c55e' },
  POST:   { bg:'rgba(124,106,247,0.12)', border:'rgba(124,106,247,0.3)', text:'#a89ff7' },
  PUT:    { bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.3)',  text:'#f59e0b' },
  PATCH:  { bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.3)',  text:'#60a5fa' },
  DELETE: { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.3)',   text:'#ef4444' },
  HEAD:   { bg:'rgba(107,114,128,0.12)',border:'rgba(107,114,128,0.3)', text:'#9ca3af' },
  OPTIONS:{ bg:'rgba(236,72,153,0.12)', border:'rgba(236,72,153,0.3)', text:'#f472b6' },
}

const STATUS_COLOR = (s) => {
  if (!s) return '#555'
  if (s < 300) return C.green
  if (s < 400) return C.blue
  if (s < 500) return C.amber
  return C.red
}

const METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']

function uid() { return Math.random().toString(36).slice(2) }

function newRequest() {
  return {
    id: uid(), name: 'New Request', method: 'GET', url: '',
    headers: [{ id:uid(), key:'', value:'', enabled:true }],
    params:  [{ id:uid(), key:'', value:'', enabled:true }],
    body: '', bodyType: 'json',
    auth: { type:'none', token:'', username:'', password:'', key:'', value:'', in:'header' },
  }
}

function newCollection(name = 'New Collection') {
  return { id:uid(), name, requests:[], vars:{} }
}

// ── Sidebar ────────────────────────────────────────────────────────────
function Sidebar({ collections, activeId, onSelect, onNew, onNewCollection, onDeleteRequest, onRenameCollection, onDeleteCollection, onImport, onRun }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))
  const [editingCol, setEditingCol] = useState(null)
  const [colName, setColName] = useState('')

  return (
    <div style={{ width:240, flexShrink:0, background:C.panel, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:12, fontWeight:700, color:'#e8e8f0', letterSpacing:'.5px', textTransform:'uppercase' }}>Collections</span>
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={onImport} title="Import collection" style={{ width:24, height:24, borderRadius:6, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.05)', color:'#888', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↑</button>
          <button onClick={onNewCollection} title="New collection" style={{ width:24, height:24, borderRadius:6, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.05)', color:'#888', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {collections.length === 0 && (
          <div style={{ padding:20, fontSize:12, color:'#444', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📁</div>
            No collections yet.<br/>Click + to create one.
          </div>
        )}
        {collections.map(col => (
          <div key={col.id}>
            {/* Collection header */}
            <div style={{ display:'flex', alignItems:'center', padding:'7px 10px 7px 14px', cursor:'pointer', borderBottom:`1px solid ${C.border}` }}
              onDoubleClick={() => { setEditingCol(col.id); setColName(col.name) }}>
              <span onClick={()=>toggle(col.id)} style={{ fontSize:10, color:'#555', marginRight:6, transform:expanded[col.id]?'rotate(90deg)':'', display:'inline-block', transition:'transform .15s' }}>▶</span>
              {editingCol === col.id ? (
                <input autoFocus value={colName}
                  onChange={e=>setColName(e.target.value)}
                  onBlur={()=>{ onRenameCollection(col.id, colName); setEditingCol(null) }}
                  onKeyDown={e=>{ if(e.key==='Enter'){ onRenameCollection(col.id,colName); setEditingCol(null) } if(e.key==='Escape') setEditingCol(null) }}
                  style={{ flex:1, background:'rgba(124,106,247,0.15)', border:'1px solid rgba(124,106,247,0.4)', borderRadius:4, padding:'2px 6px', fontSize:12, color:'#e8e8f0', outline:'none', fontFamily:'inherit' }} />
              ) : (
                <span onClick={()=>toggle(col.id)} style={{ flex:1, fontSize:12, fontWeight:600, color:'#c8c8e8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{col.name}</span>
              )}
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={()=>onNew(col.id)} title="Add request" style={{ width:20, height:20, borderRadius:4, border:'none', background:'none', color:'#555', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                <button onClick={()=>onDeleteCollection(col.id)} title="Delete collection" style={{ width:20, height:20, borderRadius:4, border:'none', background:'none', color:'#555', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>🗑</button>
              </div>
            </div>

            {/* Requests */}
            {expanded[col.id] && col.requests.map(req => {
              const mc = METHOD_COLORS[req.method] || METHOD_COLORS.GET
              const isActive = activeId === req.id
              return (
                <div key={req.id} onClick={()=>onSelect(req.id)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px 6px 28px', cursor:'pointer', background:isActive?'rgba(124,106,247,0.12)':'transparent', borderLeft:isActive?`2px solid ${C.pu}`:'2px solid transparent' }}>
                  <span style={{ fontSize:9, fontWeight:700, color:mc.text, background:mc.bg, border:`1px solid ${mc.border}`, borderRadius:3, padding:'1px 4px', flexShrink:0, fontFamily:C.mono }}>{req.method}</span>
                  <span style={{ flex:1, fontSize:11, color:isActive?'#e8e8f0':'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{req.name}</span>
                  <button onClick={e=>{e.stopPropagation();onDeleteRequest(col.id,req.id)}} style={{ width:16, height:16, border:'none', background:'none', color:'#444', fontSize:10, cursor:'pointer', opacity:0, display:'flex', alignItems:'center', justifyContent:'center' }}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>✕</button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* New request at bottom */}
      <div style={{ padding:10, borderTop:`1px solid ${C.border}` }}>
        <button onClick={()=>onNew(collections[0]?.id)} style={{ width:'100%', padding:'8px', borderRadius:8, border:`1px dashed ${C.border}`, background:'none', color:'#555', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          + New Request
        </button>
      </div>
    </div>
  )
}

// ── KeyValueEditor ─────────────────────────────────────────────────────
function KeyValueEditor({ rows, onChange, placeholder = ['Key','Value'] }) {
  const update = (id, field, val) => onChange(rows.map(r => r.id===id ? {...r,[field]:val} : r))
  const add = () => onChange([...rows, { id:uid(), key:'', value:'', enabled:true }])
  const remove = (id) => onChange(rows.filter(r => r.id!==id))

  return (
    <div>
      {rows.map(row => (
        <div key={row.id} style={{ display:'flex', gap:6, marginBottom:5, alignItems:'center' }}>
          <input type="checkbox" checked={row.enabled} onChange={e=>update(row.id,'enabled',e.target.checked)} style={{ accentColor:C.pu, flexShrink:0 }} />
          <input value={row.key} onChange={e=>update(row.id,'key',e.target.value)} placeholder={placeholder[0]}
            style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 10px', fontSize:12, color:'#e8e8f0', outline:'none', fontFamily:C.mono }} />
          <input value={row.value} onChange={e=>update(row.id,'value',e.target.value)} placeholder={placeholder[1]}
            style={{ flex:2, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 10px', fontSize:12, color:'#e8e8f0', outline:'none', fontFamily:C.mono }} />
          <button onClick={()=>remove(row.id)} style={{ width:24, height:24, border:'none', background:'rgba(239,68,68,0.08)', borderRadius:5, color:'#f87171', cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ fontSize:11, color:'#555', background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>+ Add row</button>
    </div>
  )
}

// ── AuthEditor ─────────────────────────────────────────────────────────
function AuthEditor({ auth, onChange }) {
  const set = (k, v) => onChange({ ...auth, [k]: v })
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {['none','bearer','basic','apikey'].map(t => (
          <button key={t} onClick={()=>set('type',t)} style={{
            padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize',
            border: auth.type===t ? `1px solid ${C.pu}` : `1px solid ${C.border}`,
            background: auth.type===t ? 'rgba(124,106,247,0.15)' : 'rgba(255,255,255,0.03)',
            color: auth.type===t ? C.pu2 : '#555',
          }}>{t === 'apikey' ? 'API Key' : t === 'bearer' ? 'Bearer Token' : t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      {auth.type === 'bearer' && (
        <input value={auth.token} onChange={e=>set('token',e.target.value)} placeholder="Bearer token"
          style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, color:'#e8e8f0', outline:'none', fontFamily:C.mono, boxSizing:'border-box' }} />
      )}
      {auth.type === 'basic' && (
        <div style={{ display:'flex', gap:8 }}>
          <input value={auth.username} onChange={e=>set('username',e.target.value)} placeholder="Username"
            style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, color:'#e8e8f0', outline:'none', fontFamily:C.mono }} />
          <input type="password" value={auth.password} onChange={e=>set('password',e.target.value)} placeholder="Password"
            style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, color:'#e8e8f0', outline:'none', fontFamily:C.mono }} />
        </div>
      )}
      {auth.type === 'apikey' && (
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input value={auth.key} onChange={e=>set('key',e.target.value)} placeholder="Key"
            style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, color:'#e8e8f0', outline:'none', fontFamily:C.mono }} />
          <input value={auth.value} onChange={e=>set('value',e.target.value)} placeholder="Value"
            style={{ flex:2, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, color:'#e8e8f0', outline:'none', fontFamily:C.mono }} />
          <select value={auth.in} onChange={e=>set('in',e.target.value)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 10px', fontSize:12, color:'#e8e8f0', outline:'none' }}>
            <option value="header">Header</option>
            <option value="query">Query</option>
          </select>
        </div>
      )}
    </div>
  )
}

// ── ResponseViewer ─────────────────────────────────────────────────────
function ResponseViewer({ response, loading, elapsed }) {
  const [tab, setTab] = useState('body')
  const [bodyView, setBodyView] = useState('pretty')

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <div style={{ width:40, height:40, border:`3px solid rgba(124,106,247,0.2)`, borderTop:`3px solid ${C.pu}`, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ fontSize:12, color:'#555' }}>Sending request…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!response) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#333' }}>
      <div style={{ fontSize:48 }}>⚡</div>
      <p style={{ fontSize:13, margin:0 }}>Send a request to see the response</p>
    </div>
  )

  const sc = STATUS_COLOR(response.status)
  let prettyBody = response.body
  let isJson = false
  try { prettyBody = JSON.stringify(JSON.parse(response.body), null, 2); isJson = true } catch {}

  const headers = Object.entries(response.headers || {})

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Status bar */}
      <div style={{ display:'flex', gap:16, alignItems:'center', padding:'10px 16px', borderBottom:`1px solid ${C.border}`, background:C.panel, flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:700, color:sc, background:`${sc}18`, border:`1px solid ${sc}33`, borderRadius:6, padding:'3px 10px', fontFamily:C.mono }}>
          {response.status} {response.statusText}
        </span>
        <span style={{ fontSize:12, color:'#555' }}>{elapsed}ms</span>
        <span style={{ fontSize:12, color:'#555' }}>{response.size}</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          {['body','headers','cookies'].map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize',
              border: tab===t ? `1px solid ${C.pu}` : `1px solid ${C.border}`,
              background: tab===t ? 'rgba(124,106,247,0.12)' : 'none',
              color: tab===t ? C.pu2 : '#555',
            }}>{t} {t==='headers'?`(${headers.length})`:''}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      {tab === 'body' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ display:'flex', gap:6, padding:'8px 16px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
            {['pretty','raw','preview'].map(v => (
              <button key={v} onClick={()=>setBodyView(v)} style={{
                padding:'3px 10px', borderRadius:5, fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize',
                border: bodyView===v ? `1px solid ${C.pu}` : `1px solid ${C.border}`,
                background: bodyView===v ? 'rgba(124,106,247,0.1)' : 'none',
                color: bodyView===v ? C.pu2 : '#555',
              }}>{v}</button>
            ))}
            <button onClick={()=>navigator.clipboard.writeText(response.body)} style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:5, fontSize:11, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${C.border}`, background:'none', color:'#555' }}>📋 Copy</button>
          </div>
          {bodyView === 'preview' ? (
            <iframe srcDoc={response.body} style={{ flex:1, border:'none', background:'#fff' }} />
          ) : (
            <pre style={{ flex:1, margin:0, padding:16, overflowY:'auto', fontSize:12, fontFamily:C.mono, color: isJson ? '#e8e8f0' : '#aaa', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
              {bodyView==='pretty' ? prettyBody : response.body}
            </pre>
          )}
        </div>
      )}

      {/* Headers */}
      {tab === 'headers' && (
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {headers.map(([k,v]) => (
            <div key={k} style={{ display:'flex', gap:12, padding:'6px 0', borderBottom:`1px solid ${C.border}` }}>
              <span style={{ flex:1, fontSize:12, color:C.pu2, fontFamily:C.mono, fontWeight:600 }}>{k}</span>
              <span style={{ flex:2, fontSize:12, color:'#aaa', fontFamily:C.mono, wordBreak:'break-all' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cookies */}
      {tab === 'cookies' && (
        <div style={{ flex:1, padding:16, color:'#555', fontSize:12 }}>
          {(response.cookies||[]).length === 0 ? 'No cookies' : (response.cookies||[]).map((c,i) => (
            <div key={i} style={{ padding:'6px 0', borderBottom:`1px solid ${C.border}`, fontFamily:C.mono, fontSize:12, color:'#aaa' }}>{c}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── EnvPanel ───────────────────────────────────────────────────────────
function EnvPanel({ envs, active, onSetActive, onUpdate, onAdd, onDelete }) {
  const [editing, setEditing] = useState(null)
  const activeEnv = envs.find(e=>e.id===active)

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={e=>{if(e.target===e.currentTarget)setEditing(null)}}>
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:14, width:700, maxHeight:'80vh', display:'flex', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.5)' }}>
        {/* Left: env list */}
        <div style={{ width:200, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.border}`, fontSize:12, fontWeight:700, color:'#e8e8f0' }}>Environments</div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {envs.map(env => (
              <div key={env.id} onClick={()=>onSetActive(env.id)} style={{
                padding:'9px 14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                background:active===env.id?'rgba(124,106,247,0.12)':'transparent',
                borderLeft:active===env.id?`2px solid ${C.pu}`:'2px solid transparent',
              }}>
                <span style={{ fontSize:12, color:active===env.id?'#e8e8f0':'#888' }}>{env.name}</span>
                <button onClick={e=>{e.stopPropagation();onDelete(env.id)}} style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:11 }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ padding:10 }}>
            <button onClick={onAdd} style={{ width:'100%', padding:'7px', borderRadius:7, border:`1px dashed ${C.border}`, background:'none', color:'#555', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>+ New Environment</button>
          </div>
        </div>

        {/* Right: variables */}
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:12, fontWeight:700, color:'#e8e8f0' }}>
            {activeEnv ? activeEnv.name : 'Select an environment'}
          </div>
          {activeEnv && (
            <div style={{ flex:1, overflowY:'auto', padding:16 }}>
              <KeyValueEditor rows={activeEnv.vars} onChange={vars=>onUpdate(active,vars)} placeholder={['Variable','Value']} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── HistoryPanel ───────────────────────────────────────────────────────
function HistoryPanel({ history, onSelect, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end', justifyContent:'flex-end' }} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{ width:360, height:'100vh', background:C.panel, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', boxShadow:'-8px 0 32px rgba(0,0,0,0.4)' }}>
        <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#e8e8f0' }}>History</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {history.length === 0 && <div style={{ padding:20, fontSize:12, color:'#444', textAlign:'center' }}>No history yet</div>}
          {history.map((h, i) => {
            const mc = METHOD_COLORS[h.method] || METHOD_COLORS.GET
            const sc = STATUS_COLOR(h.status)
            return (
              <div key={i} onClick={()=>{onSelect(h);onClose()}} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
                  <span style={{ fontSize:9, fontWeight:700, color:mc.text, background:mc.bg, border:`1px solid ${mc.border}`, borderRadius:3, padding:'1px 4px', fontFamily:C.mono }}>{h.method}</span>
                  {h.status && <span style={{ fontSize:10, color:sc, fontFamily:C.mono }}>{h.status}</span>}
                  <span style={{ fontSize:10, color:'#444', marginLeft:'auto' }}>{h.time}</span>
                </div>
                <div style={{ fontSize:11, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:C.mono }}>{h.url}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main RequestEditor ─────────────────────────────────────────────────
function RequestEditor({ request, onUpdate, onSend, loading, envVars, collectionVars, onUpdateCollectionVar }) {
  const [tab, setTab] = useState('params')
  const mc = METHOD_COLORS[request.method] || METHOD_COLORS.GET

  // Resolve env vars in URL
  const resolveEnv = (str) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => collectionVars?.[k] ?? envVars[k] ?? `{{${k}}}`)
  const resolvedUrl = resolveEnv(request.url)

  // Build URL with params
  const urlWithParams = () => {
    const enabled = request.params.filter(p=>p.enabled&&p.key)
    if (!enabled.length) return resolvedUrl
    const qs = enabled.map(p=>`${encodeURIComponent(p.key)}=${encodeURIComponent(resolveEnv(p.value))}`).join('&')
    return `${resolvedUrl}${resolvedUrl.includes('?')?'&':'?'}${qs}`
  }

  const tabStyle = (t) => ({
    padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
    border: tab===t ? `1px solid ${C.pu}` : `1px solid ${C.border}`,
    background: tab===t ? 'rgba(124,106,247,0.12)' : 'none',
    color: tab===t ? C.pu2 : '#555',
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Request name */}
      <div style={{ padding:'8px 16px 0', flexShrink:0 }}>
        <input value={request.name} onChange={e=>onUpdate({...request,name:e.target.value})}
          style={{ background:'none', border:'none', outline:'none', fontSize:16, fontWeight:600, color:'#e8e8f0', fontFamily:'inherit', width:'100%' }} />
      </div>

      {/* URL bar */}
      <div style={{ display:'flex', gap:8, padding:'8px 16px', flexShrink:0 }}>
        <select value={request.method} onChange={e=>onUpdate({...request,method:e.target.value})} style={{
          background:mc.bg, border:`1px solid ${mc.border}`, borderRadius:8, padding:'0 12px', fontSize:12, fontWeight:700, color:mc.text, cursor:'pointer', outline:'none', fontFamily:C.mono,
        }}>
          {METHODS.map(m => <option key={m} value={m} style={{ background:C.card }}>{m}</option>)}
        </select>

        <SmartUrlBar
          value={request.url}
          onChange={url => {
            // Also handle curl paste at this level
            if (url.trimStart?.().startsWith('curl')) {
              try {
                const parsed = parseCurl(url)
                onUpdate({ ...request, method:parsed.method, url:parsed.url, headers:parsed.headers.length?parsed.headers:request.headers, body:parsed.body||request.body, bodyType:parsed.body?'json':request.bodyType })
                return
              } catch(_) {}
            }
            onUpdate({ ...request, url })
          }}
          onSend={() => onSend(urlWithParams())}
          envVars={envVars}
          collectionVars={collectionVars}
          onUpdateCollectionVar={onUpdateCollectionVar}
        />

        <button onClick={()=>onSend(urlWithParams())} disabled={loading||!request.url.trim()} style={{
          padding:'10px 28px', borderRadius:8, fontSize:13, fontWeight:700, cursor:loading||!request.url.trim()?'not-allowed':'pointer', fontFamily:'inherit', border:'none',
          background:loading||!request.url.trim()?'rgba(124,106,247,0.3)':'linear-gradient(135deg,#7c6af7,#6d28d9)', color:'#fff', flexShrink:0,
        }}>
          {loading ? '⏳' : 'Send'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, padding:'4px 16px 10px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {['params','headers','body','auth'].map(t => (
          <button key={t} onClick={()=>setTab(t)} style={tabStyle(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
            {t==='params' && request.params.filter(p=>p.enabled&&p.key).length > 0 && <span style={{ marginLeft:4, fontSize:10, color:C.pu2 }}>({request.params.filter(p=>p.enabled&&p.key).length})</span>}
            {t==='headers' && request.headers.filter(h=>h.enabled&&h.key).length > 0 && <span style={{ marginLeft:4, fontSize:10, color:C.pu2 }}>({request.headers.filter(h=>h.enabled&&h.key).length})</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        {tab === 'params' && <KeyValueEditor rows={request.params} onChange={params=>onUpdate({...request,params})} />}
        {tab === 'headers' && <KeyValueEditor rows={request.headers} onChange={headers=>onUpdate({...request,headers})} />}
        {tab === 'auth' && <AuthEditor auth={request.auth} onChange={auth=>onUpdate({...request,auth})} />}
        {tab === 'body' && (
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              {['json','form','raw','none'].map(t => (
                <button key={t} onClick={()=>onUpdate({...request,bodyType:t})} style={{
                  padding:'4px 12px', borderRadius:5, fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'uppercase',
                  border: request.bodyType===t ? `1px solid ${C.pu}` : `1px solid ${C.border}`,
                  background: request.bodyType===t ? 'rgba(124,106,247,0.1)' : 'none',
                  color: request.bodyType===t ? C.pu2 : '#555',
                }}>{t}</button>
              ))}
            </div>
            {request.bodyType !== 'none' && request.bodyType !== 'form' && (
              <textarea value={request.body} onChange={e=>onUpdate({...request,body:e.target.value})}
                placeholder={request.bodyType==='json' ? '{\n  "key": "value"\n}' : 'Request body'}
                style={{ width:'100%', minHeight:200, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:12, fontSize:12, color:'#e8e8f0', outline:'none', fontFamily:C.mono, resize:'vertical', boxSizing:'border-box', lineHeight:1.6 }} />
            )}
            {request.bodyType === 'form' && (
              <KeyValueEditor rows={request.params} onChange={params=>onUpdate({...request,params})} placeholder={['Field','Value']} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'postman_collections'
const ENV_KEY     = 'postman_envs'
const HIST_KEY    = 'postman_history'

export default function App() {
  const [collections, setCollections] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
  })
  const [activeReqId, setActiveReqId] = useState(null)
  const [responses, setResponses]     = useState({})
  const [loading, setLoading]         = useState(false)
  const [elapsed, setElapsed]         = useState(null)
  const [envs, setEnvs]               = useState(() => {
    try { return JSON.parse(localStorage.getItem(ENV_KEY)) || [] } catch { return [] }
  })
  const [activeEnv, setActiveEnv]     = useState(null)
  const [history, setHistory]         = useState(() => {
    try { return JSON.parse(localStorage.getItem(HIST_KEY)) || [] } catch { return [] }
  })
  const [showEnv, setShowEnv]         = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showBackendSettings, setShowBackendSettings] = useState(false)
  const [importError, setImportError]         = useState(null)
  const [runnerCol, setRunnerCol]             = useState(null)
  const importFileRef = useRef(null)

  // Persist
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(collections)) }, [collections])
  useEffect(() => { localStorage.setItem(ENV_KEY, JSON.stringify(envs)) }, [envs])
  useEffect(() => { localStorage.setItem(HIST_KEY, JSON.stringify(history)) }, [history])

  // Env vars map
  const envVars = {}
  const activeEnvObj = envs.find(e=>e.id===activeEnv)
  if (activeEnvObj) activeEnvObj.vars.forEach(v => { if(v.enabled&&v.key) envVars[v.key]=v.value })

  // Active request
  const activeReq = collections.flatMap(c=>c.requests).find(r=>r.id===activeReqId) || null

  const updateRequest = (updated) => {
    setCollections(cs => cs.map(c => ({
      ...c, requests: c.requests.map(r => r.id===updated.id ? updated : r)
    })))
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = importPostmanCollection(ev.target.result)
        const col = { id:uid(), name:imported.name, requests:imported.requests }
        setCollections(cs => [...cs, col])
        if (imported.requests.length) setActiveReqId(imported.requests[0].id)
        setImportError(null)
      } catch(err) {
        setImportError(err.message)
        setTimeout(()=>setImportError(null), 4000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const newRequest_ = (colId) => {
    const req = newRequest()
    if (!colId && collections.length === 0) {
      const col = newCollection()
      col.requests.push(req)
      setCollections([col])
    } else {
      const targetId = colId || collections[0].id
      setCollections(cs => cs.map(c => c.id===targetId ? {...c, requests:[...c.requests, req]} : c))
    }
    setActiveReqId(req.id)
  }

  const deleteRequest = (colId, reqId) => {
    setCollections(cs => cs.map(c => c.id===colId ? {...c, requests:c.requests.filter(r=>r.id!==reqId)} : c))
    if (activeReqId === reqId) setActiveReqId(null)
  }

  const sendRequest = async (url) => {
    if (!activeReq || !url.trim()) return
    setLoading(true)
    const t0 = Date.now()
    try {
      const headers = {}
      activeReq.headers.filter(h=>h.enabled&&h.key).forEach(h => { headers[h.key] = h.value })

      // Apply auth
      const auth = activeReq.auth
      if (auth.type === 'bearer' && auth.token) headers['Authorization'] = `Bearer ${auth.token}`
      if (auth.type === 'basic' && auth.username) headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`
      if (auth.type === 'apikey' && auth.key && auth.in === 'header') headers[auth.key] = auth.value

      let body = undefined
      if (!['GET','HEAD'].includes(activeReq.method) && activeReq.bodyType !== 'none') {
        if (activeReq.bodyType === 'json') { headers['Content-Type'] = 'application/json'; body = activeReq.body }
        if (activeReq.bodyType === 'raw') body = activeReq.body
        if (activeReq.bodyType === 'form') {
          const fd = new FormData()
          activeReq.params.filter(p=>p.enabled&&p.key).forEach(p=>fd.append(p.key,p.value))
          body = fd
        }
      }

      const resp = await apiFetch(`${getApiUrl()}/proxy`, {
        method: 'POST',
        body: JSON.stringify({ url, method: activeReq.method, headers, body }),
      })
      const data = await resp.json()
      const ms = Date.now() - t0
      setElapsed(ms)

      const result = {
        status: data.status, statusText: data.status_text,
        headers: data.headers || {}, body: data.body || '',
        size: data.size, cookies: data.cookies || [],
      }
      setResponses(r => ({ ...r, [activeReqId]: result }))

      // Save history
      const entry = { method: activeReq.method, url, status: data.status, time: new Date().toLocaleTimeString(), reqId: activeReqId }
      setHistory(h => [entry, ...h.slice(0,99)])
    } catch(e) {
      setResponses(r => ({ ...r, [activeReqId]: { status:0, statusText:'Error', headers:{}, body: e.message, size:'—', cookies:[] } }))
      setElapsed(Date.now()-t0)
    } finally {
      setLoading(false)
    }
  }

  const loadFromHistory = (entry) => {
    if (entry.reqId) setActiveReqId(entry.reqId)
  }

  return (
    <div style={{ height:'100vh', background:C.bg, fontFamily:"'Inter','Space Grotesk',sans-serif", color:'#e8e8f0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}input,textarea,select{color-scheme:dark}`}</style>

      {/* ── Topbar ── */}
      <div style={{ height:46, background:C.panel, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#7c6af7,#ec4899)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
          <span style={{ fontSize:14, fontWeight:700, color:'#e8e8f0', letterSpacing:'-.3px' }}>APIforge</span>
        </div>

        <div style={{ height:20, width:1, background:C.border }} />

        <button onClick={()=>newRequest_(null)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.04)', color:'#888', cursor:'pointer', fontFamily:'inherit' }}>+ New Request</button>

        <div style={{ flex:1 }} />

        {/* Active env selector */}
        <select value={activeEnv||''} onChange={e=>setActiveEnv(e.target.value||null)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:7, padding:'5px 10px', fontSize:11, color: activeEnv ? C.pu2 : '#555', outline:'none', cursor:'pointer' }}>
          <option value="">No Environment</option>
          {envs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <button onClick={()=>setShowEnv(true)} style={{ fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid rgba(124,106,247,0.3)`, background:'rgba(124,106,247,0.08)', color:C.pu2, cursor:'pointer', fontFamily:'inherit' }}>⚙ Environments</button>
        <button onClick={()=>setShowHistory(true)} style={{ fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.04)', color:'#888', cursor:'pointer', fontFamily:'inherit' }}>🕐 History</button>
        <button onClick={()=>setShowBackendSettings(true)} style={{ fontSize:11, padding:'5px 12px', borderRadius:7, border:`1px solid rgba(124,106,247,0.3)`, background:'rgba(124,106,247,0.08)', color:C.pu2, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
          🔗 Backend
        </button>
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <input ref={importFileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImportFile} />
        {importError && (
          <div style={{ position:'fixed', bottom:16, left:260, zIndex:300, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#f87171' }}>
            ✗ {importError}
          </div>
        )}
        <Sidebar
          collections={collections}
          activeId={activeReqId}
          onSelect={setActiveReqId}
          onNew={newRequest_}
          onNewCollection={()=>setCollections(cs=>[...cs,newCollection()])}
          onDeleteRequest={deleteRequest}
          onRenameCollection={(id,name)=>setCollections(cs=>cs.map(c=>c.id===id?{...c,name}:c))}
          onDeleteCollection={(id)=>setCollections(cs=>cs.filter(c=>c.id!==id))}
          onImport={()=>importFileRef.current?.click()}
          onRun={(id)=>setRunnerCol(collections.find(c=>c.id===id))}
        />

        {/* ── Request + Response pane ── */}
        {activeReq ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Top half: request editor */}
            <div style={{ flex:'0 0 55%', display:'flex', flexDirection:'column', borderBottom:`2px solid ${C.border}`, overflow:'hidden' }}>
              <RequestEditor
                request={activeReq}
                onUpdate={updateRequest}
                onSend={sendRequest}
                loading={loading}
                envVars={envVars}
                collectionVars={collections.find(c=>c.requests.some(r=>r.id===activeReqId))?.vars || {}}
                onUpdateCollectionVar={(key,val) => {
                  setCollections(cs => cs.map(c =>
                    c.requests.some(r=>r.id===activeReqId)
                      ? { ...c, vars:{ ...c.vars, [key]:val } }
                      : c
                  ))
                }}
              />
            </div>
            {/* Bottom half: response */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <ResponseViewer response={responses[activeReqId]} loading={loading} elapsed={elapsed} />
            </div>
          </div>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'#333' }}>
            <div style={{ fontSize:64 }}>⚡</div>
            <h2 style={{ fontSize:20, fontWeight:600, color:'#555' }}>APIforge</h2>
            <p style={{ fontSize:13, color:'#444' }}>Create or select a request to get started</p>
            <button onClick={()=>newRequest_(null)} style={{ padding:'10px 24px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'none', background:'linear-gradient(135deg,#7c6af7,#6d28d9)', color:'#fff' }}>+ New Request</button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEnv && (
        <EnvPanel
          envs={envs} active={activeEnv}
          onSetActive={setActiveEnv}
          onUpdate={(id,vars)=>setEnvs(es=>es.map(e=>e.id===id?{...e,vars}:e))}
          onAdd={()=>{ const e={id:uid(),name:'New Environment',vars:[{id:uid(),key:'',value:'',enabled:true}]}; setEnvs(es=>[...es,e]); setActiveEnv(e.id) }}
          onDelete={(id)=>{ setEnvs(es=>es.filter(e=>e.id!==id)); if(activeEnv===id)setActiveEnv(null) }}
        />
      )}
      {showEnv && <div onClick={()=>setShowEnv(false)} style={{ position:'fixed', inset:0, zIndex:199 }} />}

      {showHistory && <HistoryPanel history={history} onSelect={loadFromHistory} onClose={()=>setShowHistory(false)} />}
      {showBackendSettings && <BackendSettings onClose={()=>setShowBackendSettings(false)} />}
      {runnerCol && <CollectionRunner collection={runnerCol} envVars={envVars} onClose={()=>setRunnerCol(null)} getApiUrl={getApiUrl} />}
    </div>
  )
}
