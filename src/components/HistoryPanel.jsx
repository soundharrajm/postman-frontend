import { C, MC, SC } from '../constants.jsx'

export default function HistoryPanel({ history, onSelect, onClear, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 380, height: '100vh', background: '#fff', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.08)' }}>

        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>History</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {history.length > 0 && (
              <button onClick={onClear} style={{ fontSize: 11, color: C.red, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        </div>

        {history.length === 0
          ? <div style={{ padding: 40, fontSize: 12, color: '#cbd5e1', textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🕐</div>No history yet</div>
          : <div style={{ flex: 1, overflowY: 'auto' }}>
              {history.map((h, i) => {
                const mc = MC[h.method] || MC.GET
                const sc = SC(h.status)
                return (
                  <div key={i} onClick={() => { onSelect(h); onClose() }}
                    style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f8fc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: mc.text, background: mc.bg, border: `1px solid ${mc.border}`, borderRadius: 3, padding: '1px 4px', fontFamily: C.mono }}>{h.method}</span>
                      {h.status && <span style={{ fontSize: 10, fontWeight: 700, color: sc, fontFamily: C.mono }}>{h.status}</span>}
                      <span style={{ fontSize: 10, color: '#cbd5e1', marginLeft: 'auto' }}>{h.time}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: C.mono, marginBottom: 3 }}>{h.url}</div>
                    <div style={{ fontSize: 10, color: C.pu }}>Click to load →</div>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}
