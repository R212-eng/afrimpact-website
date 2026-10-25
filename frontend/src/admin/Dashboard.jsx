import { Link } from 'react-router-dom'

const TILES = [
  ['consultations', 'Consultation requests', '/admin/consultations'],
  ['interests', 'Investment interest', '/admin/interests'],
  ['itineraries', 'Itinerary requests', '/admin/itineraries'],
  ['registrations', 'Event registrations', '/admin/registrations'],
  ['pitches_pending', 'Pitches to review', '/admin/pitches'],
  ['subscribers', 'Newsletter subscribers', '/admin/subscribers'],
]

export function Dashboard({ ctx }) {
  const s = ctx.stats
  if (!s) return <div className="adm-loading"><span className="spinner" /></div>
  const newTotal = Object.values(s.new || {}).reduce((a, b) => a + b, 0)
  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div>
          <h1>Dashboard</h1>
          <p className="adm-muted">{newTotal ? `${newTotal} new submission${newTotal > 1 ? 's' : ''} waiting for follow-up.` : 'All submissions are followed up.'}</p>
        </div>
        <div className="adm-actions">
          <Link to="/admin/news/new" className="adm-btn adm-btn--primary">+ New article</Link>
          <Link to="/admin/opportunities/new" className="adm-btn">+ New opportunity</Link>
        </div>
      </div>
      <div className="adm-tiles">
        {TILES.map(([k, label, to]) => (
          <Link key={k} to={to} className="adm-tile">
            <b>{s.counts[k] ?? 0}</b>
            <span>{label}</span>
            {s.new?.[k] > 0 && <em>{s.new[k]} new</em>}
          </Link>
        ))}
      </div>
      <div className="adm-grid2">
        <section className="adm-card">
          <h2>Content</h2>
          <ul className="adm-kv">
            <li><span>News articles</span><Link to="/admin/news">{s.counts.news}</Link></li>
            <li><span>Opportunities</span><Link to="/admin/opportunities">{s.counts.opportunities}</Link></li>
            <li><span>Events</span><Link to="/admin/events">{s.counts.events}</Link></li>
            <li><span>Emails delivered</span><Link to="/admin/email">{s.counts.emails_sent}</Link></li>
          </ul>
        </section>
        <section className="adm-card">
          <h2>Most read stories</h2>
          <ol className="adm-rank">{s.top_news.map((r) => <li key={r.title}><span>{r.title}</span><b>{r.views}</b></li>)}</ol>
        </section>
        <section className="adm-card">
          <h2>Most viewed opportunities</h2>
          <ol className="adm-rank">{s.top_opportunities.map((r) => <li key={r.title}><span>{r.title}</span><b>{r.views}</b></li>)}</ol>
        </section>
      </div>
    </div>
  )
}
