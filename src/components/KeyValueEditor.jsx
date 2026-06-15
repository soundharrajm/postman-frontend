import { C, uid } from '../constants.js'
import { uid as makeId } from '../utils/helpers.js'

export default function KeyValueEditor({ rows, onChange, placeholder = ['Key', 'Value'] }) {
  const update = (id, field, val) => onChange(rows.map(r => r.id === id ? { ...r, [field]: val } : r))
  const add    = () => onChange([...rows, { id: makeId(), key: '', value: '', enabled: true }])
  const remove = (id) => onChange(rows.filter(r => r.id !== id))

  const inp = {
    background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 7,
    padding: '7px 10px', fontSize: 12, color: '#1a1a2e', outline: 'none', fontFamily: C.mono,
  }

  return (
    <div>
      {rows.map(row => (
        <div key={row.id} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'center' }}>
          <input type="checkbox" checked={row.enabled} onChange={e => update(row.id, 'enabled', e.target.checked)} style={{ accentColor: C.pu, flexShrink: 0 }} />
          <input value={row.key}   onChange={e => update(row.id, 'key',   e.target.value)} placeholder={placeholder[0]} style={{ ...inp, flex: 1 }} />
          <input value={row.value} onChange={e => update(row.id, 'value', e.target.value)} placeholder={placeholder[1]} style={{ ...inp, flex: 2 }} />
          <button onClick={() => remove(row.id)} style={{ width: 24, height: 24, border: 'none', background: 'rgba(220,38,38,0.08)', borderRadius: 5, color: C.red, cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>+ Add row</button>
    </div>
  )
}
