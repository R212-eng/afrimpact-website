import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useUI } from '../context/UIContext'
import { getBookmarks, getLikes, setLiked as setLiked_, img, timeAgo, toggleBookmark, track, formatDate } from '../lib/utils'
import { Bookmark, Briefcase, Heart, Plane, Share, Spark } from './Icons'
import { ShareMenu } from './ShareMenu'

/** Like / share / bookmark row (the heart-28 / share-72 / bookmark trio in the design). */
export function Engagement({ item, variant = '', size = 14 }) {
  const { toast } = useUI()
  const [likes, setLikes] = useState(item.likes)
  const [shares, setShares] = useState(item.shares)
  const [liked, setLiked] = useState(() => getLikes().includes(item.slug))
  const [saved, setSaved] = useState(() => getBookmarks().includes(item.slug))

  const stop = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }
  // Tap to like, tap again to unlike (count goes back down). Remembered per browser.
  const [busy, setBusy] = useState(false)
  const like = async (e) => {
    stop(e)
    if (busy) return
    const next = !liked
    setBusy(true)
    setLiked(next)
    setLikes((l) => Math.max(0, l + (next ? 1 : -1)))
    setLiked(setLiked_(item.slug, next))
    try {
      const r = await (next ? api.like(item.slug) : api.unlike(item.slug))
      setLikes(r.likes)
    } catch {
      /* keep optimistic value */
    } finally {
      setBusy(false)
    }
  }
  const onShared = async () => {
    setShares((n) => n + 1)
    const r = await api.share(item.slug).catch(() => null)
    if (r) setShares(r.shares)
  }
  const save = (e) => {
    stop(e)
    const on = toggleBookmark(item.slug)
    setSaved(on)
    track('news', item.slug, 'bookmark', { on })
    toast(on ? 'Saved to your bookmarks' : 'Removed from bookmarks')
  }

  return (
    <div className={`engage ${variant}`}>
      <button onClick={like} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked} className={liked ? 'is-on' : ''}>
        <Heart size={size} filled={liked} className="engage__heart" /> <span>{likes}</span>
      </button>
      <ShareMenu kind="news" item={item} onShared={onShared}><Share size={size} /> <span>{shares}</span></ShareMenu>
      <button onClick={save} aria-label={saved ? 'Remove bookmark' : 'Bookmark'} className={saved ? 'is-on' : ''}>
        <Bookmark size={size} filled={saved} />
      </button>
    </div>
  )
}

const CATS = {
  investment: { label: 'Investment', Icon: Briefcase },
  travel: { label: 'Travel', Icon: Plane },
  other: { label: 'Advisory', Icon: Spark },
}

/** Small pill in the top-right corner of an opportunity image: Investment / Travel / Advisory. */
export function CategoryTag({ category }) {
  const c = CATS[category]
  if (!c) return null
  return (
    <span className={`cat-tag cat-tag--${category}`}>
      <c.Icon size={13} /> {c.label}
    </span>
  )
}

/** Home "Latest News" card: image with category tag + engagement bar, text on the right. */
export function NewsCardHorizontal({ item }) {
  return (
    <Link to={`/news/${item.slug}`} className="news-h">
      <div className="news-h__media">
        <img src={img(item.image)} alt="" loading="lazy" />
        <span className="news-h__tag">{item.category}</span>
        <div className="news-h__bar"><Engagement item={item} variant="engage--light" size={16} /></div>
      </div>
      <div className="news-h__text">
        <h3>{item.title}</h3>
        <p>{item.excerpt}</p>
      </div>
    </Link>
  )
}

/** News & Events "Recent Stories" card. */
export function StoryCard({ item }) {
  return (
    <article className="story">
      <Link to={`/news/${item.slug}`} className="story__link">
        <div className="story__media"><img src={img(item.image)} alt="" loading="lazy" /></div>
        <div className="story__body">
          <span className="story__cat">{item.category}</span>
          <h3>{item.title}</h3>
          <p>{item.excerpt}</p>
          <div className="story__meta">
            <span>{timeAgo(item.published_at)}</span>
            <span>By {item.author} | {item.read_minutes}min read</span>
          </div>
        </div>
      </Link>
      <div className="story__foot"><Engagement item={item} /></div>
    </article>
  )
}

/** Pink event card from the Events section. */
export function EventCard({ item }) {
  const d = new Date(item.start_at)
  return (
    <article className="event-card">
      <div className="event-card__media">
        <img src={img(item.image)} alt="" loading="lazy" />
        <span className="event-card__date">
          <b>{d.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'Africa/Addis_Ababa' })}</b>
          {d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Africa/Addis_Ababa' })}
        </span>
      </div>
      <div className="event-card__body">
        <h3>{item.title}</h3>
        <h4>{item.subtitle}</h4>
        <p>{item.excerpt}</p>
        <Link to={`/events/${item.slug}`} className="event-card__btn">Learn More</Link>
      </div>
    </article>
  )
}

/** Image + grey caption card (Investment Consulting / Investment Opportunities grids). */
export function GreyCard({ to, image, title, bullets = [], text, meta, onClick, category }) {
  const inner = (
    <>
      <div className="grey-card__media"><img src={img(image)} alt="" loading="lazy" />{category && <CategoryTag category={category} />}</div>
      <div className="grey-card__body">
        <h3>{title}</h3>
        {bullets.length > 0 && <ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
        {text && <p>{text}</p>}
        {meta && <div className="grey-card__meta">{meta}</div>}
      </div>
    </>
  )
  if (to) return <Link to={to} className="grey-card">{inner}</Link>
  return <button type="button" className="grey-card" onClick={onClick}>{inner}</button>
}

/** Image + title + short text (Travel Advisory / Travel attractions grids). */
export function PhotoCard({ to, image, title, text, tone = 'light', badge, onClick, category }) {
  const inner = (
    <>
      <div className="photo-card__media">
        <img src={img(image)} alt="" loading="lazy" />
        {badge && <span className="photo-card__badge">{badge}</span>}
        {category && <CategoryTag category={category} />}
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </>
  )
  const cls = `photo-card photo-card--${tone}`
  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>
}

export function OppMeta({ o }) {
  return (
    <>
      <span>{o.country}</span>
      <span>{o.type}</span>
      <span>{formatDate(o.posted_at)}</span>
    </>
  )
}
