import { useState, useRef } from 'react'
import { C, SC } from '../constants.jsx'
import { getApiUrl, parseCSV } from '../utils/helpers.js'

export default function InlineCsvRunner({ request, envVars, collectionVars, onClose }) {
  const [csvRows,    setCsvRows]    = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvFile,    setCsvFile]    = useState(null)
  const [running,    setRunning]    = useState(false)
  const [results,    setResults]    = useState([])
  const [delay,      setDelay]      = useState(0)
  const [expandedRow, setExpandedRow] = useState(null)  // row index
  const abortRef = useRef(false)
  const csvRef   = useRef(null)

  const allText = [request.url, ...(request.headers || []).map(h => h.key + ' ' + h.value), ...(request.params || []).map(p => p.key + ' ' + p.value), request.body || ''].join(' ')
  const apiVars = [...new Set([...allText.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]

  const resolve = (s, rv) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => rv[k] ?? collectionVars[k] ?? envVars[k] ?? `{{${k}}}`)

  const handleCSV = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setCsvFile(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => { const rows = parseCSV(ev.target.result); setCsvRows(rows); setCsvHeaders(rows.length ? Object.keys(rows[0]) : []) }
    reader.readAsText(file); e.target.value = ''
  }

  const runAll = async () => {
    setRunning(true); setResults([]); setExpandedRow(null); abortRef.current = false
    const rows = csvRows.length > 0 ? csvRows : [{}]
    const all = []

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break
      const rv = rows[i]; const t0 = Date.now()
      let status = 0, statusText = '', passed = false, error = null, rawBody = null

      try {
        let url = resolve(request.url, rv)
        const en = (request.params || []).filter(p => p.enabled && p.key)
        if (en.length) {
          const qs = en.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(resolve(p.value, rv))}`).join('&')
          url = url + (url.includes('?') ? '&' : '?') + qs
        }
        const hdrs = {}
        ;(request.headers || []).filter(h => h.enabled && h.key).forEach(h => { hdrs[h.key] = resolve(h.value, rv) })
        const auth = request.auth || {}
        if (auth.type === 'bearer' && auth.token) hdrs['Authorization'] = 'Bearer ' + resolve(auth.token, rv)
        if (auth.type === 'basic'  && auth.username) hdrs['Authorization'] = 'Basic ' + btoa(auth.username + ':' + auth.password)
        if (auth.type === 'apikey' && auth.key && auth.in === 'header') hdrs[auth.key] = auth.value

        let body = undefined
        if (!['GET', 'HEAD'].includes(request.method) && request.bodyType !== 'none' && request.body) {
          hdrs['Content-Type'] = 'application/json'; body = resolve(request.body, rv)
        }

        const r = await fetch(getApiUrl() + '/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, method: request.method, headers: hdrs, body }) })
        const d = await r.json()
        status = d.status; statusText = d.status_text; passed = status >= 200 && status < 300
        rawBody = d.body ?? null
      } catch (e) { error = e.message; passed = false }

      all.push({ row: i + 1, rowVars: rv, status, statusText, passed, error, elapsed: Date.now() - t0, rawBody })
      setResults([...all])
      if (delay > 0 && i < rows.length - 1) await new Promise(r => setTimeout(r, delay))
    }
    setRunning(false)
  }

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, background: '#f8f8fc', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.pu }}>📊 CSV Run</span>
        <div style={{ height: 14, width: 1, background: C.border }} />

        <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} />
        <button onClick={() => csvRef.current?.click()} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: csvFile ? 'rgba(124,106,247,0.06)' : '#fff', color: csvFile ? C.pu : '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>
          {csvFile ? '📄 ' + csvFile : '↑ Upload CSV'}
        </button>

        {csvHeaders.length > 0 && apiVars.map(v => (
          <span key={v} style={{ fontSize: 10, fontFamily: C.mono, padding: '2px 6px', borderRadius: 4, background: csvHeaders.includes(v) ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${csvHeaders.includes(v) ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`, color: csvHeaders.includes(v) ? C.green : C.red }}>
            {`{{${v}}}`} {csvHeaders.includes(v) ? '✓' : '✗'}
          </span>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <label style={{ fontSize: 11, color: '#94a3b8' }}>Delay(ms)</label>
          <input type="number" min={0} max={5000} value={delay} onChange={e => setDelay(Number(e.target.value))}
            style={{ width: 60, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 6px', fontSize: 11, fontFamily: C.mono, outline: 'none' }} />
          {!running
            ? <button onClick={runAll} style={{ padding: '5px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.green, color: '#fff' }}>▶ Run {csvRows.length > 0 ? csvRows.length + ' rows' : ''}</button>
            : <button onClick={() => abortRef.current = true} style={{ padding: '5px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.red, color: '#fff' }}>⏹ Stop</button>}
          <button onClick={onClose} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: '#fff', color: '#94a3b8' }}>✕ Close</button>
        </div>
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '6px 16px', borderBottom: `1px solid ${C.border}`, background: '#fafafa', flexShrink: 0, alignItems: 'center' }}>
          {[['Total', results.length, '#1a1a2e'], ['Passed', passed, C.green], ['Failed', failed, C.red]].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{l}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c, background: c + '12', borderRadius: 5, padding: '1px 8px', fontFamily: C.mono }}>{v}</span>
            </div>
          ))}
          {running && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Running {results.length}/{csvRows.length}…</span>}
        </div>
      )}

      {/* Results table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.length === 0 && !running && (
          <div style={{ textAlign: 'center', padding: 40, color: '#cbd5e1' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <p style={{ fontSize: 13 }}>{csvFile ? `Ready to run ${csvRows.length} rows — click ▶ Run` : 'Upload a CSV file to run this request with multiple values'}</p>
          </div>
        )}
        {results.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8f8fc', zIndex: 1 }}>
              <tr>
                {['#', 'Vars', 'Status', 'Result', 'Time'].map(h => (
                  <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const sc = SC(r.status)
                const isOpen = expandedRow === i

                // pretty print body
                let prettyBody = r.rawBody ?? ''
                try { prettyBody = JSON.stringify(JSON.parse(prettyBody), null, 2) } catch {}

                return (
                  <>
                    <tr key={i}
                      onClick={() => setExpandedRow(isOpen ? null : i)}
                      style={{ borderBottom: isOpen ? 'none' : `1px solid ${C.border}`, cursor: 'pointer', background: isOpen ? 'rgba(124,106,247,0.03)' : 'transparent' }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f8f8fc' }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8', fontFamily: C.mono, width: 40 }}>
                        <span style={{ marginRight: 4, fontSize: 10 }}>{isOpen ? '▾' : '▸'}</span>{r.row}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Object.entries(r.rowVars || {}).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 10, fontFamily: C.mono, background: 'rgba(124,106,247,0.06)', border: '1px solid rgba(124,106,247,0.15)', borderRadius: 3, padding: '1px 5px', color: C.pu }}>{k}=<b>{v}</b></span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        {r.status > 0
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: sc + '12', border: `1px solid ${sc}30`, borderRadius: 5, padding: '2px 8px', fontFamily: C.mono }}>{r.status} {r.statusText}</span>
                          : <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        {r.error
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 5, padding: '3px 9px' }}>✗ Error</span>
                          : r.passed
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 5, padding: '3px 9px' }}>✓ Passed</span>
                            : <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 5, padding: '3px 9px' }}>✗ Failed</span>}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 11, color: '#94a3b8', fontFamily: C.mono }}>{r.elapsed}ms</td>
                    </tr>

                    {isOpen && (
                      <tr key={i + '-body'}>
                        <td colSpan={5} style={{ padding: 0, borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ background: '#f8f8fc', borderTop: `1px solid ${C.border}`, padding: '10px 16px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Response body</div>
                            <pre style={{ margin: 0, fontSize: 11, fontFamily: C.mono, color: '#1a1a2e', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 260, overflowY: 'auto', lineHeight: 1.6 }}>
                              {prettyBody || (r.error ? `Error: ${r.error}` : '(empty)')}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
