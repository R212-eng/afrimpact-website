// In-browser implementation of the API used by the static demo build.
// It mirrors the FastAPI responses so pages work identically with or without
// the backend. Submissions are kept in memory for the current visit only.
// Demo admin login: admin@afrimpact.com / demo1234
import seed from '@seed'
import { ApiError } from './http'

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)))
const delay = (v, ms = 180) => {
  schedulePersist()
  return new Promise((r) => setTimeout(() => r(clone(v)), ms))
}
const EAT = '+03:00'
const withTz = (s) => (s && !/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s + EAT : s)
const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[-\s_]+/g, '-').slice(0, 150)

const db = {
  services: seed.services.map((s, i) => ({ id: i + 1, ...s })),
  opportunities: seed.opportunities.map((o, i) => ({ id: i + 1, view_count: 0, is_published: true, ...o })),
  news: seed.news.map((n, i) => ({
    id: i + 1, view_count: 0, is_published: true, ...n, published_at: withTz(n.published_at),
  })),
  events: seed.events.map((e, i) => ({
    id: i + 1, is_published: true, ...e, start_at: withTz(e.start_at), end_at: withTz(e.end_at),
  })),
  testimonials: seed.testimonials.map((t, i) => ({ id: i + 1, ...t })),
  clients: seed.clients.map((c, i) => ({ id: i + 1, website: null, ...c })),
  submissions: { consultations: [], interests: [], itineraries: [], registrations: [], newsletter: [], pitches: [] },
  emailLog: [],
  newsletterSends: [],
  interactions: 0,
}
let nextId = 1000

// ---- demo persistence: keep the demo "database" in this browser so admin edits show on the site
const STORE = 'afr_demo_db_v2'
function schedulePersist() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ db, nextId }))
  } catch {
    /* storage full or unavailable: demo keeps working in memory */
  }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null')
    if (saved?.db) {
      Object.assign(db, saved.db)
      nextId = saved.nextId || nextId
      return true
    }
  } catch {
    /* ignore corrupt storage */
  }
  return false
}
export function resetDemo() {
  try {
    localStorage.removeItem(STORE)
  } catch {
    /* ignore */
  }
}

// ---- sample submissions so the demo admin portal has something to show (clearly example data)
const restored = restore()
const ago = (h) => new Date(Date.now() - h * 3600000).toISOString()
const demoRow = (kind, row) => { if (!restored) db.submissions[kind].push({ id: ++nextId, status: 'new', ...row }) }
demoRow('consultations', { full_name: 'Example Investor', email: 'investor@example.com', phone: '+251 911 000 000', company: 'Example Capital',
  service_interest: 'investment', topic: 'Market Entry Strategies', preferred_date: null, message: 'Exploring agro-processing in Oromia (sample).', source_page: '/services', created_at: ago(5) })
demoRow('consultations', { full_name: 'Example Traveller', email: 'traveller@example.com', phone: null, company: null,
  service_interest: 'travel', topic: 'Tailored Itineraries', preferred_date: null, message: '10 days in the north in January (sample).', source_page: '/services', created_at: ago(26) })
demoRow('interests', { opportunity_id: 3, opportunity: 'Solar Mini-Grid Portfolio', full_name: 'Example Fund Manager', email: 'fund@example.com',
  phone: null, organization: 'Example Impact Fund', budget: '$2M – $10M', message: 'Please send the brief (sample).', created_at: ago(9) })
demoRow('itineraries', { opportunity_id: 8, destination: 'Wonchi, Oromia (West Shewa, Oromia)', full_name: 'Example Family', email: 'family@example.com',
  phone: null, travel_date: '2026-12-20', travelers: 4, budget: null, message: 'Weekend trip with kids (sample).', created_at: ago(14) })
demoRow('registrations', { event_id: 1, event: 'Africa Investment Forum', full_name: 'Example Guest A', email: 'guest.a@example.com', phone: null, organization: 'Example Co', created_at: ago(30) })
demoRow('registrations', { event_id: 1, event: 'Africa Investment Forum', full_name: 'Example Guest B', email: 'guest.b@example.com', phone: null, organization: null, created_at: ago(20) })
demoRow('registrations', { event_id: 2, event: 'Business Travel Networking Evening', full_name: 'Example Guest C', email: 'guest.c@example.com', phone: null, organization: null, created_at: ago(8) })
demoRow('pitches', { full_name: 'Example Writer', email: 'writer@example.com', topic: 'Coffee routes of southern Ethiopia',
  pitch: 'A travel feature following the coffee harvest from Sidama to Yirgacheffe, with tips for visiting cooperatives.\nIncludes a short guide to coffee ceremonies. (sample pitch)',
  status: 'pending', review_note: null, article_id: null, reviewed_at: null, created_at: ago(40) })
demoRow('newsletter', { email: 'reader.one@example.com', source: 'news-page', is_active: true, unsubscribed_at: null, created_at: ago(72) })
demoRow('newsletter', { email: 'reader.two@example.com', source: 'article', is_active: true, unsubscribed_at: null, created_at: ago(50) })

const notFound = (what) => Promise.reject(new ApiError(`${what} not found`, 404))
const byNewest = (k) => (a, b) => (b[k] > a[k] ? 1 : b[k] < a[k] ? -1 : b.id - a.id)
const page = (items, p = 1, size = 12) => {
  p = Number(p) || 1
  size = Number(size) || 12
  return {
    items: items.slice((p - 1) * size, p * size),
    total: items.length,
    page: p,
    page_size: size,
    pages: Math.max(1, Math.ceil(items.length / size)),
  }
}
const pub = (list) => list.filter((x) => x.is_published !== false)
const now = () => new Date()
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(body, required) {
  for (const f of required) {
    if (!body[f] || String(body[f]).trim().length < 1) throw new ApiError(`${f.replace('_', ' ')}: field required`, 422)
  }
  if (body.email && !EMAIL.test(body.email)) throw new ApiError('email: value is not a valid email address', 422)
}

function submit(kind, body, required, message, extra = {}) {
  try {
    validate(body, required)
  } catch (e) {
    return Promise.reject(e)
  }
  const row = { id: ++nextId, status: 'new', created_at: new Date().toISOString(), ...body, ...extra }
  db.submissions[kind].unshift(row)
  logEmail(kind, row.id, `[Afrimpact] new ${kind}`)
  return delay({ ok: true, message, id: row.id }, 450)
}

function logEmail(kind, id, subject, purpose = 'notify') {
  db.emailLog.unshift({ id: ++nextId, kind, submission_id: id, recipient: '-', subject, purpose, status: 'skipped',
    error: 'Demo: emails are sent by the real backend once SMTP is configured', created_at: new Date().toISOString() })
}

const upcoming = () =>
  pub(db.events).filter((e) => new Date(e.start_at) >= now()).sort((a, b) => (a.start_at > b.start_at ? 1 : -1))

export const mockApi = {
  home: () =>
    delay({
      site: seed.site,
      home_cards: seed.home_cards,
      ticker: upcoming().slice(0, 5),
      fresh_opportunities: [...pub(db.opportunities)].sort(byNewest('posted_at')).slice(0, 8),
      testimonials: db.testimonials,
      clients: db.clients,
      latest_news: [...pub(db.news)].sort(byNewest('published_at')).slice(0, 6),
    }),
  site: () => delay({ site: seed.site, service_categories: seed.service_categories }),
  services: (category) =>
    delay(db.services.filter((s) => !category || s.category === category).sort((a, b) => a.order - b.order)),

  opportunities: (params = {}) => {
    const q = (params.q || '').toLowerCase()
    let list = pub(db.opportunities).filter(
      (o) =>
        (!params.category || o.category === params.category) &&
        (!params.country || o.country === params.country) &&
        (!params.type || o.type === params.type) &&
        (!params.sector || o.sector === params.sector) &&
        (!params.posted_from || o.posted_at >= params.posted_from) &&
        (!params.posted_to || o.posted_at <= params.posted_to) &&
        (!q || [o.title, o.summary, o.location, o.sector].join(' ').toLowerCase().includes(q)),
    )
    const sorts = {
      newest: byNewest('posted_at'),
      oldest: (a, b) => (a.posted_at > b.posted_at ? 1 : -1),
      deadline: (a, b) => (a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1,
      title: (a, b) => a.title.localeCompare(b.title),
    }
    list = [...list].sort(sorts[params.sort || 'newest'])
    return delay(page(list, params.page, params.page_size))
  },
  opportunityFilters: () => {
    const uniq = (k) => [...new Set(pub(db.opportunities).map((o) => o[k]).filter(Boolean))].sort()
    return delay({ countries: uniq('country'), types: uniq('type'), sectors: uniq('sector') })
  },
  opportunity: (slug) => {
    const o = pub(db.opportunities).find((x) => x.slug === slug)
    if (!o) return notFound('Opportunity')
    o.view_count++
    const related = pub(db.opportunities)
      .filter((x) => x.id !== o.id && x.category === o.category)
      .sort(byNewest('posted_at'))
      .slice(0, 3)
    return delay({ ...o, related })
  },
  expressInterest: (slug, body) => {
    const o = db.opportunities.find((x) => x.slug === slug)
    if (!o) return notFound('Opportunity')
    return submit('interests', body, ['full_name', 'email'],
      'Thank you! An Afrimpact advisor will contact you within two working days.', { opportunity: o.title, opportunity_id: o.id })
  },
  requestItinerary: (slug, body) => {
    const o = db.opportunities.find((x) => x.slug === slug)
    if (!o) return notFound('Destination')
    return submit('itineraries', { ...body, travelers: body.travelers ? Number(body.travelers) : null }, ['full_name', 'email'],
      'Thank you! A travel advisor will send you a tailored itinerary within two working days.',
      { opportunity_id: o.id, destination: `${o.title} (${o.location})` })
  },

  news: (params = {}) => {
    const q = (params.q || '').toLowerCase()
    const list = pub(db.news)
      .filter(
        (n) =>
          (!params.category || n.category === params.category) &&
          (!params.exclude_featured || !n.is_featured) &&
          (!q || (n.title + ' ' + n.excerpt).toLowerCase().includes(q)),
      )
      .sort(byNewest('published_at'))
    return delay(page(list, params.page, params.page_size || 9))
  },
  newsCategories: () => delay([...new Set(pub(db.news).map((n) => n.category))].sort()),
  featuredNews: () =>
    delay([...pub(db.news)].sort((a, b) => b.is_featured - a.is_featured || (b.published_at > a.published_at ? 1 : -1))[0]),
  article: (slug) => {
    const a = pub(db.news).find((n) => n.slug === slug)
    if (!a) return notFound('Article')
    a.view_count++
    const related = pub(db.news)
      .filter((n) => n.id !== a.id)
      .sort((x, y) => (y.category === a.category) - (x.category === a.category) || (y.published_at > x.published_at ? 1 : -1))
      .slice(0, 3)
    return delay({ ...a, related })
  },
  like: (slug) => bump(slug, 'likes', 1),
  unlike: (slug) => bump(slug, 'likes', -1),
  share: (slug) => bump(slug, 'shares', 1),

  events: (when = 'upcoming') => {
    const all = pub(db.events)
    if (when === 'upcoming') return delay(upcoming())
    if (when === 'past') return delay(all.filter((e) => new Date(e.start_at) < now()).sort(byNewest('start_at')))
    return delay([...all].sort(byNewest('start_at')))
  },
  event: (slug) => {
    const e = pub(db.events).find((x) => x.slug === slug)
    if (!e) return notFound('Event')
    const registered = db.submissions.registrations.filter((r) => r.event_id === e.id).length
    return delay({ ...e, registered, seats_left: e.capacity == null ? null : Math.max(0, e.capacity - registered) })
  },
  registerEvent: (slug, body) => {
    const e = db.events.find((x) => x.slug === slug)
    if (!e) return notFound('Event')
    if (new Date(e.start_at) < now()) return Promise.reject(new ApiError('Registration for this event has closed', 400))
    const dup = db.submissions.registrations.find(
      (r) => r.event_id === e.id && r.email?.toLowerCase() === body.email?.toLowerCase(),
    )
    if (dup) return delay({ ok: true, message: 'You are already registered for this event.', id: dup.id })
    return submit('registrations', body, ['full_name', 'email'],
      `You're registered for ${e.title}! A confirmation will be sent to ${body.email}.`, { event_id: e.id, event: e.title })
  },

  // Contact is email-only on the real backend (not stored). The demo just confirms.
  contact: (body) => {
    try {
      validate(body, ['first_name', 'last_name', 'email', 'message'])
    } catch (e) {
      return Promise.reject(e)
    }
    logEmail('contact', null, `[Afrimpact] New contact message: ${body.first_name} ${body.last_name}`)
    return delay({ ok: true, message: "Thanks for reaching out! We'll get back to you within one working day." }, 450)
  },
  consultation: (body) =>
    submit('consultations', body, ['full_name', 'email'],
      'Your consultation request has been received. An advisor will contact you shortly.'),
  newsletter: (body) => {
    const ex = db.submissions.newsletter.find((s) => s.email.toLowerCase() === (body.email || '').toLowerCase())
    if (ex?.is_active) return delay({ ok: true, message: "You're already subscribed — thank you!" })
    if (ex) {
      ex.is_active = true
      return delay({ ok: true, message: 'Welcome back! You\'re subscribed again.' })
    }
    return submit('newsletter', { ...body, email: (body.email || '').toLowerCase(), is_active: true, unsubscribed_at: null }, ['email'],
      "Subscribed! You'll get an email whenever we publish news.")
  },
  writeForUs: (body) =>
    submit('pitches', { ...body, status: 'pending', review_note: null, article_id: null }, ['full_name', 'email', 'topic', 'pitch'],
      'Thanks for your pitch! Our editors will review it and email you with a decision.'),
  track: () => {
    db.interactions++
    return Promise.resolve(null)
  },

  // ---------------------------------------------------------------- admin portal
  adminLogin: ({ email, password }) =>
    (email || '').toLowerCase() === 'admin@afrimpact.com' && password === 'demo1234'
      ? delay({ token: 'demo-token', user: { id: 1, email: 'admin@afrimpact.com', name: 'Demo Admin' } })
      : Promise.reject(new ApiError('Wrong email or password', 401)),
  adminMe: (t) => (t === 'demo-token' ? delay({ id: 1, email: 'admin@afrimpact.com', name: 'Demo Admin' })
    : Promise.reject(new ApiError('Please sign in again', 401))),
  adminStats: () => {
    const S = db.submissions
    const top = (list) => [...list].sort((a, b) => b.view_count - a.view_count).slice(0, 5)
      .map((x) => ({ title: x.title, views: x.view_count }))
    const isNew = (k) => S[k].filter((r) => r.status === 'new').length
    return delay({
      counts: {
        consultations: S.consultations.length, interests: S.interests.length, itineraries: S.itineraries.length,
        registrations: S.registrations.length, pitches_pending: S.pitches.filter((p) => p.status === 'pending').length,
        subscribers: S.newsletter.filter((s) => s.is_active).length, news: db.news.length,
        opportunities: db.opportunities.length, events: db.events.length, emails_sent: 0,
      },
      new: { consultations: isNew('consultations'), interests: isNew('interests'), itineraries: isNew('itineraries') },
      top_news: top(db.news),
      top_opportunities: top(db.opportunities),
    })
  },
  adminSubmissions: (t, kind, params = {}) => {
    let rows = db.submissions[kind] || []
    if (params.event_id) rows = rows.filter((r) => r.event_id === Number(params.event_id))
    return delay([...rows].sort((a, b) => (b.created_at > a.created_at ? 1 : -1)))
  },
  adminByEvent: () =>
    delay([...db.events].sort(byNewest('start_at')).map((e) => ({
      id: e.id, title: e.title, subtitle: e.subtitle, start_at: e.start_at, capacity: e.capacity,
      registrations: db.submissions.registrations.filter((r) => r.event_id === e.id).length,
    }))),
  adminSetStatus: (t, kind, id, status) => {
    const row = (db.submissions[kind] || []).find((r) => r.id === id)
    if (row) row.status = status
    return delay(row)
  },
  adminToggleSubscriber: (t, id, active) => {
    const row = db.submissions.newsletter.find((r) => r.id === id)
    if (row) row.is_active = active
    return delay(row)
  },
  adminApprovePitch: (t, id, note) => {
    const p = db.submissions.pitches.find((r) => r.id === id)
    if (!p) return notFound('Pitch')
    const paras = p.pitch.split('\n').map((x) => x.trim()).filter(Boolean)
    const art = createRow('news', { title: p.topic, category: 'Contributors', excerpt: (paras[0] || '').slice(0, 280), body: paras,
      author: p.full_name, read_minutes: 3, is_published: false, tags: ['contributor'] })
    Object.assign(p, { status: 'approved', article_id: art.id, review_note: note || null, reviewed_at: new Date().toISOString() })
    logEmail('pitches', p.id, `Your article pitch "${p.topic}" — approved`, 'confirm')
    return delay({ pitch: p, article_id: art.id, message: 'Pitch approved. A draft article was created in News — edit it and publish when ready.' })
  },
  adminRejectPitch: (t, id, note) => {
    const p = db.submissions.pitches.find((r) => r.id === id)
    if (!p) return notFound('Pitch')
    Object.assign(p, { status: 'rejected', review_note: note || null, reviewed_at: new Date().toISOString() })
    logEmail('pitches', p.id, `Your article pitch "${p.topic}" — update`, 'confirm')
    return delay({ pitch: p, message: 'Pitch rejected. The writer will be notified by email.' })
  },
  adminEmail: () => delay({
    configured: false, smtp_host: null, smtp_port: 587, default_recipients: ['info@afrimpact.com'], send_confirmation: true,
    routes: [['contact', 'Contact form (email only)'], ['consultations', 'Consultation requests'], ['interests', 'Investment interest'],
      ['itineraries', 'Itinerary requests'], ['registrations', 'Event registrations'], ['pitches', 'Writer pitches'],
      ['newsletter', 'Newsletter sign-ups']].map(([kind, label]) => ({ kind, label, recipients: ['info@afrimpact.com'], custom: false })),
    logs: db.emailLog,
    newsletter_sends: db.newsletterSends,
  }),
  adminEmailTest: () => Promise.reject(new ApiError('Demo: email sending runs on the real backend once SMTP is configured.', 400)),
  // Demo: images are kept as data URLs (resized) so they survive a page reload in this browser.
  adminUpload: (t, file) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return Promise.reject(new ApiError('Please upload a JPG, PNG, WebP or GIF image', 415))
    if (file.size > 8 * 1024 * 1024) return Promise.reject(new ApiError('Image is larger than 8 MB', 413))
    return shrink(file).then((url) => delay({ url }, 100))
  },
  adminContent: (t, kind) => delay([...db[kind]].sort((a, b) => b.id - a.id)),
  adminGet: (t, kind, id) => {
    const row = db[kind].find((x) => x.id === Number(id))
    return row ? delay(row) : notFound('Item')
  },
  adminCreate: (t, kind, body) => {
    if (!body.title) return Promise.reject(new ApiError('title: field required', 422))
    const row = createRow(kind, body)
    return delay({ ...row, newsletter_queued: maybeNewsletter(kind, row, body) })
  },
  adminUpdate: (t, kind, id, body) => {
    const row = db[kind].find((x) => x.id === id)
    if (!row) return notFound('Item')
    const { notify_subscribers: _n, ...rest } = body
    Object.assign(row, { ...rest, slug: row.slug })
    return delay({ ...row, newsletter_queued: maybeNewsletter(kind, row, body) })
  },
  adminSendNewsletter: (t, id) => {
    const row = db.news.find((x) => x.id === id)
    if (!row?.is_published) return Promise.reject(new ApiError('Publish the article before emailing it', 400))
    queueNewsletter(row)
    return delay({ message: 'Newsletter queued (demo — delivered by the real backend once SMTP is configured)' })
  },
  adminDelete: (t, kind, id) => {
    db[kind] = db[kind].filter((x) => x.id !== id)
    return delay(null)
  },
  adminExportCsv: () => Promise.reject(new ApiError('CSV export runs on the real backend', 400)),
}

function bump(slug, field, delta) {
  const a = db.news.find((n) => n.slug === slug)
  if (!a) return notFound('Article')
  a[field] = Math.max(0, a[field] + delta)
  return delay({ likes: a.likes, shares: a.shares }, 60)
}

function createRow(kind, body) {
  const base = slugify(body.slug || body.title)
  let slug = base
  let n = 2
  while (db[kind].some((x) => x.slug === slug)) slug = `${base}-${n++}`
  const { notify_subscribers: _n, ...rest } = body
  const row = {
    id: ++nextId, view_count: 0, likes: 0, shares: 0, is_published: true, bullets: [], body: [], highlights: [],
    tags: [], newsletter_sent_at: null, ...rest, slug,
  }
  if (kind === 'news') row.published_at = row.published_at || new Date().toISOString()
  if (kind === 'opportunities') row.posted_at = row.posted_at || new Date().toISOString().slice(0, 10)
  db[kind].push(row)
  return row
}

function queueNewsletter(row) {
  const subs = db.submissions.newsletter.filter((s) => s.is_active).length
  db.newsletterSends.unshift({ id: ++nextId, article_id: row.id, subject: `Afrimpact news: ${row.title}`, recipients: subs,
    delivered: 0, failed: 0, status: 'skipped', created_at: new Date().toISOString() })
  logEmail('newsletter', row.id, `Afrimpact news: ${row.title} → ${subs} subscribers`, 'newsletter')
  row.newsletter_sent_at = new Date().toISOString()
}

function maybeNewsletter(kind, row, body) {
  if (kind === 'news' && row.is_published && !row.newsletter_sent_at && body.notify_subscribers !== false) {
    queueNewsletter(row)
    return true
  }
  return false
}

function shrink(file, max = 1200) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const im = new Image()
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height))
        const c = document.createElement('canvas')
        c.width = Math.round(im.width * k)
        c.height = Math.round(im.height * k)
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.8))
      }
      im.onerror = () => resolve(reader.result)
      im.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
