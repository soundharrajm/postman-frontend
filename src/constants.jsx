export const C = {
  bg:     '#ffffff',
  panel:  '#f8f8fc',
  card:   '#f0f0f8',
  border: 'rgba(0,0,0,0.08)',
  pu:     '#7c6af7',
  pu2:    '#6055e0',
  green:  '#16a34a',
  red:    '#dc2626',
  amber:  '#d97706',
  blue:   '#2563eb',
  mono:   "'JetBrains Mono', monospace",
  text:   '#1a1a2e',
  muted:  '#64748b',
}

export const MC = {
  GET:    { bg:'rgba(22,163,74,0.1)',   border:'rgba(22,163,74,0.3)',   text:'#15803d' },
  POST:   { bg:'rgba(124,58,237,0.1)',  border:'rgba(124,58,237,0.3)',  text:'#7c3aed' },
  PUT:    { bg:'rgba(217,119,6,0.1)',   border:'rgba(217,119,6,0.3)',   text:'#b45309' },
  PATCH:  { bg:'rgba(37,99,235,0.1)',   border:'rgba(37,99,235,0.3)',   text:'#1d4ed8' },
  DELETE: { bg:'rgba(220,38,38,0.1)',   border:'rgba(220,38,38,0.3)',   text:'#b91c1c' },
  HEAD:   { bg:'rgba(100,116,139,0.1)', border:'rgba(100,116,139,0.3)', text:'#475569' },
  OPTIONS:{ bg:'rgba(236,72,153,0.1)',  border:'rgba(236,72,153,0.3)',  text:'#be185d' },
}

export const METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']

export const SC = (s) => !s ? '#94a3b8' : s < 300 ? '#16a34a' : s < 400 ? '#2563eb' : s < 500 ? '#d97706' : '#dc2626'

export const STORAGE_KEYS = {
  collections: 'apiforge_collections',
  envs:        'apiforge_envs',
  history:     'apiforge_history',
}
