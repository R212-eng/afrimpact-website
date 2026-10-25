import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/utils'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <section className="notfound">
      <span className="notfound__code">404</span>
      <h1>This page has wandered off the map</h1>
      <p>The page you’re looking for doesn’t exist or has been moved.</p>
      <div className="state__actions">
        <Link to="/" className="btn btn--solid">Back to home</Link>
        <Link to="/opportunities" className="btn btn--outline-red">Browse opportunities</Link>
      </div>
    </section>
  )
}
