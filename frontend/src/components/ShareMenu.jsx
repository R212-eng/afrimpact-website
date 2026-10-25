import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEMO } from '../api'
import { useUI } from '../context/UIContext'
import { absUrl, track } from '../lib/utils'
import { Link as LinkIcon } from './Icons'

export const SOURCE_TAG = 'Source: Afrimpact Consultancy'

/**
 * Link that social apps receive. On the real site it points at the backend
 * share page (/api/share/...) which carries Open Graph tags (title, image,
 * site name "Afrimpact Consultancy") so previews look right, then forwards
 * the visitor to the page. The static demo has no backend, so it uses the page URL.
 */
export function shareUrl(kind, slug) {
  const path = kind === 'news' ? `/news/${slug}` : kind === 'events' ? `/events/${slug}` : `/opportunities/${slug}`
  if (DEMO) return absUrl(path)
  return `${window.location.origin}/api/share/${kind}/${slug}`
}

/** "Title \n Summary \n\n Source: Afrimpact Consultancy" — the source tag sits below the shared content. */
export function shareText({ title, summary }) {
  const lines = [title]
  if (summary) lines.push(summary.length > 180 ? `${summary.slice(0, 177)}…` : summary)
  return `${lines.join('\n')}\n\n${SOURCE_TAG}`
}

const enc = encodeURIComponent

function targets(url, text, title) {
  const body = text.replace(`\n\n${SOURCE_TAG}`, '')
  return [
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, Icon: TelegramIcon },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${body}\n${url}\n\n${SOURCE_TAG}`)}`, Icon: WhatsAppIcon },
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, Icon: LinkedInIcon },
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(`${title}\n\n${SOURCE_TAG}`)}&url=${enc(url)}`, Icon: XIcon },
  ]
}

/**
 * Share button + pop-over with Telegram, WhatsApp, LinkedIn, X and Copy link.
 * `onShared` runs once per share (used to bump the share counter).
 */
export function ShareMenu({ kind, item, onShared, children, className = '', align = 'center', label = 'Share' }) {
  const { toast } = useUI()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const url = shareUrl(kind, item.slug)
  const text = shareText({ title: item.title, summary: item.excerpt || item.summary })

  // Fixed-position pop-over so it is never clipped by card overflow; flips up near the bottom.
  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const W = 220
    const H = 290
    let left = align === 'end' ? r.right - W : r.left + r.width / 2 - W / 2
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
    const below = r.bottom + 8
    const top = below + H > window.innerHeight && r.top - H - 8 > 0 ? r.top - H - 8 : below
    setPos({ top, left })
  }
  useEffect(() => {
    if (!open) return
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    const off = (e) => !ref.current?.contains(e.target) && !menu.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const done = (channel) => {
    track(kind === 'news' ? 'news' : kind === 'events' ? 'event' : 'opportunity', item.slug, 'share', { channel })
    onShared?.(channel)
    setOpen(false)
  }
  const copy = async (e) => {
    stop(e)
    const full = `${item.title}\n${url}\n\n${SOURCE_TAG}`
    try {
      await navigator.clipboard.writeText(full)
      toast('Link copied with the Afrimpact source tag')
    } catch {
      toast(`Copy this link: ${url}`, 'error')
    }
    done('copy')
  }

  return (
    <span className={`share ${className}`} ref={ref}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label}
        onClick={(e) => { stop(e); setOpen((o) => !o) }}>
        {children}
      </button>
      {open && createPortal(
        <span ref={menu} className="share__menu" role="menu" style={pos || { visibility: 'hidden' }}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <span className="share__title">Share to</span>
          {targets(url, text, item.title).map(({ id, label: l, href, Icon }) => (
            <a key={id} role="menuitem" className={`share__item share__item--${id}`} href={href} target="_blank" rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); done(id) }}>
              <Icon /> {l}
            </a>
          ))}
          <button type="button" role="menuitem" className="share__item share__item--copy" onClick={copy}>
            <span className="share__ico"><LinkIcon size={16} /></span> Copy link
          </button>
          <span className="share__source">{SOURCE_TAG}</span>
        </span>,
        document.body,
      )}
    </span>
  )
}

// ---- brand marks (simple, recognisable glyphs in each network's colour)
function TelegramIcon() {
  return (
    <span className="share__ico" style={{ background: '#229ED9' }}>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="#fff" d="M20.7 4.3 3.5 11c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.8l2.9-13.6c.3-1.2-.4-1.7-1.4-1.3zM8.9 13.6l9.3-5.9c.5-.3.9-.1.5.2l-7.9 7.2-.3 3.3-1.6-4.8z"/></svg>
    </span>
  )
}
function WhatsAppIcon() {
  return (
    <span className="share__ico" style={{ background: '#25D366' }}>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="#fff" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2c0 1.2.9 2.3 1 2.5.1.2 1.7 2.6 4.2 3.6 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.6-.4z"/></svg>
    </span>
  )
}
function LinkedInIcon() {
  return (
    <span className="share__ico" style={{ background: '#0A66C2' }}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#fff" d="M4.5 8.5h3.2V20H4.5zM6.1 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM10 8.5h3v1.6c.4-.8 1.5-1.8 3.2-1.8 3.4 0 4 2.2 4 5.1V20H17v-5.8c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V20H10z"/></svg>
    </span>
  )
}
function XIcon() {
  return (
    <span className="share__ico" style={{ background: '#000' }}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="#fff" d="M17.8 2h3.3l-7.2 8.3L22.4 22h-6.6l-5.2-6.8L4.6 22H1.3l7.7-8.8L.9 2h6.8l4.7 6.2L17.8 2zm-1.2 18h1.8L6.6 3.9H4.6L16.6 20z"/></svg>
    </span>
  )
}
