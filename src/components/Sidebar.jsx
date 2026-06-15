import { useState } from 'react'
import { C, MC } from '../constants.jsx'

export default function Sidebar({ collections, activeId, onSelect, onNew, onNewCollection, onDeleteRequest, onRenameCollection, onDeleteCollection, onImport, onRun, onExport }) {
  const [exp,     setExp]     = useState(() => { const e = {}; collections.forEach(c => { e[c.id] = true }); return e })
  const [editCol, setEditCol] = useState(null)
  const [colName, setColName] = useState('')
  const toggle = (id) => setExp(e => ({ ...e, [id]: !e[id] }))

  return (
    <div style={{ width: 240, flexShrink: 0, background: '#f8f8fc', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '.5px', textTransform: 'uppercase' }}>Collections</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onImport} title="Import Postman JSON" style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
          <button onClick={onNewCollection} title="New collection" style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: '#94a3b8', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {collections.length === 0 && (
          <div style={{ padding: 20, fontSize: 12, color: '#cbd5e1', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>No collections yet
          </div>
        )}

        {collections.map(col => (
          <div key={col.id}>
            {/* Collection row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px 7px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
              onDoubleClick={() => { setEditCol(col.id); setColName(col.name) }}>
              <span onClick={() => toggle(col.id)} style={{ fontSize: 10, color: '#94a3b8', marginRight: 6, transform: exp[col.id] ? 'rotate(90deg)' : '', display: 'inline-block', transition: 'transform .15s' }}>▶</span>

              {editCol === col.id
                ? <input autoFocus value={colName}
                    onChange={e => setColName(e.target.value)}
                    onBlur={() => { onRenameCollection(col.id, colName); setEditCol(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { onRenameCollection(col.id, colName); setEditCol(null) } if (e.key === 'Escape') setEditCol(null) }}
                    style={{ flex: 1, background: 'rgba(124,106,247,0.08)', border: `1.5px solid ${C.pu}`, borderRadius: 4, padding: '2px 6px', fontSize: 12, color: '#1a1a2e', outline: 'none', fontFamily: 'inherit' }} />
                : <span onClick={() => toggle(col.id)} style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</span>
              }

              <div style={{ display: 'flex', gap: 3 }}>
                <button onClick={() => onRun(col.id)}    title="Run collection" style={{ width: 20, height: 20, border: 'none', background: 'none', color: C.green,   fontSize: 11, cursor: 'pointer' }}>▶</button>
                <button onClick={() => onExport(col)}    title="Export JSON"    style={{ width: 20, height: 20, border: 'none', background: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>↓</button>
                <button onClick={() => onNew(col.id)}    title="Add request"    style={{ width: 20, height: 20, border: 'none', background: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>+</button>
                <button onClick={() => onDeleteCollection(col.id)} title="Delete" style={{ width: 20, height: 20, border: 'none', background: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>

            {/* Requests */}
            {exp[col.id] && col.requests.map(req => {
              const mc = MC[req.method] || MC.GET
              const active = activeId === req.id
              return (
                <div key={req.id} onClick={() => onSelect(req.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 28px', cursor: 'pointer', background: active ? 'rgba(124,106,247,0.08)' : 'transparent', borderLeft: active ? `2.5px solid ${C.pu}` : '2.5px solid transparent' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: mc.text, background: mc.bg, border: `1px solid ${mc.border}`, borderRadius: 3, padding: '1px 4px', flexShrink: 0, fontFamily: C.mono }}>{req.method}</span>
                  <span style={{ flex: 1, fontSize: 11, color: active ? '#1a1a2e' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.name}</span>
                  <button onClick={e => { e.stopPropagation(); onDeleteRequest(col.id, req.id) }}
                    style={{ width: 16, height: 16, border: 'none', background: 'none', color: '#cbd5e1', fontSize: 10, cursor: 'pointer', borderRadius: 3 }}
                    onMouseEnter={e => e.currentTarget.style.color = C.red}
                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>✕</button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => onNew(collections[0]?.id)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1.5px dashed ${C.border}`, background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          + New Request
        </button>
      </div>
    </div>
  )
}
