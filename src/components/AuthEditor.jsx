import { useState } from 'react'
import { C } from '../constants.js'

function BearerInput({ value, onChange, inp }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Bearer token"
        style={{ ...inp, paddingRight: 36 }}
      />
      <button onClick={() => setShow(v => !v)} style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: 0,
      }} title={show ? 'Hide token' : 'Show token'}>
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}

export default function AuthEditor({ auth, onChange }) {
  const set = (k, v) => onChange({ ...auth, [k]: v })
  const inp = {
    background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8,
    padding: '9px 12px', fontSize: 13, color: '#1a1a2e', outline: 'none',
    fontFamily: C.mono, width: '100%', boxSizing: 'border-box',
  }
  const btn = (t) => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    border: auth.type === t ? `1.5px solid ${C.pu}` : `1px solid ${C.border}`,
    background: auth.type === t ? 'rgba(124,106,247,0.08)' : '#fff',
    color: auth.type === t ? C.pu : '#64748b',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['none','None'], ['bearer','Bearer Token'], ['basic','Basic Auth'], ['apikey','API Key']].map(([t, label]) => (
          <button key={t} onClick={() => set('type', t)} style={btn(t)}>{label}</button>
        ))}
      </div>

      {auth.type === 'bearer' && (
        <input value={auth.token} onChange={e => set('token', e.target.value)} placeholder="Bearer token" style={inp} />
      )}

      {auth.type === 'basic' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={auth.username} onChange={e => set('username', e.target.value)} placeholder="Username" style={{ ...inp, flex: 1 }} />
          <input type="password" value={auth.password} onChange={e => set('password', e.target.value)} placeholder="Password" style={{ ...inp, flex: 1 }} />
        </div>
      )}

      {auth.type === 'apikey' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={auth.key}   onChange={e => set('key',   e.target.value)} placeholder="Key"   style={{ ...inp, flex: 1 }} />
          <input value={auth.value} onChange={e => set('value', e.target.value)} placeholder="Value" style={{ ...inp, flex: 2 }} />
          <select value={auth.in} onChange={e => set('in', e.target.value)} style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 12, color: '#1a1a2e', outline: 'none' }}>
            <option value="header">Header</option>
            <option value="query">Query</option>
          </select>
        </div>
      )}
    </div>
  )
}
