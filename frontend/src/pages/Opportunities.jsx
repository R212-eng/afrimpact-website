import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { GreyCard, OppMeta, PhotoCard } from '../components/Cards'
import { DatePill, PillSelect, SearchBox } from '../components/FilterBar'
import { ConsultationCTA } from '../components/Layout'
import { Empty, ErrorState, Skeleton } from '../components/States'
import { track, useDocumentTitle, useFetch } from '../lib/utils'

const KEYS = ['country', 'type', 'posted_from', 'q']

export default function Opportunities() {
  useDocumentTitle('Opportunities')
  const [params, setParams] = useSearchParams()
  const applied = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, params.get(k) || ''])), [params])
  const [draft, setDraft] = useState(applied)
  useEffect(() => setDraft(applied), [applied])

  const filters = useFetch(() => api.opportunityFilters(), [])
  const isFiltered = KEYS.some((k) => applied[k])

  const apply = (e) => {
    e?.preventDefault()
    const next = {}
    KEYS.forEach((k) => draft[k] && (next[k] = draft[k]))
    setParams(next)
    track('page', '/opportunities', 'filter', next)
  }
  const clear = () => setParams({})

  return (
    <div className="opps">
      <form className="filterbar" onSubmit={apply}>
        <PillSelect label="Country" value={draft.country} options={filters.data?.countries || []}
          onChange={(v) => setDraft((d) => ({ ...d, country: v }))} />
        <PillSelect label="Type" value={draft.type} options={filters.data?.types || []}
          onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
        <DatePill label="Post Date" value={draft.posted_from} onChange={(v) => setDraft((d) => ({ ...d, posted_from: v }))} />
        <SearchBox value={draft.q} placeholder="Search opportunities" onChange={(v) => setDraft((d) => ({ ...d, q: v }))} />
        <button className="filterbar__apply">Apply Filter</button>
        {isFiltered && <button type="button" className="filterbar__clear" onClick={clear}>Clear</button>}
      </form>

      {isFiltered ? <Results key={params.toString()} applied={applied} /> : <Sections />}
      <ConsultationCTA />
    </div>
  )
}

function Results({ applied }) {
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const { data, loading, error, reload } = useFetch(
    () => api.opportunities({ ...applied, page, page_size: 9 }),
    [JSON.stringify(applied), page],
  )
  useEffect(() => {
    if (data) setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items]))
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <section className="grid-section">
      <h2 className="grid-section__title grid-section__title--dark">
        {loading && page === 1 ? 'Searching…' : `${data?.total ?? 0} matching opportunit${data?.total === 1 ? 'y' : 'ies'}`}
      </h2>
      {!loading && data?.total === 0 && (
        <Empty title="No opportunities match these filters">
          <p>Try widening the date range or clearing a filter.</p>
        </Empty>
      )}
      <div className="card-grid">
        {items.map((o) => (
          <GreyCard key={o.slug} to={`/opportunities/${o.slug}`} category={o.category} image={o.image} title={o.title}
            bullets={o.bullets.slice(0, 2)} meta={<OppMeta o={o} />} />
        ))}
      </div>
      {data && page < data.pages && (
        <div className="center"><button className="btn btn--solid" onClick={() => setPage((p) => p + 1)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button></div>
      )}
    </section>
  )
}

function Sections() {
  const inv = useFetch(() => api.opportunities({ category: 'investment', page_size: 12 }), [])
  const trv = useFetch(() => api.opportunities({ category: 'travel', page_size: 12 }), [])
  const oth = useFetch(() => api.opportunities({ category: 'other', page_size: 6 }), [])
  const sk = (n, h = 360) => Array.from({ length: n }).map((_, i) => <Skeleton key={i} h={h} />)

  return (
    <>
      <section className="grid-section">
        <h2 className="grid-section__title grid-section__title--dark">Investment Opportunities</h2>
        {inv.error && <ErrorState error={inv.error} onRetry={inv.reload} />}
        <div className="card-grid">
          {inv.loading ? sk(3) : inv.data?.items.map((o) => (
            <GreyCard key={o.slug} to={`/opportunities/${o.slug}`} category={o.category} image={o.image}
              title={o.title} bullets={o.bullets.slice(0, 2)} meta={<OppMeta o={o} />} />
          ))}
        </div>
      </section>

      <section className="grid-section grid-section--red">
        <h2 className="grid-section__title grid-section__title--white">Travel Attractions</h2>
        <div className="card-grid card-grid--photo">
          {trv.loading ? sk(3, 260) : trv.data?.items.map((o) => (
            <PhotoCard key={o.slug} tone="dark" to={`/opportunities/${o.slug}`} category={o.category} image={o.image} title={o.title}
              text={o.summary} badge={o.sector} />
          ))}
        </div>
      </section>

      <section className="grid-section">
        <h2 className="grid-section__title grid-section__title--dark">Other Opportunities</h2>
        <div className="card-grid card-grid--two">
          {oth.loading ? sk(2) : oth.data?.items.map((o) => (
            <GreyCard key={o.slug} to={`/opportunities/${o.slug}`} category={o.category} image={o.image} title={o.title} bullets={o.bullets} />
          ))}
        </div>
      </section>
    </>
  )
}
