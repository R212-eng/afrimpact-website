import { Link } from 'react-router-dom'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="state state--loading" role="status">
      <span className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Skeleton({ h = 200, w = '100%', r = 4 }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} />
}

export function ErrorState({ error, onRetry }) {
  const nf = error?.status === 404
  return (
    <div className="state state--error">
      <h2>{nf ? 'We couldn’t find that page' : 'Something went wrong'}</h2>
      <p>{nf ? 'It may have been moved or is no longer available.' : error?.message || 'Please try again.'}</p>
      <div className="state__actions">
        {!nf && onRetry && <button className="btn btn--solid" onClick={onRetry}>Try again</button>}
        <Link className="btn btn--outline-red" to="/">Back to home</Link>
      </div>
    </div>
  )
}

export function Empty({ title = 'Nothing here yet', children }) {
  return (
    <div className="state state--empty">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i}>
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
          {i < items.length - 1 && <span className="breadcrumbs__sep">/</span>}
        </span>
      ))}
    </nav>
  )
}
