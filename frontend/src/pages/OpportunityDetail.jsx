import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { GreyCard, OppMeta, PhotoCard } from '../components/Cards'
import { Field, useForm } from '../components/Form'
import { Briefcase, Calendar, Check, Clock, Globe, Pin, Share, Tag } from '../components/Icons'
import { ShareMenu } from '../components/ShareMenu'
import { ConsultationCTA } from '../components/Layout'
import { Breadcrumbs, ErrorState, Spinner } from '../components/States'
import { useUI } from '../context/UIContext'
import { daysUntil, formatDate, img, track, useDocumentTitle, useFetch } from '../lib/utils'
import { Body } from './NewsDetail'

export default function OpportunityDetail() {
  const { slug } = useParams()
  const { data: o, loading, error, reload } = useFetch(() => api.opportunity(slug), [slug])
  useDocumentTitle(o?.title)
  useEffect(() => { if (o) track('opportunity', o.slug, 'view') }, [o])

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <Spinner />

  const isTravel = o.category === 'travel'
  const left = daysUntil(o.deadline)
  const facts = [
    { icon: <Globe />, k: 'Country', v: o.country },
    { icon: <Pin />, k: 'Location', v: o.location },
    { icon: <Tag />, k: isTravel ? 'Experience' : 'Sector', v: o.sector },
    { icon: <Briefcase />, k: 'Type', v: o.type },
    !isTravel && { icon: <Briefcase />, k: 'Investment range', v: o.investment_range },
    o.deadline && { icon: <Clock />, k: 'Deadline', v: `${formatDate(o.deadline)}${left > 0 ? ` · ${left} days left` : ' · closed'}` },
    { icon: <Calendar />, k: 'Posted', v: formatDate(o.posted_at) },
  ].filter((f) => f && f.v)

  return (
    <article className="detail">
      <header className="detail-hero" style={{ backgroundImage: `url(${img(o.image)})` }}>
        <div className="detail-hero__shade" />
        <div className="detail-hero__inner">
          <Breadcrumbs items={[{ to: '/', label: 'Home' }, { to: '/opportunities', label: 'Opportunities' }, { label: o.title }]} />
          <span className="chip chip--white">{isTravel ? 'Travel Attraction' : `${o.type} Opportunity`}</span>
          <h1>{o.title}</h1>
          <p className="detail-hero__sub"><Pin size={18} /> {o.location}, {o.country}</p>
        </div>
      </header>

      <div className="detail-body">
        <div className="detail-main">
          <section className="detail-block">
            <h2>Overview</h2>
            <p className="detail-lead">{o.summary}</p>
            <Body paragraphs={o.body} />
          </section>

          {o.highlights?.length > 0 && (
            <section className="detail-block">
              <h2>Key highlights</h2>
              <ul className="checks">
                {o.highlights.map((h) => <li key={h}><Check size={18} /> {h}</li>)}
              </ul>
            </section>
          )}

          {o.bullets?.length > 0 && (
            <section className="detail-block detail-block--tint">
              <h2>{isTravel ? 'What to experience' : 'How Afrimpact supports you'}</h2>
              <ul className="dots-list">{o.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            </section>
          )}
        </div>

        <aside className="detail-side">
          <div className="side-card">
            <h3>At a glance</h3>
            <dl className="facts">
              {facts.map((f) => (
                <div key={f.k}><dt>{f.icon}{f.k}</dt><dd>{f.v}</dd></div>
              ))}
            </dl>
            <ShareMenu kind="opportunities" item={o} className="share--block">
              <span className="btn btn--ghost btn--block"><Share size={16} /> Share this opportunity</span>
            </ShareMenu>
          </div>
          <InterestForm o={o} />
        </aside>
      </div>

      {o.related?.length > 0 && (
        <section className="grid-section grid-section--tint">
          <h2 className="grid-section__title">Related {isTravel ? 'attractions' : 'opportunities'}</h2>
          <div className={`card-grid ${isTravel ? 'card-grid--photo' : ''}`}>
            {o.related.map((r) =>
              isTravel ? (
                <PhotoCard key={r.slug} to={`/opportunities/${r.slug}`} category={r.category} image={r.image} title={r.title} text={r.summary} badge={r.sector} />
              ) : (
                <GreyCard key={r.slug} to={`/opportunities/${r.slug}`} category={r.category} image={r.image} title={r.title}
                  bullets={r.bullets.slice(0, 2)} meta={<OppMeta o={r} />} />
              ),
            )}
          </div>
          <div className="center"><Link to="/opportunities" className="btn btn--outline-red">View all opportunities</Link></div>
        </section>
      )}
      <ConsultationCTA interest={o.category} />
    </article>
  )
}

function InterestForm({ o }) {
  const { toast } = useUI()
  const [done, setDone] = useState(null)
  const isTravel = o.category === 'travel'
  const form = useForm({ full_name: '', email: '', phone: '', organization: '', budget: '', message: '', travel_date: '', travelers: '' })
  const submit = form.handleSubmit(async (v) => {
    const { travel_date, travelers, ...rest } = v
    const r = isTravel
      ? await api.requestItinerary(o.slug, { full_name: v.full_name, email: v.email, phone: v.phone || null,
        travel_date: travel_date || null, travelers: travelers ? Number(travelers) : null, message: v.message })
      : await api.expressInterest(o.slug, rest)
    setDone(r.message)
    toast(r.message)
    form.reset()
  })
  return (
    <div className="side-card side-card--red" id="interest">
      <h3>{isTravel ? 'Plan this trip' : 'Express interest'}</h3>
      <p>{isTravel ? 'Get a tailored itinerary and travel support from our advisors.' : 'Receive the full investment brief and speak with an advisor.'}</p>
      {done ? (
        <div className="form-success"><Check size={22} /><p>{done}</p>
          <button className="btn btn--white" onClick={() => setDone(null)}>Send another</button></div>
      ) : (
        <form className="form form--on-red" onSubmit={submit} noValidate>
          <Field form={form} name="full_name" label="Full name" required hideLabel />
          <Field form={form} name="email" label="Email" type="email" required hideLabel />
          <Field form={form} name="phone" label="Phone number" type="tel" hideLabel />
          {!isTravel && <Field form={form} name="organization" label="Organisation" hideLabel />}
          {!isTravel && (
            <Field form={form} name="budget" label="Budget" as="select" hideLabel>
              <option value="">Indicative budget</option>
              <option>Under $500K</option><option>$500K – $2M</option><option>$2M – $10M</option><option>Over $10M</option>
            </Field>
          )}
          {isTravel && (
            <div className="form__row form__row--tight">
              <Field form={form} name="travel_date" label="Travel date" type="date" />
              <Field form={form} name="travelers" label="Travellers" type="number" min="1" max="500" />
            </div>
          )}
          <Field form={form} name="message" label={isTravel ? 'Interests, pace, budget…' : 'Message'} as="textarea" rows={3} hideLabel />
          {form.error && <p className="form__error">{form.error}</p>}
          <button className="btn btn--white btn--block" disabled={form.submitting}>
            {form.submitting ? 'Sending…' : isTravel ? 'Request itinerary' : 'Submit interest'}
          </button>
        </form>
      )}
    </div>
  )
}
