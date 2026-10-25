import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, DEMO } from '../api'
import { useUI } from '../context/UIContext'
import { formatDate } from '../lib/utils'

const STATUSES = ['new', 'in_progress', 'done', 'archived']

// Columns shown per submission type; every field is visible in the detail drawer.
const CONFIG = {
  consultations: {
    title: 'Consultation requests',
    intro: 'Sent from the "Request a Consultation" pop-ups across the site, including service topics.',
    cols: [['full_name', 'Name'], ['email', 'Email'], ['service_interest', 'Area'], ['topic', 'Topic'], ['created_at', 'Received']],
    group: 'service_interest',
  },
  interests: {
    title: 'Investment interest',
    intro: '"Express interest" forms on investment and advisory opportunities.',
    cols: [['full_name', 'Name'], ['email', 'Email'], ['opportunity', 'Opportunity'], ['budget', 'Budget'], ['created_at', 'Received']],
    group: 'opportunity',
  },
  itineraries: {
    title: 'Itinerary requests',
    intro: '"Plan this trip" requests from travel attractions.',
    cols: [['full_name', 'Name'], ['email', 'Email'], ['destination', 'Destination'], ['travel_date', 'Travel date'], ['travelers', 'People'], ['created_at', 'Received']],
    group: 'destination',
  },
}

const fmt = (k, v) => {
  if (v == null || v === '') return '—'
  if (k.endsWith('_at') || k === 'travel_date' || k === 'preferred_date') return formatDate(v)
  if (k === 'service_interest') return String(v).replace(/^./, (c) => c.toUpperCase())
  return String(v)
}

function useRows(ctx, kind, params) {
  const [rows, setRows] = useState(null)
  const load = () => api.adminSubmissions(ctx.token, kind, params).then(setRows)
  useEffect(() => { load() }, [kind, JSON.stringify(params)]) // eslint-disable-line react-hooks/exhaustive-deps
  return [rows, setRows, load]
}

function Export({ ctx, kind, params }) {
  const { toast } = useUI()
  if (DEMO) return null
  return (
    <button className="adm-btn" onClick={() => api.adminExportCsv(ctx.token, kind, params).catch((e) => toast(e.message, 'error'))}>
      Export CSV
    </button>
  )
}

function Drawer({ row, onClose, children }) {
  if (!row) return null
  const skip = new Set(['id', 'opportunity_id', 'event_id', 'article_id'])
  return (
    <div className="adm-drawer" onMouseDown={onClose}>
      <div className="adm-drawer__panel" onMouseDown={(e) => e.stopPropagation()}>
        <button className="adm-drawer__close" onClick={onClose} aria-label="Close">×</button>
        <h2>{row.full_name || row.email}</h2>
        <dl className="adm-dl">
          {Object.entries(row).filter(([k]) => !skip.has(k)).map(([k, v]) => (
            <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{fmt(k, v)}</dd></div>
          ))}
        </dl>
        {children}
        {row.email && <a className="adm-btn adm-btn--primary" href={`mailto:${row.email}`}>Reply by email</a>}
      </div>
    </div>
  )
}

export function SubmissionTable({ kind, ctx }) {
  const cfg = CONFIG[kind]
  const [rows, setRows] = useRows(ctx, kind, {})
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [group, setGroup] = useState('')
  const [open, setOpen] = useState(null)

  const groups = useMemo(() => {
    const m = {}
    ;(rows || []).forEach((r) => { const g = r[cfg.group] || '—'; m[g] = (m[g] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [rows, cfg.group])

  const shown = (rows || []).filter((r) =>
    (!status || r.status === status) && (!group || (r[cfg.group] || '—') === group) &&
    (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())))

  const setRowStatus = async (r, st) => {
    await api.adminSetStatus(ctx.token, kind, r.id, st)
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: st } : x)))
    ctx.refresh()
  }

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div><h1>{cfg.title}</h1><p className="adm-muted">{cfg.intro}</p></div>
        <div className="adm-actions"><Export ctx={ctx} kind={kind} /></div>
      </div>
      <div className="adm-filters">
        <input className="adm-input" placeholder="Search name, email, message…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="adm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      {groups.length > 1 && (
        <div className="adm-chips">
          <button className={!group ? 'is-on' : ''} onClick={() => setGroup('')}>All <b>{rows.length}</b></button>
          {groups.map(([g, n]) => (
            <button key={g} className={group === g ? 'is-on' : ''} onClick={() => setGroup(g)}>{fmt(cfg.group, g)} <b>{n}</b></button>
          ))}
        </div>
      )}
      {!rows ? <div className="adm-loading"><span className="spinner" /></div> : shown.length === 0 ? (
        <div className="adm-empty">No submissions here yet.</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr>{cfg.cols.map(([, l]) => <th key={l}>{l}</th>)}<th>Status</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className={r.status === 'new' ? 'is-new' : ''}>
                  {cfg.cols.map(([k]) => <td key={k}>{fmt(k, r[k])}</td>)}
                  <td onClick={(e) => e.stopPropagation()}>
                    <select className={`adm-status adm-status--${r.status}`} value={r.status} onChange={(e) => setRowStatus(r, e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Drawer row={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export function Registrations({ ctx }) {
  const [events, setEvents] = useState(null)
  const [sel, setSel] = useState(null)
  const params = useMemo(() => (sel ? { event_id: sel } : {}), [sel])
  const [rows] = useRows(ctx, 'registrations', params)
  const [open, setOpen] = useState(null)
  useEffect(() => { api.adminByEvent(ctx.token).then(setEvents) }, [ctx.token])
  const current = events?.find((e) => e.id === sel)
  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div><h1>Event registrations</h1><p className="adm-muted">Grouped by event. Pick an event to see its guest list.</p></div>
        <div className="adm-actions"><Export ctx={ctx} kind="registrations" params={params} /></div>
      </div>
      <div className="adm-events">
        <button className={`adm-event ${!sel ? 'is-on' : ''}`} onClick={() => setSel(null)}>
          <b>All events</b><span>{events ? events.reduce((a, e) => a + e.registrations, 0) : '…'} registrations</span>
        </button>
        {(events || []).map((e) => {
          const pct = e.capacity ? Math.min(100, Math.round((e.registrations / e.capacity) * 100)) : null
          return (
            <button key={e.id} className={`adm-event ${sel === e.id ? 'is-on' : ''}`} onClick={() => setSel(e.id)}>
              <b>{e.title}</b>
              <small>{formatDate(e.start_at)}{e.subtitle ? ` · ${e.subtitle}` : ''}</small>
              <span>{e.registrations}{e.capacity ? ` / ${e.capacity} seats` : ' registered'}</span>
              {pct != null && <i className="adm-meter"><i style={{ width: `${pct}%` }} /></i>}
            </button>
          )
        })}
      </div>
      <h2 className="adm-sub">{current ? current.title : 'All registrations'}</h2>
      {!rows ? <div className="adm-loading"><span className="spinner" /></div> : rows.length === 0 ? (
        <div className="adm-empty">No registrations yet.</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Organisation</th>{!sel && <th>Event</th>}<th>Registered</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)}>
                  <td>{r.full_name}</td><td>{r.email}</td><td>{fmt('phone', r.phone)}</td><td>{fmt('o', r.organization)}</td>
                  {!sel && <td>{r.event}</td>}<td>{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Drawer row={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export function Pitches({ ctx }) {
  const { toast } = useUI()
  const [rows, setRows, load] = useRows(ctx, 'pitches', {})
  const [tab, setTab] = useState('pending')
  const [notes, setNotes] = useState({})
  const [confirm, setConfirm] = useState(null)
  const decide = async (p, approve) => {
    try {
      const r = approve ? await api.adminApprovePitch(ctx.token, p.id, notes[p.id]) : await api.adminRejectPitch(ctx.token, p.id, notes[p.id])
      toast(r.message)
      setConfirm(null)
      load()
      ctx.refresh()
    } catch (e) {
      toast(e.message, 'error')
    }
  }
  const shown = (rows || []).filter((p) => p.status === tab)
  const count = (s) => (rows || []).filter((p) => p.status === s).length
  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div><h1>Writer pitches</h1><p className="adm-muted">Approving a pitch creates a draft article in News and emails the writer. Edit the draft, then publish it.</p></div>
      </div>
      <div className="adm-chips">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button key={s} className={tab === s ? 'is-on' : ''} onClick={() => setTab(s)}>{s} <b>{count(s)}</b></button>
        ))}
      </div>
      {!rows ? <div className="adm-loading"><span className="spinner" /></div> : shown.length === 0 ? (
        <div className="adm-empty">No {tab} pitches.</div>
      ) : (
        <div className="adm-pitches">
          {shown.map((p) => (
            <article key={p.id} className="adm-card adm-pitch">
              <header>
                <h3>{p.topic}</h3>
                <span className={`adm-pill adm-pill--${p.status}`}>{p.status}</span>
              </header>
              <p className="adm-muted">{p.full_name} · {p.email} · {formatDate(p.created_at)}</p>
              <blockquote>{p.pitch}</blockquote>
              {p.status === 'pending' ? (
                <>
                  <textarea className="adm-input" rows={2} placeholder="Note to the writer (optional, included in the email)"
                    value={notes[p.id] || ''} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
                  <div className="adm-actions">
                    <button className="adm-btn adm-btn--primary" onClick={() => decide(p, true)}>Approve → draft article</button>
                    {confirm === p.id ? (
                      <button className="adm-btn adm-btn--danger" onClick={() => decide(p, false)}>Confirm reject</button>
                    ) : (
                      <button className="adm-btn" onClick={() => setConfirm(p.id)}>Reject</button>
                    )}
                  </div>
                </>
              ) : (
                <div className="adm-actions">
                  {p.review_note && <span className="adm-muted">Note: {p.review_note}</span>}
                  {p.article_id && <Link className="adm-btn" to={`/admin/news/${p.article_id}`}>Open draft article</Link>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export function Subscribers({ ctx }) {
  const [rows, setRows] = useRows(ctx, 'newsletter', {})
  const [q, setQ] = useState('')
  const toggle = async (r) => {
    await api.adminToggleSubscriber(ctx.token, r.id, !r.is_active)
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)))
    ctx.refresh()
  }
  const active = (rows || []).filter((r) => r.is_active).length
  const shown = (rows || []).filter((r) => !q || r.email.includes(q.toLowerCase()))
  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div>
          <h1>Newsletter</h1>
          <p className="adm-muted">{active} active subscriber{active === 1 ? '' : 's'}. Each one receives an email when a news article is published (with an unsubscribe link).</p>
        </div>
        <div className="adm-actions"><Export ctx={ctx} kind="newsletter" /></div>
      </div>
      <div className="adm-filters"><input className="adm-input" placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!rows ? <div className="adm-loading"><span className="spinner" /></div> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Email</th><th>Signed up from</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td><td>{fmt('s', r.source)}</td><td>{formatDate(r.created_at)}</td>
                  <td><span className={`adm-pill ${r.is_active ? 'adm-pill--approved' : 'adm-pill--rejected'}`}>{r.is_active ? 'active' : 'unsubscribed'}</span></td>
                  <td><button className="adm-btn adm-btn--sm" onClick={() => toggle(r)}>{r.is_active ? 'Unsubscribe' : 'Re-activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
