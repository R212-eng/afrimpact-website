import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { CategoryTag, NewsCardHorizontal } from '../components/Cards'
import { Calendar, Chevron } from '../components/Icons'
import { ConsultationCTA } from '../components/Layout'
import { LogoWordmark } from '../components/Logo'
import { ErrorState, Skeleton } from '../components/States'
import { formatDate, img, useDocumentTitle, useFetch } from '../lib/utils'

/* Home page — follows the Figma "Home" frame section by section. */
export default function Home() {
  useDocumentTitle(null)
  const { data, loading, error, reload } = useFetch(() => api.home(), [])
  if (error) return <ErrorState error={error} onRetry={reload} />
  const site = data?.site

  return (
    <div className="home">
      <Ticker events={data?.ticker} />

      {/* ---------------- hero + Fresh Opportunities */}
      <section className="home-hero">
        <div className="home-hero__photo">
          <img src={img('images/hero-handshake.jpg')} alt="Business partners shaking hands" />
          <div className="home-hero__brand"><LogoWordmark /></div>
        </div>
        <FreshOpportunities items={data?.fresh_opportunities} loading={loading} />
      </section>

      {/* ---------------- AFRIMPACT CONSULTANCY intro (red) */}
      <section className="home-intro">
        <h1>AFRIMPACT CONSULTANCY</h1>
        <Typewriter words={site?.typewriter || ['Invest in Africa.', 'Explore Africa.', 'Create impact.']} />
        <p>{site?.intro}</p>
      </section>

      {/* ---------------- Explore Africa with confidence */}
      <section className="home-explore">
        <hr className="home-explore__rule" />
        <h2>{site?.explore_title || 'Explore Africa with confidence'}</h2>
        <p className="home-explore__lead">{site?.explore_text}</p>
        <div className="home-explore__cards">
          {(data?.home_cards || []).map((c) => (
            <div key={c.title} className="explore-card">
              <h3>{c.title}</h3>
              <ul>{c.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
              <Link to={`/services#${c.category}`} className="btn btn--solid">Learn More</Link>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- ABOUT + Vision / Mission / Values */}
      <section className="home-about">
        <div className="home-about__inner" style={{ backgroundImage: `url(${img('images/about-team.jpg')})` }}>
          <div className="home-about__text">
            <h2>ABOUT</h2>
            <p>{site?.about}</p>
          </div>
          <Accordion
            items={[
              { title: 'OUR VISION', body: <p>{site?.vision}</p> },
              { title: 'OUR MISSION', body: <p>{site?.mission}</p> },
              { title: 'CORE VALUES', body: <ul>{(site?.values || []).map((v) => <li key={v}>{v}</li>)}</ul> },
            ]}
          />
        </div>
      </section>

      {/* ---------------- Clients / Testimonials */}
      <section className="home-clients">
        <div className="home-clients__col">
          <h2>Clients</h2>
          <div className="home-clients__logos">
            {(data?.clients || []).map((c, i) => (
              <img key={c.id} src={img(c.logo)} alt={c.name} className={`client-logo client-logo--${i + 1}`} />
            ))}
          </div>
        </div>
        <div className="home-clients__col">
          <h2>Testimonials</h2>
          <div className="home-clients__quotes">
            {(data?.testimonials || []).map((t) => (
              <blockquote key={t.id} className="quote">
                {t.quote.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                <cite>– {t.author}</cite>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <ConsultationCTA />

      {/* ---------------- Latest News (carousel, 2 per slide) */}
      <LatestNews items={data?.latest_news || []} loading={loading} />
      <hr className="home-rule" />
    </div>
  )
}

/** Sidebar carousel: newest first, two stacked tiles per slide, swipe / dots / auto-advance. */
function FreshOpportunities({ items = [], loading }) {
  const pages = Math.max(1, Math.ceil(items.length / 2))
  const [p, setP] = useState(0)
  const [paused, setPaused] = useState(false)
  const startX = useRef(null)
  useEffect(() => {
    if (pages < 2 || paused) return
    const t = setInterval(() => setP((x) => (x + 1) % pages), 6000)
    return () => clearInterval(t)
  }, [pages, paused])
  const go = (n) => setP((n + pages) % pages)
  const onDown = (e) => { startX.current = e.clientX }
  const onUp = (e) => {
    if (startX.current == null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (Math.abs(dx) > 40) go(p + (dx < 0 ? 1 : -1))
  }
  return (
    <aside className="fresh" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="fresh__head">
        <Link to="/opportunities" className="fresh__title">Fresh Opportunities</Link>
        {pages > 1 && (
          <div className="fresh__arrows">
            <button onClick={() => go(p - 1)} aria-label="Previous opportunities"><Chevron dir="left" size={16} /></button>
            <button onClick={() => go(p + 1)} aria-label="Next opportunities"><Chevron dir="right" size={16} /></button>
          </div>
        )}
      </div>
      <div className="fresh__viewport" onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => { startX.current = null }}>
        {loading ? (
          <div className="fresh__slide">{[0, 1].map((i) => <div key={i} className="fresh__card"><Skeleton h={147} /><Skeleton h={90} /></div>)}</div>
        ) : (
          <div className="fresh__track" style={{ transform: `translateX(-${p * 100}%)` }}>
            {Array.from({ length: pages }).map((_, s) => (
              <div className="fresh__slide" key={s} aria-hidden={s !== p}>
                {items.slice(s * 2, s * 2 + 2).map((o) => (
                  <Link key={o.slug} to={`/opportunities/${o.slug}`} className="fresh__card" draggable={false} tabIndex={s === p ? 0 : -1}>
                    <div className="fresh__media">
                      <img src={img(o.image)} alt="" draggable={false} />
                      <CategoryTag category={o.category} />
                    </div>
                    <span className="fresh__date"><Calendar size={13} /> Posted {formatDate(o.posted_at)}</span>
                    <p>{o.title}: {o.category === 'travel' ? `${o.sector} in ${o.location}` : `${o.sector} opportunity in ${o.location}`}.</p>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className="dots dots--small">
          {Array.from({ length: pages }).map((_, i) => (
            <button key={i} className={i === p ? 'is-active' : ''} onClick={() => setP(i)} aria-label={`Show opportunities ${i * 2 + 1}–${i * 2 + 2}`} />
          ))}
        </div>
      )}
    </aside>
  )
}

function Ticker({ events }) {
  const [i, setI] = useState(0)
  const navigate = useNavigate()
  useEffect(() => {
    if (!events || events.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % events.length), 5000)
    return () => clearInterval(t)
  }, [events])
  const ev = events?.[i]
  return (
    <div className="ticker">
      <Link to="/news-events#events" className="ticker__label">Upcoming Event</Link>
      <p className="ticker__text" key={ev?.slug}>
        {ev ? (
          <>
            <span className="ticker__msg">{ev.title} {ev.subtitle ? `– ${ev.subtitle}` : ''} · {formatDate(ev.start_at, { day: 'numeric', month: 'long' })}, {ev.location}</span>
            <button onClick={() => navigate(`/events/${ev.slug}`)} className="ticker__more">More on this...</button>
          </>
        ) : (
          <span>Stay tuned — new events are announced every month.</span>
        )}
      </p>
    </div>
  )
}

function Typewriter({ words }) {
  const [text, setText] = useState('')
  const [idx, setIdx] = useState(0)
  const [del, setDel] = useState(false)
  useEffect(() => {
    const word = words[idx % words.length]
    const t = setTimeout(
      () => {
        if (!del) {
          const next = word.slice(0, text.length + 1)
          setText(next)
          if (next === word) setDel(true)
        } else {
          const next = word.slice(0, text.length - 1)
          setText(next)
          if (!next) {
            setDel(false)
            setIdx((x) => x + 1)
          }
        }
      },
      !del && text === word ? 1800 : del ? 45 : 95,
    )
    return () => clearTimeout(t)
  }, [text, del, idx, words])
  return (
    <div className="typewriter" aria-label={words.join(' ')}>
      <span>{text}</span>
      <i className="typewriter__caret" />
    </div>
  )
}

export function Accordion({ items, className = '' }) {
  const [open, setOpen] = useState(() => new Set(items.map((_, i) => i)))
  const toggle = (i) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  return (
    <div className={`accordion ${className}`}>
      {items.map((it, i) => (
        <div key={it.title} className={`accordion__item ${open.has(i) ? 'is-open' : ''}`}>
          <button className="accordion__head" onClick={() => toggle(i)} aria-expanded={open.has(i)}>
            <span>{it.title}</span>
            <Chevron size={20} dir={open.has(i) ? 'up' : 'down'} />
          </button>
          <div className="accordion__body">{it.body}</div>
        </div>
      ))}
    </div>
  )
}

function LatestNews({ items, loading }) {
  const pages = Math.max(1, Math.ceil(items.length / 2))
  const [p, setP] = useState(0)
  useEffect(() => {
    if (pages < 2) return
    const t = setInterval(() => setP((x) => (x + 1) % pages), 7000)
    return () => clearInterval(t)
  }, [pages])
  return (
    <section className="latest">
      <h2><Link to="/news-events">Latest News</Link></h2>
      <div className="latest__viewport">
        {loading ? (
          <div className="latest__slide"><Skeleton h={252} /><Skeleton h={252} /></div>
        ) : (
          <div className="latest__track" style={{ transform: `translateX(-${p * 100}%)` }}>
            {Array.from({ length: pages }).map((_, s) => (
              <div className="latest__slide" key={s}>
                {items.slice(s * 2, s * 2 + 2).map((n) => <NewsCardHorizontal key={n.slug} item={n} />)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="dots" role="tablist">
        {Array.from({ length: Math.max(pages, 1) }).map((_, i) => (
          <button key={i} className={i === p ? 'is-active' : ''} onClick={() => setP(i)} aria-label={`Show news ${i + 1}`} />
        ))}
      </div>
    </section>
  )
}
