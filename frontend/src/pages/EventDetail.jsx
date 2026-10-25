import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, DEMO } from '../api'
import { EventCard } from '../components/Cards'
import { Field, useForm } from '../components/Form'
import { Calendar, Check, Clock, Download, Pin, Share, Users } from '../components/Icons'
import { ShareMenu } from '../components/ShareMenu'
import { ConsultationCTA } from '../components/Layout'
import { Breadcrumbs, ErrorState, Spinner } from '../components/States'
import { useUI } from '../context/UIContext'
import { downloadIcs, formatTime, img, track, useDocumentTitle, useFetch } from '../lib/utils'
import { Body } from './NewsDetail'

const TZ = { timeZone: 'Africa/Addis_Ababa' }

export default function EventDetail() {
  const { slug } = useParams()
  const { data: e, loading, error, reload, setData } = useFetch(() => api.event(slug), [slug])
  const others = useFetch(() => api.events('upcoming'), [])
  useDocumentTitle(e?.title)
  useEffect(() => { if (e) track('event', e.slug, 'view') }, [e?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <Spinner />

  const start = new Date(e.start_at)
  const past = start < new Date()
  const more = (others.data || []).filter((x) => x.slug !== e.slug).slice(0, 3)

  return (
    <article className="detail">
      <header className="detail-hero detail-hero--event" style={{ backgroundImage: `url(${img(e.image)})` }}>
        <div className="detail-hero__shade" />
        <div className="detail-hero__inner detail-hero__inner--event">
          <div>
            <Breadcrumbs items={[{ to: '/', label: 'Home' }, { to: '/news-events#events', label: 'Events' }, { label: e.title }]} />
            <span className="chip chip--white">{past ? 'Past event' : 'Upcoming event'}</span>
            <h1>{e.title}</h1>
            {e.subtitle && <p className="detail-hero__sub">{e.subtitle}</p>}
          </div>
          <div className="datebox">
            <span>{start.toLocaleDateString('en-GB', { month: 'short', ...TZ })}</span>
            <b>{start.toLocaleDateString('en-GB', { day: '2-digit', ...TZ })}</b>
            <span>{start.toLocaleDateString('en-GB', { year: 'numeric', ...TZ })}</span>
          </div>
        </div>
      </header>

      <div className="detail-body">
        <div className="detail-main">
          <section className="detail-block">
            <h2>About this event</h2>
            <p className="detail-lead">{e.excerpt}</p>
            <Body paragraphs={e.body} />
          </section>
        </div>
        <aside className="detail-side">
          <div className="side-card">
            <h3>Event details</h3>
            <dl className="facts">
              <div><dt><Calendar />Date</dt><dd>{start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...TZ })}</dd></div>
              <div><dt><Clock />Time</dt><dd>{formatTime(e.start_at)}{e.end_at ? ` – ${formatTime(e.end_at)}` : ''} (EAT)</dd></div>
              <div><dt><Pin />Venue</dt><dd>{[e.venue, e.location].filter(Boolean).join(', ')}</dd></div>
              {e.capacity != null && <div><dt><Users />Seats</dt><dd>{e.seats_left} of {e.capacity} available</dd></div>}
            </dl>
            {!DEMO && <button className="btn btn--ghost btn--block" onClick={() => downloadIcs(e)}><Download size={16} /> Add to calendar</button>}
            <ShareMenu kind="events" item={e} className="share--block">
              <span className="btn btn--ghost btn--block"><Share size={16} /> Share this event</span>
            </ShareMenu>
          </div>
          <Register e={e} past={past} onRegistered={() => setData((d) => ({ ...d, seats_left: d.seats_left != null ? d.seats_left - 1 : null }))} />
        </aside>
      </div>

      {more.length > 0 && (
        <section className="events">
          <h2 className="events__title">More events</h2>
          <div className="events__grid">{more.map((x) => <EventCard key={x.slug} item={x} />)}</div>
          <div className="center"><Link to="/news-events#events" className="btn btn--outline-red">All events</Link></div>
        </section>
      )}
      <ConsultationCTA />
    </article>
  )
}

function Register({ e, past, onRegistered }) {
  const { toast } = useUI()
  const [done, setDone] = useState(null)
  const form = useForm({ full_name: '', email: '', phone: '', organization: '' })
  const submit = form.handleSubmit(async (v) => {
    const r = await api.registerEvent(e.slug, v)
    setDone(r.message)
    toast(r.message)
    onRegistered()
    form.reset()
  })
  if (past) return <div className="side-card side-card--red"><h3>Registration closed</h3><p>This event has already taken place.</p></div>
  if (e.seats_left === 0) return <div className="side-card side-card--red"><h3>Fully booked</h3><p>Contact us to join the waiting list.</p></div>
  return (
    <div className="side-card side-card--red">
      <h3>Register</h3>
      {done ? (
        <div className="form-success"><Check size={22} /><p>{done}</p></div>
      ) : (
        <form className="form form--on-red" onSubmit={submit} noValidate>
          <Field form={form} name="full_name" label="Full name" required hideLabel />
          <Field form={form} name="email" label="Email" type="email" required hideLabel />
          <Field form={form} name="phone" label="Phone number" type="tel" hideLabel />
          <Field form={form} name="organization" label="Organisation" hideLabel />
          {form.error && <p className="form__error">{form.error}</p>}
          <button className="btn btn--white btn--block" disabled={form.submitting}>{form.submitting ? 'Registering…' : 'Reserve my seat'}</button>
        </form>
      )}
    </div>
  )
}
