import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Engagement, StoryCard } from '../components/Cards'
import { Field, useForm } from '../components/Form'
import { Clock } from '../components/Icons'
import { ConsultationCTA } from '../components/Layout'
import { Breadcrumbs, ErrorState, Spinner } from '../components/States'
import { useUI } from '../context/UIContext'
import { formatDate, img, timeAgo, track, useDocumentTitle, useFetch } from '../lib/utils'

/** Renders body paragraphs; lines starting with "## " become sub-headings. */
export function Body({ paragraphs = [] }) {
  return (
    <div className="prose">
      {paragraphs.map((p, i) => (p.startsWith('## ') ? <h2 key={i}>{p.slice(3)}</h2> : <p key={i}>{p}</p>))}
    </div>
  )
}

export default function NewsDetail() {
  const { slug } = useParams()
  const { data: a, loading, error, reload } = useFetch(() => api.article(slug), [slug])
  useDocumentTitle(a?.title)
  useEffect(() => { if (a) track('news', a.slug, 'view') }, [a])

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <Spinner />

  return (
    <article className="article">
      <header className="article-hero">
        <div className="article-hero__inner">
          <Breadcrumbs items={[{ to: '/', label: 'Home' }, { to: '/news-events', label: 'News & Events' }, { label: a.category }]} />
          <span className="chip chip--white">{a.category}</span>
          <h1>{a.title}</h1>
          <div className="byline">
            {a.author_image && <img src={img(a.author_image)} alt="" />}
            <div>
              <strong>{a.author}</strong>
              <span>{formatDate(a.published_at, { day: 'numeric', month: 'long', year: 'numeric' })} · {timeAgo(a.published_at)}</span>
            </div>
            <span className="byline__read"><Clock size={16} /> {a.read_minutes} min read</span>
          </div>
        </div>
      </header>

      <div className="article-cover"><img src={img(a.image)} alt="" /></div>

      <div className="article-body">
        <div className="article-main">
          <p className="article-lead">{a.excerpt}</p>
          <Body paragraphs={a.body} />
          {a.tags?.length > 0 && (
            <div className="tags">{a.tags.map((t) => <span key={t} className="chip">#{t}</span>)}</div>
          )}
          <div className="article-engage">
            <span>Enjoyed this story?</span>
            <Engagement item={a} size={20} />
          </div>
        </div>
        <aside className="article-side">
          <div className="side-card side-card--sticky">
            <h3>Share &amp; save</h3>
            <Engagement item={a} size={20} />
            <hr />
            <Newsletter />
          </div>
        </aside>
      </div>

      {a.related?.length > 0 && (
        <section className="stories stories--related">
          <h2 className="stories__title">More stories</h2>
          <div className="stories__grid">{a.related.map((n) => <StoryCard key={n.slug} item={n} />)}</div>
          <div className="center"><Link to="/news-events" className="btn btn--white">All news &amp; events</Link></div>
        </section>
      )}
      <ConsultationCTA />
    </article>
  )
}

export function Newsletter() {
  const { toast } = useUI()
  const f = useForm({ email: '' })
  const submit = f.handleSubmit(async (v) => {
    const r = await api.newsletter({ ...v, source: 'article' })
    toast(r.message)
    f.reset()
  })
  return (
    <form className="form" onSubmit={submit} noValidate>
      <h3>Newsletter</h3>
      <p className="muted">Opportunities, destination guides and event invitations — once a month.</p>
      <Field form={f} name="email" label="Email address" type="email" required hideLabel />
      {f.error && <p className="form__error">{f.error}</p>}
      <button className="btn btn--solid btn--block" disabled={f.submitting}>{f.submitting ? 'Subscribing…' : 'Subscribe'}</button>
    </form>
  )
}
