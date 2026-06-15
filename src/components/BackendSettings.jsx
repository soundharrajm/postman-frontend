import { useState } from 'react'
import { C } from '../constants.js'
import { getApiUrl } from '../utils/helpers.js'

export default function BackendSettings({ onClose, onSaved }) {
  const envUrl   = import.meta.env.VITE_API_URL || ''
  const savedUrl = localStorage.getItem('apiforge_backend_url') || ''

  const [url,     setUrl]     = useState(savedUrl || envUrl)
  const [status,  setStatus]  = useState(null)
  const [testing, setTesting] = useState(false)
  const isUsingEnv = !savedUrl && !!envUrl

  const test = async () => {
    setTesting(true); setStatus(null)
    try {
      const r = await fetch((url || envUrl) + '/health', { signal: AbortSignal.timeout(5000) })
      const d = await r.json()
      setStatus({ ok: true, msg: 'Connected ✓  (' + (d.runtime || 'ok') + ')' })
    } catch (e) {
      setStatus({ ok: false, msg: 'Failed: ' + e.message })
    } finally { setTesting(false) }
  }

  const save = () => {
    const c = (url || envUrl).replace(/\/$/, '')
    localStorage.setItem('apiforge_backend_url', c)
    if (onSaved) onSaved()
    onClose()
  }

  const reset = () => {
    localStorage.removeItem('apiforge_backend_url')
    setUrl(envUrl)
    setStatus(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, width: 500, boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(124,106,247,0.1)', border: `1px solid rgba(124,106,247,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🔗</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Backend URL</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Your APIforge backend on Vercel</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Backend URL</label>
          {isUsingEnv && <span style={{ fontSize: 10, color: C.green, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 4, padding: '2px 7px' }}>From Vercel env</span>}
          {!isUsingEnv && savedUrl && <button onClick={reset} style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>↩ Reset to env default</button>}
        </div>

        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder={envUrl || 'https://your-backend.vercel.app'}
          style={{ width: '100%', background: '#f8f8fc', border: `1.5px solid ${isUsingEnv ? 'rgba(22,163,74,0.3)' : C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#1a1a2e', outline: 'none', fontFamily: C.mono, boxSizing: 'border-box', marginBottom: 10 }} />

        {isUsingEnv && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Using Vercel environment variable. Edit above to override.</div>}

        {status && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: C.mono, background: status.ok ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${status.ok ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`, color: status.ok ? C.green : C.red }}>
            {status.msg}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 18, lineHeight: 1.6 }}>
          Deploy the backend to Vercel and paste its URL here.<br />
          Example: <span style={{ color: C.pu, fontFamily: C.mono }}>https://apiforge-backend-xxx.vercel.app</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={test} disabled={testing || !url.trim()} style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: '#f8f8fc', color: '#64748b' }}>
            {testing ? '⏳ Testing…' : '🔌 Test Connection'}
          </button>
          <button onClick={save} disabled={!url.trim()} style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.pu, color: '#fff' }}>
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  )
}
