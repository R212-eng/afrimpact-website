import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'

/** Resolve an image path from the API ("images/x.jpg") against the app base URL. */
export function img(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/.test(path)) return path
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}

export function timeAgo(value) {
  const d = new Date(value)
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (Number.isNaN(s)) return ''
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return formatDate(value)
}

export function formatDate(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return ''
  const d = typeof value === 'string' && value.length === 10 ? new Date(value + 'T00:00:00') : new Date(value)
  return d.toLocaleDateString('en-GB', opts)
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' })
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T23:59:59')
  return Math.ceil((d - Date.now()) / 86400000)
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Afrimpact Consultancy` : 'Afrimpact Consultancy'
  }, [title])
}

/** Small data-fetching hook: { data, loading, error, reload, setData } */
export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const alive = useRef(true)
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    return fn()
      .then((data) => alive.current && setState({ data, loading: false, error: null }))
      .catch((error) => alive.current && setState({ data: null, loading: false, error }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    alive.current = true
    run()
    return () => {
      alive.current = false
    }
  }, [run])
  const setData = (updater) =>
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }))
  return { ...state, reload: run, setData }
}

// ---- anonymous session id + interaction tracking (feeds future ML models)
function sessionId() {
  try {
    let id = localStorage.getItem('afr_sid')
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('afr_sid', id)
    }
    return id
  } catch {
    return null
  }
}

export function track(entity_type, entity_id, action = 'view', meta = {}) {
  api.track({ entity_type, entity_id, action, session_id: sessionId(), meta })
}

// ---- bookmarks (per-browser convenience)
const BM = 'afr_bookmarks'
export function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BM) || '[]')
  } catch {
    return []
  }
}
export function toggleBookmark(slug) {
  const set = new Set(getBookmarks())
  set.has(slug) ? set.delete(slug) : set.add(slug)
  try {
    localStorage.setItem(BM, JSON.stringify([...set]))
  } catch {
    /* storage unavailable */
  }
  return set.has(slug)
}

// ---- liked articles (so a second tap unlikes)
const LK = 'afr_likes'
export function getLikes() {
  try {
    return JSON.parse(localStorage.getItem(LK) || '[]')
  } catch {
    return []
  }
}
export function setLiked(slug, on) {
  const set = new Set(getLikes())
  on ? set.add(slug) : set.delete(slug)
  try {
    localStorage.setItem(LK, JSON.stringify([...set]))
  } catch {
    /* storage unavailable */
  }
  return on
}

/** Absolute, shareable URL for an in-app route (works with hash or history routing). */
export function absUrl(path) {
  const { origin, pathname } = window.location
  return import.meta.env.VITE_DEMO_MODE === 'true' ? `${origin}${pathname}#${path}` : `${origin}${path}`
}

/** Build an .ics calendar file for an event and trigger a download. */
export function downloadIcs(ev) {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const end = ev.end_at || new Date(new Date(ev.start_at).getTime() + 2 * 3600000).toISOString()
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Afrimpact//Events//EN', 'BEGIN:VEVENT',
    `UID:${ev.slug}@afrimpact.com`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(ev.start_at)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${ev.title}`, `LOCATION:${[ev.venue, ev.location].filter(Boolean).join(', ')}`,
    `DESCRIPTION:${(ev.excerpt || '').replace(/\n/g, ' ')}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${ev.slug}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
