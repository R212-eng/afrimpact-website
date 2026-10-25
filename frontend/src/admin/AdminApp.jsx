// Afrimpact admin portal (CMS): sign-in, dashboard, submissions, content, email.
// Mounted at /admin, outside the public site layout.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { api, DEMO } from '../api'
import { resetDemo } from '../api/mock'
import { LogoBadge } from '../components/Logo'
import { useUI } from '../context/UIContext'
import { useDocumentTitle } from '../lib/utils'
import { ContentEditor, ContentList } from './Content'
import { Dashboard } from './Dashboard'
import { EmailSettings } from './EmailSettings'
import { Pitches, Registrations, Subscribers, SubmissionTable } from './Submissions'
import './admin.css'

const TOKEN_KEY = 'afr_admin_token'
const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}
const writeToken = (t) => {
  try {
    t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: token lives in memory only */
  }
}

export const NAV = [
  { group: 'Overview', items: [{ to: '', label: 'Dashboard', icon: '◧' }] },
  {
    group: 'Submissions',
    items: [
      { to: 'consultations', label: 'Consultations', icon: '✉', badge: 'consultations' },
      { to: 'interests', label: 'Investment interest', icon: '◆', badge: 'interests' },
      { to: 'itineraries', label: 'Itinerary requests', icon: '✈', badge: 'itineraries' },
      { to: 'registrations', label: 'Event registrations', icon: '◷' },
      { to: 'pitches', label: 'Writer pitches', icon: '✎', badge: 'pitches_pending' },
      { to: 'subscribers', label: 'Newsletter', icon: '☰' },
    ],
  },
  {
    group: 'Content',
    items: [
      { to: 'news', label: 'News', icon: '▤' },
      { to: 'opportunities', label: 'Opportunities', icon: '◎' },
      { to: 'events', label: 'Events', icon: '◈' },
    ],
  },
  { group: 'Settings', items: [{ to: 'email', label: 'Email forwarding', icon: '⚙' }] },
]

export default function AdminApp() {
  useDocumentTitle('Admin')
  const [token, setToken] = useState(readToken)
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(!!token)

  useEffect(() => {
    if (!token) return
    api.adminMe(token).then(setUser).catch(() => {
      setToken('')
      writeToken('')
    }).finally(() => setChecking(false))
  }, [token])

  const signOut = useCallback(() => {
    writeToken('')
    setToken('')
    setUser(null)
  }, [])

  if (checking) return <div className="adm-loading"><span className="spinner" /></div>
  if (!token || !user) {
    return <Login onSignedIn={(t, u) => { writeToken(t); setToken(t); setUser(u) }} />
  }
  return <Shell token={token} user={user} onSignOut={signOut} />
}

function Login({ onSignedIn }) {
  const [email, setEmail] = useState(DEMO ? 'admin@afrimpact.com' : '')
  const [password, setPassword] = useState(DEMO ? 'demo1234' : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const r = await api.adminLogin({ email, password })
      onSignedIn(r.token, r.user)
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="adm-login">
      <form className="adm-login__card" onSubmit={submit}>
        <LogoBadge size={76} />
        <h1>Afrimpact admin</h1>
        <p>Manage news, opportunities, events and every form submission from the website.</p>
        <label className="adm-field"><span>Email</span>
          <input id="adm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label className="adm-field"><span>Password</span>
          <input id="adm-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {err && <p className="adm-error">{err}</p>}
        <button className="adm-btn adm-btn--primary adm-btn--block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {DEMO && <p className="adm-hint">Demo account: admin@afrimpact.com / demo1234</p>}
        <Link to="/" className="adm-back">← Back to website</Link>
      </form>
    </div>
  )
}

function Shell({ token, user, onSignOut }) {
  const [section = '', id] = (useParams()['*'] || '').split('/')
  const [stats, setStats] = useState(null)
  const [menu, setMenu] = useState(false)
  const refresh = useCallback(() => api.adminStats(token).then(setStats).catch(() => {}), [token])
  useEffect(() => { refresh() }, [refresh, section])
  useEffect(() => setMenu(false), [section, id])

  const badge = (k) => {
    if (!stats || !k) return 0
    return k === 'pitches_pending' ? stats.counts.pitches_pending : stats.new?.[k] || 0
  }
  const ctx = useMemo(() => ({ token, refresh, stats }), [token, refresh, stats])

  let view
  if (['news', 'opportunities', 'events'].includes(section)) {
    view = id ? <ContentEditor key={`${section}-${id}`} kind={section} id={id} ctx={ctx} /> : <ContentList kind={section} ctx={ctx} />
  } else if (['consultations', 'interests', 'itineraries'].includes(section)) view = <SubmissionTable key={section} kind={section} ctx={ctx} />
  else if (section === 'registrations') view = <Registrations ctx={ctx} />
  else if (section === 'pitches') view = <Pitches ctx={ctx} />
  else if (section === 'subscribers') view = <Subscribers ctx={ctx} />
  else if (section === 'email') view = <EmailSettings ctx={ctx} />
  else view = <Dashboard ctx={ctx} />

  return (
    <div className={`adm ${menu ? 'is-menu' : ''}`}>
      <aside className="adm-side">
        <Link to="/admin" className="adm-brand"><LogoBadge size={44} /><span>Admin</span></Link>
        <nav>
          {NAV.map((g) => (
            <div key={g.group} className="adm-nav-group">
              <span className="adm-nav-title">{g.group}</span>
              {g.items.map((it) => (
                <NavLink key={it.to} to={`/admin${it.to ? '/' + it.to : ''}`} end={!it.to} className="adm-nav-item">
                  <i aria-hidden="true">{it.icon}</i> {it.label}
                  {badge(it.badge) > 0 && <b className="adm-badge">{badge(it.badge)}</b>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <Link to="/" className="adm-nav-item adm-nav-item--site" target="_blank">↗ View website</Link>
      </aside>
      <div className="adm-main">
        <header className="adm-top">
          <button className="adm-burger" onClick={() => setMenu((m) => !m)} aria-label="Menu">☰</button>
          {DEMO && (
            <span className="adm-demo">Demo · changes are saved in this browser
              <button onClick={() => { resetDemo(); window.location.reload() }}>Reset</button></span>
          )}
          <div className="adm-user">
            <span>{user.name}</span><small>{user.email}</small>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onSignOut}>Sign out</button>
          </div>
        </header>
        <div className="adm-content">{view}</div>
      </div>
    </div>
  )
}

/** Shared helpers for the admin views */
export function useAdminNav() {
  return useNavigate()
}

export function useToastError() {
  const { toast } = useUI()
  return (e) => toast(e.message || 'Something went wrong', 'error')
}
