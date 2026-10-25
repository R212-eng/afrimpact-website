import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useUI } from '../context/UIContext'
import { formatDate, img } from '../lib/utils'
import seed from '@seed'

const LABEL = { news: 'News', opportunities: 'Opportunities', events: 'Events' }
const SINGULAR = { news: 'article', opportunities: 'opportunity', events: 'event' }

// ------------------------------------------------------------------ field specs
// [name, label, type, options]  types: text, textarea, select, combo, date, datetime, number, bool, image, list, paras, tags
const SPECS = {
  news: {
    main: [
      ['title', 'Headline', 'text', { required: true }],
      ['excerpt', 'Summary (shown on cards and in the newsletter)', 'textarea', { required: true, rows: 3 }],
      ['body', 'Article body', 'paras'],
      ['image', 'Cover image', 'image'],
    ],
    side: [
      ['is_published', 'Published on the website', 'bool'],
      ['notify_subscribers', 'Email newsletter subscribers when published', 'bool', { onlyUnsent: true }],
      ['is_featured', 'Featured story (top of News & Events)', 'bool'],
      ['category', 'Category', 'combo', { options: ['Company News', 'Insights', 'Travel', 'Events', 'Careers', 'Contributors'] }],
      ['author', 'Author', 'text'],
      ['author_image', 'Author photo', 'image', { small: true }],
      ['published_at', 'Publish date', 'datetime'],
      ['read_minutes', 'Read time (minutes)', 'number', { auto: true }],
      ['tags', 'Tags', 'tags'],
    ],
  },
  opportunities: {
    main: [
      ['title', 'Title', 'text', { required: true }],
      ['summary', 'Short summary', 'textarea', { rows: 2 }],
      ['bullets', 'Card bullet points', 'list'],
      ['body', 'Overview (full description)', 'paras'],
      ['highlights', 'Key highlights', 'list'],
      ['image', 'Image', 'image'],
    ],
    side: [
      ['is_published', 'Published on the website', 'bool'],
      ['is_featured', 'Featured', 'bool'],
      ['category', 'Category', 'select', { options: [['investment', 'Investment'], ['travel', 'Travel attraction'], ['other', 'Other / advisory']] }],
      ['type', 'Type', 'combo', { options: ['Investment', 'Partnership', 'Travel', 'Advisory'] }],
      ['country', 'Country', 'combo', { required: true, options: ['Ethiopia', 'Kenya', 'Rwanda', 'Tanzania', 'Uganda', 'Pan-African'] }],
      ['location', 'City / region', 'text'],
      ['sector', 'Sector / experience', 'text'],
      ['investment_range', 'Investment range', 'text', { hint: 'e.g. $2M – $8M (leave empty for travel)' }],
      ['deadline', 'Deadline', 'date'],
      ['posted_at', 'Post date', 'date'],
    ],
  },
  events: {
    main: [
      ['title', 'Event name', 'text', { required: true }],
      ['subtitle', 'Subtitle', 'text'],
      ['excerpt', 'Summary', 'textarea', { rows: 3 }],
      ['body', 'Details', 'paras'],
      ['image', 'Image', 'image'],
    ],
    side: [
      ['is_published', 'Published on the website', 'bool'],
      ['is_featured', 'Featured', 'bool'],
      ['start_at', 'Starts', 'datetime', { required: true }],
      ['end_at', 'Ends', 'datetime'],
      ['location', 'City / country', 'text'],
      ['venue', 'Venue', 'text'],
      ['capacity', 'Capacity (seats)', 'number'],
    ],
  },
}
const DEFAULTS = {
  news: { category: 'Company News', author: 'Afrimpact Team', is_published: true, notify_subscribers: true, read_minutes: 3 },
  opportunities: { category: 'investment', type: 'Investment', country: 'Ethiopia', is_published: true },
  events: { is_published: true },
}

const toLocal = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// ------------------------------------------------------------------ list
export function ContentList({ kind, ctx }) {
  const { toast } = useUI()
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const [confirm, setConfirm] = useState(null)
  const load = () => api.adminContent(ctx.token, kind).then(setRows)
  useEffect(() => { load() }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (r) => {
    if (confirm !== r.id) return setConfirm(r.id)
    await api.adminDelete(ctx.token, kind, r.id)
    toast(`Deleted "${r.title}"`)
    setConfirm(null)
    load()
    ctx.refresh()
  }
  const filters = kind === 'opportunities'
    ? [['', 'All'], ['investment', 'Investment'], ['travel', 'Travel'], ['other', 'Other']]
    : [['', 'All'], ['published', 'Published'], ['draft', 'Drafts']]
  const shown = (rows || []).filter((r) => {
    if (q && !`${r.title} ${r.slug}`.toLowerCase().includes(q.toLowerCase())) return false
    if (!filter) return true
    if (filter === 'published') return r.is_published !== false
    if (filter === 'draft') return r.is_published === false
    return r.category === filter
  })

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div><h1>{LABEL[kind]}</h1><p className="adm-muted">{rows ? `${rows.length} ${kind === 'news' ? 'articles' : kind}` : ' '}</p></div>
        <div className="adm-actions"><Link to={`/admin/${kind}/new`} className="adm-btn adm-btn--primary">+ New {SINGULAR[kind]}</Link></div>
      </div>
      <div className="adm-filters">
        <input className="adm-input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="adm-chips adm-chips--inline">
          {filters.map(([v, l]) => <button key={v} className={filter === v ? 'is-on' : ''} onClick={() => setFilter(v)}>{l}</button>)}
        </div>
      </div>
      {!rows ? <div className="adm-loading"><span className="spinner" /></div> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th /><th>Title</th><th>{kind === 'events' ? 'Date' : kind === 'news' ? 'Category' : 'Category'}</th>
              <th>{kind === 'news' ? 'Published' : kind === 'events' ? 'Venue' : 'Country'}</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="adm-thumb">{r.image && <img src={img(r.image)} alt="" />}</td>
                  <td><Link to={`/admin/${kind}/${r.id}`} className="adm-title-link">{r.title}</Link><small className="adm-muted adm-block">/{r.slug}</small></td>
                  <td>{kind === 'events' ? formatDate(r.start_at) : r.category}</td>
                  <td>{kind === 'news' ? formatDate(r.published_at) : kind === 'events' ? (r.venue || '—') : r.country}</td>
                  <td>
                    <span className={`adm-pill ${r.is_published === false ? 'adm-pill--pending' : 'adm-pill--approved'}`}>{r.is_published === false ? 'draft' : 'live'}</span>
                    {kind === 'news' && r.newsletter_sent_at && <span className="adm-pill adm-pill--sent" title="Newsletter sent">✉ sent</span>}
                  </td>
                  <td className="adm-row-actions">
                    <Link to={`/admin/${kind}/${r.id}`} className="adm-btn adm-btn--sm">Edit</Link>
                    <button className={`adm-btn adm-btn--sm ${confirm === r.id ? 'adm-btn--danger' : ''}`} onClick={() => remove(r)}>
                      {confirm === r.id ? 'Confirm delete' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ editor
export function ContentEditor({ kind, id, ctx }) {
  const { toast } = useUI()
  const nav = useNavigate()
  const isNew = id === 'new'
  const spec = SPECS[kind]
  const [item, setItem] = useState(isNew ? {} : null)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isNew) {
      setForm({ ...DEFAULTS[kind] })
      return
    }
    api.adminGet(ctx.token, kind, Number(id)).then((r) => {
      setItem(r)
      setForm({ ...r, notify_subscribers: !r.newsletter_sent_at })
    }).catch((e) => setErr(e.message))
  }, [kind, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const words = useMemo(() => (form?.body || []).join(' ').split(/\s+/).filter(Boolean).length, [form?.body])

  if (err && !form) return <div className="adm-page"><p className="adm-error">{err}</p></div>
  if (!form) return <div className="adm-loading"><span className="spinner" /></div>

  const all = [...spec.main, ...spec.side]
  const save = async (e) => {
    e?.preventDefault()
    const errs = {}
    all.forEach(([k, label, , o = {}]) => {
      if (o.required && !String(form[k] ?? '').trim()) errs[k] = `${label} is required`
    })
    setErrors(errs)
    if (Object.keys(errs).length) return setErr('Please fill in the highlighted fields.')
    setErr('')
    setSaving(true)
    const body = {}
    all.forEach(([k, , t]) => {
      let v = form[k]
      if (t === 'number') v = v === '' || v == null ? null : Number(v)
      if ((t === 'date' || t === 'datetime') && !v) v = null
      if (t === 'datetime' && v) v = new Date(v).toISOString()
      if (['list', 'paras', 'tags'].includes(t)) v = (v || []).map((x) => String(x).trim()).filter(Boolean)
      body[k] = v ?? (t === 'bool' ? false : t === 'text' || t === 'textarea' ? '' : null)
    })
    if (kind === 'news' && !form.read_minutes) body.read_minutes = Math.max(1, Math.round(words / 200))
    try {
      const r = isNew ? await api.adminCreate(ctx.token, kind, body) : await api.adminUpdate(ctx.token, kind, item.id, body)
      toast(r.newsletter_queued ? 'Saved and published — newsletter is being emailed to subscribers' : 'Saved')
      ctx.refresh()
      if (isNew) nav(`/admin/${kind}/${r.id}`, { replace: true })
      else {
        setItem(r)
        setForm({ ...r, notify_subscribers: !r.newsletter_sent_at })
      }
    } catch (x) {
      setErr(x.message)
    } finally {
      setSaving(false)
    }
  }
  const resend = async () => {
    try {
      toast((await api.adminSendNewsletter(ctx.token, item.id)).message)
    } catch (x) {
      toast(x.message, 'error')
    }
  }
  const publicPath = kind === 'news' ? `/news/${item?.slug}` : kind === 'events' ? `/events/${item?.slug}` : `/opportunities/${item?.slug}`

  const field = ([k, label, t, o = {}]) => {
    if (o.onlyUnsent && item?.newsletter_sent_at) {
      return (
        <div key={k} className="adm-field adm-field--note">
          <span>Newsletter</span>
          <p>Emailed to subscribers on {formatDate(item.newsletter_sent_at)}.</p>
          <button type="button" className="adm-btn adm-btn--sm" onClick={resend}>Send again</button>
        </div>
      )
    }
    return <Field key={k} name={k} label={label} type={t} opts={o} value={form[k]} onChange={(v) => set(k, v)} error={errors[k]}
      ctx={ctx} words={words} />
  }

  return (
    <form className="adm-page" onSubmit={save} noValidate>
      <div className="adm-page__head adm-page__head--sticky">
        <div>
          <Link to={`/admin/${kind}`} className="adm-crumb">← {LABEL[kind]}</Link>
          <h1>{isNew ? `New ${SINGULAR[kind]}` : form.title || 'Untitled'}</h1>
        </div>
        <div className="adm-actions">
          {!isNew && item?.is_published !== false && <a className="adm-btn" href={import.meta.env.VITE_DEMO_MODE === 'true' ? `#${publicPath}` : publicPath} target="_blank" rel="noreferrer">View on site ↗</a>}
          <button className="adm-btn adm-btn--primary" disabled={saving}>{saving ? 'Saving…' : isNew ? `Create ${SINGULAR[kind]}` : 'Save changes'}</button>
        </div>
      </div>
      {err && <p className="adm-error">{err}</p>}
      <div className="adm-editor">
        <div className="adm-card adm-editor__main">{spec.main.map(field)}</div>
        <div className="adm-card adm-editor__side">{spec.side.map(field)}</div>
      </div>
    </form>
  )
}

function Field({ name, label, type, opts, value, onChange, error, ctx, words }) {
  const id = `adm-${name}`
  const wrap = (control, extra) => (
    <label className={`adm-field ${error ? 'is-error' : ''}`} htmlFor={id}>
      <span>{label}{opts.required && <em> *</em>}</span>
      {control}
      {opts.hint && <small className="adm-muted">{opts.hint}</small>}
      {extra}
      {error && <small className="adm-error-text">{error}</small>}
    </label>
  )
  switch (type) {
    case 'textarea':
      return wrap(<textarea id={id} className="adm-input" rows={opts.rows || 3} value={value || ''} onChange={(e) => onChange(e.target.value)} />)
    case 'select':
      return wrap(
        <select id={id} className="adm-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          {opts.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>,
      )
    case 'combo':
      return wrap(
        <>
          <input id={id} className="adm-input" list={`${id}-list`} value={value || ''} onChange={(e) => onChange(e.target.value)} />
          <datalist id={`${id}-list`}>{opts.options.map((o) => <option key={o} value={o} />)}</datalist>
        </>,
      )
    case 'date':
      return wrap(<input id={id} type="date" className="adm-input" value={(value || '').slice(0, 10)} onChange={(e) => onChange(e.target.value)} />)
    case 'datetime':
      return wrap(<input id={id} type="datetime-local" className="adm-input" value={toLocal(value)} onChange={(e) => onChange(e.target.value)} />)
    case 'number':
      return wrap(<input id={id} type="number" min="0" className="adm-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />,
        opts.auto && <small className="adm-muted">{words} words ≈ {Math.max(1, Math.round(words / 200))} min. Leave empty to calculate.</small>)
    case 'bool':
      return (
        <label className="adm-switch" htmlFor={id}>
          <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <i aria-hidden="true" /><span>{label}</span>
        </label>
      )
    case 'image':
      return <ImageField id={id} label={label} value={value} onChange={onChange} ctx={ctx} small={opts.small} />
    case 'list':
      return <ListField id={id} label={label} value={value || []} onChange={onChange} />
    case 'tags':
      return wrap(<input id={id} className="adm-input" placeholder="comma, separated" value={(value || []).join(', ')}
        onChange={(e) => onChange(e.target.value.split(',').map((t) => t.trim()))} />)
    case 'paras':
      return <ParasField id={id} label={label} value={value || []} onChange={onChange} />
    default:
      return wrap(<input id={id} className="adm-input" value={value || ''} onChange={(e) => onChange(e.target.value)} />)
  }
}

function ImageField({ id, label, value, onChange, ctx, small }) {
  const { toast } = useUI()
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      onChange((await api.adminUpload(ctx.token, file)).url)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="adm-field">
      <span>{label}</span>
      <div className={`adm-image ${small ? 'adm-image--sm' : ''} ${drag ? 'is-drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]) }}>
        {value ? <img src={img(value)} alt="" /> : <p>Drop an image here or choose a file<br /><small>JPG, PNG or WebP, up to 8 MB</small></p>}
        <div className="adm-image__bar">
          <button type="button" className="adm-btn adm-btn--sm" onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}</button>
          {value && <button type="button" className="adm-btn adm-btn--sm" onClick={() => onChange('')}>Remove</button>}
        </div>
        <input ref={ref} id={id} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <input className="adm-input adm-input--sm" placeholder="…or paste an image URL / path" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ListField({ id, label, value, onChange }) {
  const set = (i, v) => onChange(value.map((x, j) => (j === i ? v : x)))
  return (
    <div className="adm-field">
      <span>{label}</span>
      <div className="adm-list">
        {value.map((v, i) => (
          <div key={i} className="adm-list__row">
            <input id={i === 0 ? id : undefined} className="adm-input" value={v} onChange={(e) => set(i, e.target.value)} />
            <button type="button" className="adm-btn adm-btn--sm" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="adm-btn adm-btn--sm adm-btn--dashed" onClick={() => onChange([...value, ''])}>+ Add item</button>
      </div>
    </div>
  )
}

function ParasField({ id, label, value, onChange }) {
  const [preview, setPreview] = useState(false)
  const text = value.join('\n\n')
  return (
    <div className="adm-field">
      <span className="adm-field__row">{label}
        <button type="button" className="adm-link" onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</button>
      </span>
      {preview ? (
        <div className="adm-preview prose">
          {value.filter(Boolean).map((p, i) => (p.startsWith('## ') ? <h2 key={i}>{p.slice(3)}</h2> : <p key={i}>{p}</p>))}
        </div>
      ) : (
        <textarea id={id} className="adm-input adm-input--body" rows={12} value={text}
          onChange={(e) => onChange(e.target.value.split(/\n\s*\n/))}
          placeholder={'Write paragraphs separated by a blank line.\n\n## Start a line with two hashes for a sub-heading'} />
      )}
      <small className="adm-muted">Blank line = new paragraph · “## ” = sub-heading</small>
    </div>
  )
}
