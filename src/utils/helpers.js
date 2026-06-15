export const uid = () => Math.random().toString(36).slice(2, 10)

export const getApiUrl = () =>
  localStorage.getItem('apiforge_backend_url') ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

export function newRequest() {
  return {
    id: uid(), name: 'New Request', method: 'GET', url: '',
    headers:  [{ id: uid(), key: '', value: '', enabled: true }],
    params:   [{ id: uid(), key: '', value: '', enabled: true }],
    body: '', bodyType: 'json',
    auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' },
  }
}

export function newCollection(name = 'New Collection') {
  return { id: uid(), name, requests: [], vars: {} }
}

// ── Parse cURL command into request object ────────────────────────────────
export function parseCurl(str) {
  str = str.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim()
  const result = { method: 'GET', url: '', headers: [], body: '' }

  const mx = str.match(/-X\s+([A-Z]+)/)
  if (mx) result.method = mx[1]

  const ux = str.match(/--url\s+['"]?([^\s'"]+)['"]?/) ||
             str.match(/curl\s+(?:-[^\s]+\s+[^\s]+\s+)*['"]?([^\s'"]+)['"]?/)
  if (ux) result.url = ux[1].replace(/['"]/g, '')

  const hr = /-H\s+['"]([^'"]+)['"]/g
  let m
  while ((m = hr.exec(str)) !== null) {
    const [k, ...v] = m[1].split(':')
    if (k) result.headers.push({ id: uid(), key: k.trim(), value: v.join(':').trim(), enabled: true })
  }

  const bx = str.match(/(?:--data(?:-raw|-binary)?|-d)\s+['"]([^'"]+)['"]/)
  if (bx) { result.body = bx[1]; if (!mx) result.method = 'POST' }
  if (!result.headers.length) result.headers.push({ id: uid(), key: '', value: '', enabled: true })

  return result
}

// ── Parse Postman collection JSON ──────────────────────────────────────────
export function importPostmanCollection(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  const colName = data.info?.name || 'Imported'
  const requests = []

  const parseItem = (item) => {
    if (item.item && Array.isArray(item.item)) { item.item.forEach(parseItem); return }
    if (!item.request && !item.item) return

    const req = item.request || {}
    const url = typeof req.url === 'string' ? req.url : req.url?.raw || ''
    const headers = (req.header || []).map(h => ({ id: uid(), key: h.key || '', value: h.value || '', enabled: !h.disabled }))
    if (!headers.length) headers.push({ id: uid(), key: '', value: '', enabled: true })

    const params = (req.url?.query || []).map(q => ({ id: uid(), key: q.key || '', value: q.value || '', enabled: !q.disabled }))
    if (!params.length) params.push({ id: uid(), key: '', value: '', enabled: true })

    let body = '', bodyType = 'none'
    if (req.body) { bodyType = req.body.mode === 'raw' ? 'json' : req.body.mode || 'none'; body = req.body.raw || '' }

    requests.push({
      id: uid(), name: item.name || 'Request',
      method: req.method || 'GET', url, headers, params, body, bodyType,
      auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' },
    })
  }

  ;(data.item || []).forEach(parseItem)
  const vars = {}
  ;(data.variable || []).forEach(v => { if (v.key) vars[v.key] = v.value || '' })
  return { name: colName, requests, vars }
}

// ── Parse CSV string into array of row objects ─────────────────────────────
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || []
    const row = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim().replace(/^"|"$/g, '') })
    return row
  })
}

// ── Build cURL string from request ────────────────────────────────────────
export function buildCurl(request, resolvedUrl) {
  const nl = ' \\\n'
  const hdrs = request.headers
    .filter(h => h.enabled && h.key)
    .map(h => '  -H ' + JSON.stringify(h.key + ': ' + h.value))
    .join(nl)

  const auth = request.auth
  let authFlag = ''
  if (auth.type === 'bearer' && auth.token) authFlag = '  -H ' + JSON.stringify('Authorization: Bearer ' + auth.token) + nl
  if (auth.type === 'basic'  && auth.username) authFlag = '  -u ' + JSON.stringify(auth.username + ':' + auth.password) + nl
  if (auth.type === 'apikey' && auth.key && auth.in === 'header') authFlag = '  -H ' + JSON.stringify(auth.key + ': ' + auth.value) + nl

  const bodyFlag = request.body && request.bodyType !== 'none'
    ? '  -d ' + JSON.stringify(request.body) + nl : ''

  return 'curl -X ' + request.method + ' ' + JSON.stringify(resolvedUrl) + nl +
    authFlag + (hdrs ? hdrs + nl : '') + bodyFlag + '  --compressed'
}
