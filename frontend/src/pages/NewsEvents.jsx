import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { Engagement, EventCard, StoryCard } from '../components/Cards'
import { SearchBox } from '../components/FilterBar'
import { Field, useForm } from '../components/Form'
import { Empty, ErrorState, Skeleton } from '../components/States'
import { useUI } from '../context/UIContext'
import { img, timeAgo, useDocumentTitle, useFetch } from '../lib/utils'

export default function NewsEvents() {
  useDocumentTitle('News & Events')
  const { hash } = useLocation()
  const featured = useFetch(() => api.featuredNews(), [])
  const events = useFetch(() => api.events('upcoming'), [])

  useEffect(() => {
    if (!hash || events.loading) return
    setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [hash, events.loading])

  const f = featured.data
  return (
    <div className="newsevents">
      {/* Featured story */}
      <section className="feature">
        {featured.error ? <ErrorState error={featured.error} onRetry={featured.reload} /> : !f ? (
          <div className="feature__loading"><Skeleton h={460} /></div>
        ) : (
          <>
            <Link to={`/news/${f.slug}`} className="feature__text">
              <div className="feature__title"><h1>{f.title}</h1></div>
              <p className="feature__desc">{f.excerpt}</p>
              <div className="feature__engage"><Engagement item={f} /></div>
              <div className="feature__meta">
                <span>{timeAgo(f.published_at)}</span>
                <span>By {f.author} | {f.read_minutes}min read</span>
              </div>
            </Link>
            <Link to={`/news/${f.slug}`} className="feature__media"><img src={img(f.image)} alt="" /></Link>
          </>
        )}
      </section>

      <RecentStories />

      {/* Events */}
      <section className="events" id="events">
        <h2 className="events__title">Events</h2>
        {events.error && <ErrorState error={events.error} onRetry={events.reload} />}
        <div className="events__grid">
          {events.loading
            ? [0, 1, 2].map((i) => <Skeleton key={i} h={480} />)
            : events.data.length === 0
              ? <Empty title="No upcoming events">New events are announced every month — check back soon.</Empty>
              : events.data.map((e) => <EventCard key={e.slug} item={e} />)}
        </div>
      </section>

      <WriteForUs />
    </div>
  )
}

function RecentStories() {
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const cats = useFetch(() => api.newsCategories(), [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => setPage(1), [cat, debounced])

  const { data, loading, error, reload } = useFetch(
    () => api.news({ category: cat, q: debounced, exclude_featured: !cat && !debounced, page, page_size: 6 }),
    [cat, debounced, page],
  )
  useEffect(() => {
    if (!data) return
    const list = data.items
    setItems((prev) => (data.page === 1 ? list : [...prev, ...list]))
  }, [data])

  return (
    <section className="stories">
      <h2 className="stories__title">Recent Stories</h2>
      <div className="stories__tools">
        <div className="tabs" role="tablist">
          {['', ...(cats.data || [])].map((c) => (
            <button key={c || 'all'} role="tab" aria-selected={cat === c} className={cat === c ? 'is-active' : ''} onClick={() => setCat(c)}>
              {c || 'All'}
            </button>
          ))}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search stories" />
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      <div className="stories__grid">
        {items.map((n) => <StoryCard key={n.slug} item={n} />)}
        {loading && page === 1 && [0, 1, 2].map((i) => <Skeleton key={i} h={300} />)}
      </div>
      {!loading && items.length === 0 && <Empty title="No stories found">Try another category or search term.</Empty>}
      {data && page < data.pages && (
        <div className="center">
          <button className="btn btn--white" onClick={() => setPage((p) => p + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more stories'}
          </button>
        </div>
      )}
    </section>
  )
}

function WriteForUs() {
  const { toast } = useUI()
  const [showPitch, setShowPitch] = useState(false)
  const sub = useForm({ email: '' })
  const pitch = useForm({ full_name: '', email: '', topic: '', pitch: '' })

  const subscribe = sub.handleSubmit(async (v) => {
    const r = await api.newsletter({ ...v, source: 'news-page' })
    toast(r.message)
    sub.reset()
  })
  const sendPitch = pitch.handleSubmit(async (v) => {
    const r = await api.writeForUs(v)
    toast(r.message)
    pitch.reset()
    setShowPitch(false)
  })

  return (
    <section className="write">
      <div className="write__left">
        <form className="write__subscribe" onSubmit={subscribe} noValidate>
          <Field form={sub} name="email" label="Your email address" type="email" required hideLabel />
          <button className="btn btn--dark" disabled={sub.submitting}>{sub.submitting ? '…' : 'Subscribe'}</button>
        </form>
        <p className="write__note">Get our newsletter: new opportunities, destination guides and event invitations.</p>
      </div>
      <div className="write__right">
        <h2>Write for Us</h2>
        <span className="write__rule" />
        <p>If you want to contribute articles or images for the next newsletter, pitch your idea below or email info@afrimpact.com.</p>
        {!showPitch ? (
          <button className="btn btn--white-red" onClick={() => setShowPitch(true)}>Get In Touch</button>
        ) : (
          <form className="form form--on-red" onSubmit={sendPitch} noValidate>
            <div className="form__row">
              <Field form={pitch} name="full_name" label="Full name" required hideLabel />
              <Field form={pitch} name="email" label="Email" type="email" required hideLabel />
            </div>
            <Field form={pitch} name="topic" label="Article topic" required hideLabel />
            <Field form={pitch} name="pitch" label="Your pitch (a few sentences)" as="textarea" rows={3} required hideLabel />
            {pitch.error && <p className="form__error">{pitch.error}</p>}
            <div className="form__actions">
              <button className="btn btn--white-red" disabled={pitch.submitting}>{pitch.submitting ? 'Sending…' : 'Send pitch'}</button>
              <button type="button" className="btn btn--link-white" onClick={() => setShowPitch(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
