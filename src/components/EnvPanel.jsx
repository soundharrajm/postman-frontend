import { C } from '../constants.jsx'
import { uid } from '../utils/helpers.js'
import KeyValueEditor from './KeyValueEditor.jsx'

export default function EnvPanel({ envs, active, onSetActive, onUpdate, onAdd, onDelete, onClose }) {
  const ae = envs.find(e => e.id === active)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, width: 700, maxHeight: '80vh', display: 'flex', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>

        {/* Left: env list */}
        <div style={{ width: 200, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>Environments</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {envs.map(e => (
              <div key={e.id} onClick={() => onSetActive(e.id)}
                style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: active === e.id ? 'rgba(124,106,247,0.08)' : 'transparent', borderLeft: active === e.id ? `2.5px solid ${C.pu}` : '2.5px solid transparent' }}>
                <span style={{ fontSize: 12, color: active === e.id ? '#1a1a2e' : '#64748b' }}>{e.name}</span>
                <button onClick={ev => { ev.stopPropagation(); onDelete(e.id) }} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ padding: 10 }}>
            <button onClick={onAdd} style={{ width: '100%', padding: '7px', borderRadius: 7, border: `1.5px dashed ${C.border}`, background: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ New Environment</button>
          </div>
        </div>

        {/* Right: variables */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{ae ? ae.name : 'Select an environment'}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          {ae && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <KeyValueEditor rows={ae.vars} onChange={vars => onUpdate(active, vars)} placeholder={['Variable', 'Value']} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
