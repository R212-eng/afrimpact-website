// Thin fetch wrapper around the FastAPI backend.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

function qs(params = {}) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function request(method, path, { params, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}${qs(params)}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    let msg = data?.detail || `Request failed (${res.status})`
    if (Array.isArray(msg)) {
      msg = msg.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(', ')
    }
    throw new ApiError(msg, res.status, data)
  }
  return data
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

export const httpApi = {
  home: () => request('GET', '/home'),
  site: () => request('GET', '/site'),
  services: (category) => request('GET', '/services', { params: { category } }),

  opportunities: (params) => request('GET', '/opportunities', { params }),
  opportunityFilters: () => request('GET', '/opportunities/filters'),
  opportunity: (slug) => request('GET', `/opportunities/${slug}`),
  expressInterest: (slug, body) => request('POST', `/opportunities/${slug}/interest`, { body }),
  requestItinerary: (slug, body) => request('POST', `/opportunities/${slug}/itinerary`, { body }),

  news: (params) => request('GET', '/news', { params }),
  newsCategories: () => request('GET', '/news/categories'),
  featuredNews: () => request('GET', '/news/featured'),
  article: (slug) => request('GET', `/news/${slug}`),
  like: (slug) => request('POST', `/news/${slug}/like`),
  unlike: (slug) => request('POST', `/news/${slug}/unlike`),
  share: (slug) => request('POST', `/news/${slug}/share`),

  events: (when = 'upcoming') => request('GET', '/events', { params: { when } }),
  event: (slug) => request('GET', `/events/${slug}`),
  registerEvent: (slug, body) => request('POST', `/events/${slug}/register`, { body }),

  contact: (body) => request('POST', '/contact', { body }),
  consultation: (body) => request('POST', '/consultations', { body }),
  newsletter: (body) => request('POST', '/newsletter', { body }),
  writeForUs: (body) => request('POST', '/write-for-us', { body }),
  track: (body) => request('POST', '/track', { body }).catch(() => null),

  // ---- admin portal (token from adminLogin, sent as Bearer)
  adminLogin: (body) => request('POST', '/admin/login', { body }),
  adminMe: (t) => request('GET', '/admin/me', { headers: auth(t) }),
  adminStats: (t) => request('GET', '/admin/stats', { headers: auth(t) }),
  adminSubmissions: (t, kind, params) => request('GET', `/admin/submissions/${kind}`, { headers: auth(t), params }),
  adminByEvent: (t) => request('GET', '/admin/registrations/by-event', { headers: auth(t) }),
  adminSetStatus: (t, kind, id, status) =>
    request('PATCH', `/admin/submissions/${kind}/${id}`, { headers: auth(t), params: { status } }),
  adminToggleSubscriber: (t, id, active) => request('PATCH', `/admin/newsletter/${id}`, { headers: auth(t), params: { active } }),
  adminApprovePitch: (t, id, note) => request('POST', `/admin/pitches/${id}/approve`, { headers: auth(t), body: { note } }),
  adminRejectPitch: (t, id, note) => request('POST', `/admin/pitches/${id}/reject`, { headers: auth(t), body: { note } }),
  adminEmail: (t) => request('GET', '/admin/email', { headers: auth(t) }),
  adminEmailTest: (t) => request('POST', '/admin/email/test', { headers: auth(t) }),
  adminUpload: async (t, file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/admin/upload`, { method: 'POST', headers: auth(t), body: fd })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(data?.detail || 'Upload failed', res.status)
    return data
  },
  adminContent: (t, kind) => request('GET', `/admin/content/${kind}`, { headers: auth(t) }),
  adminGet: (t, kind, id) => request('GET', `/admin/content/${kind}/${id}`, { headers: auth(t) }),
  adminCreate: (t, kind, body) => request('POST', `/admin/content/${kind}`, { headers: auth(t), body }),
  adminUpdate: (t, kind, id, body) => request('PUT', `/admin/content/${kind}/${id}`, { headers: auth(t), body }),
  adminDelete: (t, kind, id) => request('DELETE', `/admin/content/${kind}/${id}`, { headers: auth(t) }),
  adminSendNewsletter: (t, id) => request('POST', `/admin/news/${id}/send-newsletter`, { headers: auth(t) }),
  adminExportCsv: async (t, kind, params = {}) => {
    const res = await fetch(`${BASE}/admin/submissions/${kind}/export.csv${qs(params)}`, { headers: auth(t) })
    if (!res.ok) throw new ApiError('Export failed', res.status)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(await res.blob())
    a.download = `afrimpact-${kind}.csv`
    a.click()
  },
}
