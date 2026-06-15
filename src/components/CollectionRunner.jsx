import { useState, useRef } from 'react'
import { C, MC, SC } from '../constants.jsx'
import { getApiUrl, parseCSV } from '../utils/helpers.js'

export default function CollectionRunner({ collection, envVars, onClose }) {
  const [iterations,  setIterations]  = useState(1)
  const [delay,       setDelay]       = useState(0)
  const [running,     setRunning]     = useState(false)
  const [results,     setResults]     = useState([])
  const [current,     setCurrent]     = useState(null)
  const [csvRows,     setCsvRows]     = useState([])
  const [csvHeaders,  setCsvHeaders]  = useState([])
  const [csvFile,     setCsvFile]     = useState(null)
  const [selectedReqs, setSelectedReqs] = useState(() => new Set(collection.requests.map(r => r.id)))
  const abortRef = useRef(false)
  const csvRef   = useRef(null)

  const colVars = collection.vars || {}
  const resolve = (s, rv = {}) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => rv[k] ?? colVars[k] ?? envVars[k] ?? `{{${k}}}`)

  // Auto-detect vars from all requests
  const apiVars = [...new Set(
    collection.requests.flatMap(req => {
      const text = [req.url, req.body || '', ...(req.headers || []).map(h => h.key + ' ' + h.value), ...(req.params || []).map(p => p.key + ' ' + p.value)].join(' ')
      return [...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
    })
  )]

  const handleCSV = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setCsvFile(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result)
      setCsvRows(rows); setCsvHeaders(rows.length ? Object.keys(rows[0]) : [])
      setIterations(rows.length || 1)
    }
    reader.readAsText(file); e.target.value = ''
  }

  const runAll = async () => {
    setRunning(true); setResults([]); abortRef.current = false
    const reqsToRun = collection.requests.filter(r => selectedReqs.has(r.id))
    const totalIter = csvRows.length > 0 ? csvRows.length : iterations
    const all = []

    for (let iter = 1; iter <= totalIter; iter++) {
      if (abortRef.current) break
      const rowVars = csvRows.length > 0 ? csvRows[iter - 1] : {}
      const ir = { iter, requests: [], rowVars }

      for (let ri = 0; ri < reqsToRun.length; ri++) {
        if (abortRef.current) break
        const req = reqsToRun[ri]
        setCurrent({ iter, reqIdx: ri })
        const t0 = Date.now()
        let status = 0, statusText = '', passed = false, error = null

        try {
          let url = resolve(req.url, rowVars)
          const en = (req.params || []).filter(p => p.enabled && p.key)
          if (en.length) {
            const qs = en.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(resolve(p.value, rowVars))}`).join('&')
            url = url + (url.includes('?') ? '&' : '?') + qs
          }
          const hdrs = {}
          ;(req.headers || []).filter(h => h.enabled && h.key).forEach(h => { hdrs[h.key] = resolve(h.value, rowVars) })
          const auth = req.auth || {}
          if (auth.type === 'bearer' && auth.token) hdrs['Authorization'] = 'Bearer ' + resolve(auth.token, rowVars)
          if (auth.type === 'basic'  && auth.username) hdrs['Authorization'] = 'Basic ' + btoa(auth.username + ':' + auth.password)
          if (auth.type === 'apikey' && auth.key && auth.in === 'header') hdrs[auth.key] = auth.value

          let body = undefined
          if (!['GET', 'HEAD'].includes(req.method) && req.bodyType !== 'none' && req.body) {
            hdrs['Content-Type'] = 'application/json'; body = resolve(req.body, rowVars)
          }

          const r = await fetch(getApiUrl() + '/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, method: req.method, headers: hdrs, body }) })
          const d = await r.json()
          status = d.status; statusText = d.status_text; passed = status >= 200 && status < 300
        } catch (e) { error = e.message; passed = false }

        ir.requests.push({ name: req.name, method: req.method, status, statusText, passed, error, elapsed: Date.now() - t0 })
        if (delay > 0) await new Promise(r => setTimeout(r, delay))
      }

      all.push(ir); setResults([...all])
    }

    setCurrent(null); setRunning(false)
  }

  const totReqs = results.flatMap(r => r.requests)
  const passed  = totReqs.filter(r => r.passed).length
  const failed  = totReqs.filter(r => !r.passed).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget && !running) onClose() }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, width: 'min(920px,95vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>▶</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Collection Runner</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{collection.name} · {collection.requests.length} requests</div>
            </div>
          </div>
          {!running && <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>✕</button>}
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left panel */}
          <div style={{ width: 240, borderRight: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, overflowY: 'auto' }}>

            {/* CSV Upload */}
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Data File (CSV)</label>
              <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} />
              <button onClick={() => csvRef.current?.click()} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px dashed ' + C.border, background: csvFile ? 'rgba(124,106,247,0.04)' : '#f8f8fc', color: csvFile ? C.pu : '#94a3b8', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {csvFile ? '📄 ' + csvFile : '↑ Upload CSV'}
              </button>
              {csvHeaders.length > 0 && (
                <div style={{ marginTop: 8, padding: '7px 9px', background: '#f8f8fc', border: `1px solid ${C.border}`, borderRadius: 7 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5 }}>Column mapping:</div>
                  {apiVars.map(v => (
                    <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontFamily: C.mono, fontSize: 10, color: C.pu }}>{`{{${v}}}`}</span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>→</span>
                      {csvHeaders.includes(v)
                        ? <span style={{ fontSize: 10, color: C.green, fontFamily: C.mono }}>✓ {v}</span>
                        : <span style={{ fontSize: 10, color: C.red }}>⚠ missing</span>}
                    </div>
                  ))}
                </div>
              )}
              {csvFile && <button onClick={() => { setCsvFile(null); setCsvRows([]); setCsvHeaders([]); setIterations(1) }} style={{ marginTop: 4, fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕ Remove</button>}
            </div>

            {/* Iterations */}
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Iterations {csvRows.length > 0 && <span style={{ color: C.pu, fontWeight: 400, textTransform: 'none' }}>({csvRows.length} from CSV)</span>}
              </label>
              <input type="number" min={1} max={1000} value={iterations} onChange={e => setIterations(Number(e.target.value))} disabled={csvRows.length > 0}
                style={{ width: '100%', background: '#f8f8fc', border: '1.5px solid ' + C.border, borderRadius: 7, padding: '7px 10px', fontSize: 13, color: csvRows.length > 0 ? '#94a3b8' : '#1a1a2e', outline: 'none', fontFamily: C.mono, boxSizing: 'border-box' }} />
            </div>

            {/* Delay */}
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Delay (ms)</label>
              <input type="number" min={0} max={10000} value={delay} onChange={e => setDelay(Number(e.target.value))}
                style={{ width: '100%', background: '#f8f8fc', border: '1.5px solid ' + C.border, borderRadius: 7, padding: '7px 10px', fontSize: 13, color: '#1a1a2e', outline: 'none', fontFamily: C.mono, boxSizing: 'border-box' }} />
            </div>

            {/* Request selector */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Requests</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setSelectedReqs(new Set(collection.requests.map(r => r.id)))} style={{ fontSize: 10, color: C.pu, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>All</button>
                  <button onClick={() => setSelectedReqs(new Set())} style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>None</button>
                </div>
              </div>
              {collection.requests.map((req, i) => {
                const mc  = MC[req.method] || MC.GET
                const sel = selectedReqs.has(req.id)
                const isActive = current && current.reqIdx === i
                return (
                  <div key={req.id} onClick={() => { if (!running) { const s = new Set(selectedReqs); sel ? s.delete(req.id) : s.add(req.id); setSelectedReqs(s) } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer', opacity: running && !isActive ? 0.45 : 1 }}>
                    <input type="checkbox" checked={sel} onChange={() => {}} style={{ accentColor: C.pu, flexShrink: 0 }} />
                    {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, flexShrink: 0, animation: 'pulse 1s infinite' }} />}
                    <span style={{ fontSize: 9, fontWeight: 700, color: mc.text, background: mc.bg, border: `1px solid ${mc.border}`, borderRadius: 3, padding: '1px 4px', fontFamily: C.mono, flexShrink: 0 }}>{req.method}</span>
                    <span style={{ fontSize: 11, color: sel ? '#1a1a2e' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.name}</span>
                  </div>
                )
              })}
            </div>

            {!running
              ? <button onClick={runAll} style={{ width: '100%', padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.green, color: '#fff' }}>▶ Run All</button>
              : <button onClick={() => abortRef.current = true} style={{ width: '100%', padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.red, color: '#fff' }}>⏹ Stop</button>
            }
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

            {totReqs.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, padding: '10px 14px', background: '#f8f8fc', border: `1px solid ${C.border}`, borderRadius: 10, alignItems: 'center' }}>
                {[['Total', totReqs.length, '#1a1a2e'], ['Passed', passed, C.green], ['Failed', failed, C.red]].map(([l, v, c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c, background: c + '12', borderRadius: 5, padding: '2px 8px', fontFamily: C.mono }}>{v}</span>
                  </div>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{running ? `Running ${results.length + 1}/${csvRows.length || iterations}…` : `${results.length}/${csvRows.length || iterations} done`}</span>
              </div>
            )}

            {results.length === 0 && !running && (
              <div style={{ textAlign: 'center', padding: 40, color: '#cbd5e1' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>▶</div>
                <p style={{ fontSize: 13 }}>Click Run All to start</p>
              </div>
            )}

            {results.map(iter => (
              <div key={iter.iter} style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: '#f8f8fc', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Iteration {iter.iter}</span>
                  {iter.rowVars && Object.keys(iter.rowVars).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {Object.entries(iter.rowVars).map(([k, v]) => (
                        <span key={k} style={{ fontSize: 10, fontFamily: C.mono, background: 'rgba(124,106,247,0.08)', border: '1px solid rgba(124,106,247,0.2)', borderRadius: 4, padding: '1px 6px', color: C.pu }}>{k}={v}</span>
                      ))}
                    </div>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      {['Request', 'Method', 'Status', 'Result', 'Time'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {iter.requests.map((r, i) => {
                      const mc = MC[r.method] || MC.GET
                      const sc = SC(r.status)
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: '#1a1a2e', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                          <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 9, fontWeight: 700, color: mc.text, background: mc.bg, border: `1px solid ${mc.border}`, borderRadius: 3, padding: '1px 5px', fontFamily: C.mono }}>{r.method}</span></td>
                          <td style={{ padding: '8px 12px' }}>
                            {r.status > 0
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: sc + '15', border: `1px solid ${sc}55`, borderRadius: 5, padding: '2px 8px', fontFamily: C.mono }}>{r.status} {r.statusText}</span>
                              : <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {r.error
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 5, padding: '3px 10px' }}>✗ Error</span>
                              : r.passed
                                ? <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 5, padding: '3px 10px' }}>✓ Passed</span>
                                : <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 5, padding: '3px 10px' }}>✗ Failed</span>}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#94a3b8', fontFamily: C.mono }}>{r.elapsed}ms</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
