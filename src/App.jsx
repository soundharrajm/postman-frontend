import { useState, useEffect, useRef } from 'react'
import { C, STORAGE_KEYS as SK } from './constants.jsx'
import { uid, getApiUrl, newRequest, newCollection, importPostmanCollection } from './utils/helpers.js'

import Sidebar          from './components/Sidebar.jsx'
import RequestEditor    from './components/RequestEditor.jsx'
import ResponseViewer   from './components/ResponseViewer.jsx'
import InlineCsvRunner  from './components/InlineCsvRunner.jsx'
import CollectionRunner from './components/CollectionRunner.jsx'
import HistoryPanel     from './components/HistoryPanel.jsx'
import EnvPanel         from './components/EnvPanel.jsx'
import BackendSettings  from './components/BackendSettings.jsx'
import ResizablePanes  from './components/ResizablePanes.jsx'
import IdExtractor    from './components/IdExtractor.jsx'
import HealthPanel    from './components/HealthPanel.jsx'

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [collections, setCollections] = useState(() => { try { return JSON.parse(localStorage.getItem(SK.collections)) || [] } catch { return [] } })
  const [activeId,    setActiveId]    = useState(null)
  const [responses,   setResponses]   = useState({})
  const [loading,     setLoading]     = useState(false)
  const [elapsed,     setElapsed]     = useState(null)
  const [envs,        setEnvs]        = useState(() => { try { return JSON.parse(localStorage.getItem(SK.envs)) || [] } catch { return [] } })
  const [activeEnv,   setActiveEnv]   = useState(null)
  const [history,     setHistory]     = useState(() => { try { return JSON.parse(localStorage.getItem(SK.history)) || [] } catch { return [] } })

  // UI state
  const [showEnv,     setShowEnv]     = useState(false)
  const [showHist,    setShowHist]    = useState(false)
  const [showBackend, setShowBackend] = useState(false)
  const [showHealth,  setShowHealth]  = useState(false)
  const [runnerCol,   setRunnerCol]   = useState(null)
  const [csvRunReq,   setCsvRunReq]   = useState(null)
  const [importError, setImportError] = useState(null)
  const [backendOk,   setBackendOk]   = useState(null)
  const [showIdTool,  setShowIdTool]  = useState(false)

  const importRef = useRef(null)

  // ── Page title ──────────────────────────────────────────────────────────────
  useEffect(() => { document.title = 'API Market' }, [])

  // ── Persist ─────────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem(SK.collections, JSON.stringify(collections)) }, [collections])
  useEffect(() => { localStorage.setItem(SK.envs,        JSON.stringify(envs))        }, [envs])
  useEffect(() => { localStorage.setItem(SK.history,     JSON.stringify(history))     }, [history])

  // ── Backend health check ────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try { const r = await fetch(getApiUrl() + '/health', { signal: AbortSignal.timeout(4000) }); setBackendOk(r.ok) }
      catch { setBackendOk(false) }
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const envVars  = {}
  const activeEnvObj = envs.find(e => e.id === activeEnv)
  if (activeEnvObj) activeEnvObj.vars.forEach(v => { if (v.enabled && v.key) envVars[v.key] = v.value })

  const activeReq = collections.flatMap(c => c.requests).find(r => r.id === activeId) || null
  const activeCol = collections.find(c => c.requests.some(r => r.id === activeId))

  // ── Collection / Request actions ────────────────────────────────────────────
  const updateReq = (updated) => setCollections(cs => cs.map(c => ({ ...c, requests: c.requests.map(r => r.id === updated.id ? updated : r) })))

  const newReq = (colId) => {
    const req = newRequest()
    if (!colId && collections.length === 0) {
      const col = newCollection(); col.requests.push(req); setCollections([col])
    } else {
      const tid = colId || collections[0].id
      setCollections(cs => cs.map(c => c.id === tid ? { ...c, requests: [...c.requests, req] } : c))
    }
    setActiveId(req.id)
  }

  const deleteReq = (colId, reqId) => {
    setCollections(cs => cs.map(c => c.id === colId ? { ...c, requests: c.requests.filter(r => r.id !== reqId) } : c))
    if (activeId === reqId) setActiveId(null)
  }

  const exportCollection = (col) => {
    const postman = {
      info: { name: col.name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: col.requests.map(req => ({
        name: req.name,
        request: {
          method: req.method,
          url:    { raw: req.url },
          header: req.headers.filter(h => h.enabled && h.key).map(h => ({ key: h.key, value: h.value })),
          body:   req.body ? { mode: 'raw', raw: req.body } : undefined,
        }
      })),
      variable: Object.entries(col.vars || {}).map(([key, value]) => ({ key, value }))
    }
    const blob = new Blob([JSON.stringify(postman, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = col.name + '.json'; a.click()
  }

  // ── Import (handles both Postman + backup JSON) ─────────────────────────────
  const handleImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result)
        if (raw.collections && Array.isArray(raw.collections)) {
          // APIforge backup
          if (raw.collections.length) setCollections(raw.collections)
          if (raw.history?.length)    setHistory(raw.history)
          if (raw.envs?.length)       setEnvs(raw.envs)
        } else if (raw.info || raw.item) {
          // Postman collection
          const d   = importPostmanCollection(raw)
          const col = { id: uid(), name: d.name, requests: d.requests, vars: d.vars || {} }
          setCollections(cs => [...cs, col])
          if (d.requests.length) setActiveId(d.requests[0].id)
          localStorage.setItem('apiforge_expanded_col', col.id)
        } else {
          throw new Error('Unknown format — must be Postman collection or APIforge backup')
        }
        setImportError(null)
      } catch (err) { setImportError(err.message); setTimeout(() => setImportError(null), 5000) }
    }
    reader.readAsText(file); e.target.value = ''
  }

  // ── History load ─────────────────────────────────────────────────────────────
  const loadFromHistory = (h) => {
    const existing = collections.flatMap(c => c.requests).find(r => r.id === h.reqId)
    if (existing) { setActiveId(h.reqId); return }
    const req = { ...newRequest(), name: h.url.split('/').filter(Boolean).pop() || 'Request', method: h.method, url: h.url }
    if (collections.length === 0) { const col = newCollection(); col.requests.push(req); setCollections([col]) }
    else { setCollections(cs => cs.map((c, i) => i === 0 ? { ...c, requests: [...c.requests, req] } : c)) }
    setActiveId(req.id)
  }

  // ── Send request ─────────────────────────────────────────────────────────────
  const sendReq = async (url) => {
    if (!activeReq || !url.trim()) return
    setLoading(true); const t0 = Date.now()
    try {
      const hdrs = {}
      activeReq.headers.filter(h => h.enabled && h.key).forEach(h => { hdrs[h.key] = h.value })
      const auth = activeReq.auth
      if (auth.type === 'bearer' && auth.token)    hdrs['Authorization'] = `Bearer ${auth.token}`
      if (auth.type === 'basic'  && auth.username)  hdrs['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`
      if (auth.type === 'apikey' && auth.key && auth.in === 'header') hdrs[auth.key] = auth.value

      let body = undefined
      if (!['GET', 'HEAD'].includes(activeReq.method) && activeReq.bodyType !== 'none' && activeReq.body) {
        hdrs['Content-Type'] = 'application/json'; body = activeReq.body
      }

      const resp = await fetch(getApiUrl() + '/proxy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url, method: activeReq.method, headers: hdrs, body }),
      })
      const data = await resp.json()
      const ms = Date.now() - t0; setElapsed(ms)

      setResponses(r => ({ ...r, [activeId]: { status: data.status, statusText: data.status_text, headers: data.headers || {}, body: data.body || '', size: data.size, cookies: data.cookies || [], _req: { url, method: activeReq.method, headers: hdrs, body } } }))
      setHistory(h => [{ method: activeReq.method, url, status: data.status, time: new Date().toLocaleTimeString(), reqId: activeId }, ...h.slice(0, 99)])
    } catch (e) {
      setResponses(r => ({ ...r, [activeId]: { status: 0, statusText: 'Error', headers: {}, body: e.message, size: '—', cookies: [] } }))
      setElapsed(Date.now() - t0)
    } finally { setLoading(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: "'Inter','Space Grotesk',sans-serif", color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:3px}input,textarea,select{color-scheme:light}`}</style>

      {/* ── Topbar ── */}
      <div style={{ height: 46, background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="30" height="30" rx="8" fill="url(#apm_grad)"/>
            <defs>
              <linearGradient id="apm_grad" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
            <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="Inter,sans-serif" letterSpacing="-0.5">APM</text>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-.5px' }}>API Market</span>
        </div>

        <div style={{ height: 20, width: 1, background: C.border }} />
        <button onClick={() => newReq(null)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>+ New Request</button>
        <div style={{ flex: 1 }} />

        <select value={activeEnv || ''} onChange={e => setActiveEnv(e.target.value || null)} style={{ background: '#f8f8fc', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', fontSize: 11, color: activeEnv ? C.pu : '#94a3b8', outline: 'none', cursor: 'pointer', maxWidth: 130 }}>
          <option value="">No Environment</option>
          {envs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <button onClick={() => setShowEnv(true)} title="Environments" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid rgba(124,106,247,0.25)`, background: 'rgba(124,106,247,0.06)', color: C.pu, cursor: 'pointer', fontFamily: 'inherit' }}>⚙ Env</button>
        <button onClick={() => setShowIdTool(true)} title="ID Extractor" style={{ fontSize: 13, padding: '5px 9px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#64748b', cursor: 'pointer' }}>🔑</button>
        <button onClick={() => setShowHist(true)} title="History" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>🕐</button>
        <button onClick={() => setShowHealth(true)} title="Health" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid ${backendOk === true ? 'rgba(22,163,74,0.3)' : backendOk === false ? 'rgba(220,38,38,0.3)' : C.border}`, background: backendOk === true ? 'rgba(22,163,74,0.06)' : backendOk === false ? 'rgba(220,38,38,0.06)' : '#f8f8fc', color: backendOk === true ? C.green : backendOk === false ? C.red : '#64748b', cursor: 'pointer', fontFamily: 'inherit', display:'inline-flex', alignItems:'center', gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: backendOk === true ? C.green : backendOk === false ? C.red : '#94a3b8', display:'inline-block' }} />
          Health
        </button>
        <button onClick={() => {
          const data = { collections, history, envs, exportedAt: new Date().toISOString() }
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'apiforge-backup.json'; a.click()
        }} title="Export backup" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>↓</button>
        <label title="Import backup" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}>
          ↑<input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </label>
        <button onClick={() => setShowBackend(true)} title="Backend settings" style={{
          fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          border:     backendOk === true ? '1px solid rgba(22,163,74,0.3)' : backendOk === false ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(124,106,247,0.25)',
          background: backendOk === true ? 'rgba(22,163,74,0.06)'         : backendOk === false ? 'rgba(220,38,38,0.06)'           : 'rgba(124,106,247,0.06)',
          color:      backendOk === true ? C.green                         : backendOk === false ? C.red                            : C.pu,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: backendOk === true ? C.green : backendOk === false ? C.red : '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
          BE
        </button>
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {importError && (
          <div style={{ position: 'fixed', bottom: 16, left: 260, zIndex: 300, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: C.red }}>{importError}</div>
        )}

        <Sidebar
          collections={collections}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={newReq}
          onNewCollection={() => setCollections(cs => [...cs, newCollection()])}
          onDeleteRequest={deleteReq}
          onRenameCollection={(id, name) => setCollections(cs => cs.map(c => c.id === id ? { ...c, name } : c))}
          onDeleteCollection={(id) => setCollections(cs => cs.filter(c => c.id !== id))}
          onImport={() => importRef.current?.click()}
          onRun={(id) => setRunnerCol(collections.find(c => c.id === id))}
          onExport={exportCollection}
        />

        {activeReq ? (
          <ResizablePanes
            top={
              <RequestEditor
                request={activeReq}
                onUpdate={updateReq}
                onSend={sendReq}
                loading={loading}
                envVars={envVars}
                collectionVars={activeCol?.vars || {}}
                onUpdateCollectionVar={(key, val) => setCollections(cs => cs.map(c => c.id === activeCol?.id ? { ...c, vars: { ...c.vars, [key]: val } } : c))}
                onOpenCsvRunner={() => setCsvRunReq(csvRunReq ? null : activeReq)}
              />
            }
            bottom={
              csvRunReq && csvRunReq.id === activeId
                ? <InlineCsvRunner request={activeReq} envVars={envVars} collectionVars={activeCol?.vars || {}} onClose={() => setCsvRunReq(null)} />
                : <ResponseViewer response={responses[activeId]} loading={loading} elapsed={elapsed} />
            }
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#cbd5e1' }}>
            <div style={{ fontSize: 64 }}>⚡</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#94a3b8' }}>API Market</h2>
            <p style={{ fontSize: 13, color: '#cbd5e1' }}>Create or select a request to get started</p>
            <button onClick={() => newReq(null)} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.pu, color: '#fff' }}>+ New Request</button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showEnv && (
        <EnvPanel
          envs={envs} active={activeEnv}
          onSetActive={setActiveEnv}
          onUpdate={(id, vars) => setEnvs(es => es.map(e => e.id === id ? { ...e, vars } : e))}
          onAdd={() => { const e = { id: uid(), name: 'New Environment', vars: [{ id: uid(), key: '', value: '', enabled: true }] }; setEnvs(es => [...es, e]); setActiveEnv(e.id) }}
          onDelete={(id) => { setEnvs(es => es.filter(e => e.id !== id)); if (activeEnv === id) setActiveEnv(null) }}
          onClose={() => setShowEnv(false)}
        />
      )}

      {showHist && (
        <HistoryPanel
          history={history}
          onSelect={loadFromHistory}
          onClear={() => setHistory([])}
          onClose={() => setShowHist(false)}
        />
      )}

      {showBackend && (
        <BackendSettings
          onClose={() => setShowBackend(false)}
          onSaved={async () => { try { const r = await fetch(getApiUrl() + '/health', { signal: AbortSignal.timeout(4000) }); setBackendOk(r.ok) } catch { setBackendOk(false) } }}
        />
      )}

      {showIdTool && <IdExtractor onClose={() => setShowIdTool(false)} />}
      {showHealth  && <HealthPanel onClose={() => setShowHealth(false)} />}

      {runnerCol && (
        <CollectionRunner
          collection={runnerCol}
          envVars={envVars}
          onClose={() => setRunnerCol(null)}
        />
      )}
    </div>
  )
}
