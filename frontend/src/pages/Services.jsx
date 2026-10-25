import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import { GreyCard, PhotoCard } from '../components/Cards'
import { ConsultationCTA } from '../components/Layout'
import { ErrorState, Spinner } from '../components/States'
import { useUI } from '../context/UIContext'
import { img, track, useDocumentTitle, useFetch } from '../lib/utils'

export default function Services() {
  useDocumentTitle('Services')
  const { hash } = useLocation()
  const { openConsultation } = useUI()
  const { data, loading, error, reload } = useFetch(
    () => Promise.all([api.site(), api.services()]).then(([site, services]) => ({ ...site, services })),
    [],
  )

  useEffect(() => {
    if (!data || !hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [data, hash])

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <Spinner />

  const cat = Object.fromEntries(data.service_categories.map((c) => [c.category, c]))
  const byCat = (c) => data.services.filter((s) => s.category === c)
  const ask = (s) => {
    track('service', s.slug, 'click')
    openConsultation({ interest: s.category, topic: s.title, source: `service:${s.slug}` })
  }
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="services">
      {/* Investment Consulting split (text left, circle image right) */}
      <section className="split split--red" id="investment">
        <div className="split__box">
          <h2>{cat.investment.title}</h2>
          <ul>{cat.investment.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          <button className="btn btn--white" onClick={() => scrollTo('investment-grid')}>Learn More</button>
        </div>
        <div className="split__circle">
          <img src={img(cat.investment.image)} alt="" />
          <span className="split__circle-label">Consultancy<small>Services</small></span>
        </div>
      </section>

      <section className="grid-section" id="investment-grid">
        <h2 className="grid-section__title">Investment Consulting</h2>
        <div className="card-grid card-grid--4">
          {byCat('investment').map((s) => (
            <GreyCard key={s.slug} image={s.image} title={s.title} bullets={s.bullets}
              text={s.bullets.length ? null : s.summary} onClick={() => ask(s)} />
          ))}
        </div>
      </section>

      {/* Travel Advisory split (image left, text right) */}
      <section className="split split--red split--reverse" id="travel">
        <div className="split__photo"><img src={img(cat.travel.image)} alt="" /></div>
        <div className="split__box">
          <h2>{cat.travel.title}</h2>
          <ul>{cat.travel.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          <button className="btn btn--white" onClick={() => scrollTo('travel-grid')}>Learn More</button>
        </div>
      </section>

      <section className="grid-section" id="travel-grid">
        <h2 className="grid-section__title">Travel Advisory</h2>
        <div className="card-grid card-grid--4 card-grid--photo4">
          {byCat('travel').map((s) => (
            <PhotoCard key={s.slug} image={s.image} title={s.title} text={s.summary} onClick={() => ask(s)} />
          ))}
        </div>
      </section>

      {/* Other Services split */}
      <section className="split split--red" id="other">
        <div className="split__box split__box--tall">
          <h2>{cat.other.title}</h2>
          <ul>{cat.other.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          <button className="btn btn--white" onClick={() => openConsultation({ interest: 'other' })}>Enquire Now</button>
        </div>
        <div className="split__photo split__photo--sm"><img src={img(cat.other.image)} alt="" /></div>
      </section>

      <ConsultationCTA />
    </div>
  )
}
