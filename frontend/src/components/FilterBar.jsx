import { useEffect, useRef, useState } from 'react'
import { Chevron, Search } from './Icons'

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

/** Dark pill dropdown ("Country ▾", "Type ▾") from the Opportunities design. */
export function PillSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, () => setOpen(false))
  return (
    <div className="pill-wrap" ref={ref}>
      <button type="button" className={`pill ${value ? 'pill--set' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {value || label} <Chevron size={12} dir={open ? 'up' : 'down'} />
      </button>
      {open && (
        <ul className="pill-menu" role="listbox">
          <li><button type="button" className={!value ? 'is-active' : ''} onClick={() => { onChange(''); setOpen(false) }}>All {label.toLowerCase()}</button></li>
          {options.map((o) => (
            <li key={o}>
              <button type="button" className={o === value ? 'is-active' : ''} onClick={() => { onChange(o); setOpen(false) }}>{o}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Month calendar popover. Click the month or the year in the header to jump straight to it. */
export function Calendar({ value, onChange }) {
  const init = value ? new Date(value + 'T00:00:00') : new Date()
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth(), 1))
  const [mode, setMode] = useState('days') // days | months | years
  const y = view.getFullYear()
  const m = view.getMonth()
  const yearStart = y - (y % 12) // 12-year page
  const today = iso(new Date())

  const move = (n) => {
    if (mode === 'days') setView(new Date(y, m + n, 1))
    else if (mode === 'months') setView(new Date(y + n, m, 1))
    else setView(new Date(y + n * 12, m, 1))
  }
  const cells = [...Array(new Date(y, m, 1).getDay()).fill(null), ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => i + 1)]
  const label = mode === 'years' ? 'previous 12 years' : mode === 'months' ? 'previous year' : 'previous month'

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button type="button" onClick={() => move(-1)} aria-label={label}><Chevron dir="left" size={16} /></button>
        <div className="calendar__title">
          {mode === 'years' ? (
            <span>{yearStart} – {yearStart + 11}</span>
          ) : (
            <>
              <button type="button" className={`calendar__pick ${mode === 'months' ? 'is-on' : ''}`}
                onClick={() => setMode(mode === 'months' ? 'days' : 'months')} aria-label="Choose month">
                {view.toLocaleDateString('en-US', { month: 'long' })}
              </button>
              <button type="button" className="calendar__pick" onClick={() => setMode('years')} aria-label="Choose year">{y}</button>
            </>
          )}
        </div>
        <button type="button" onClick={() => move(1)} aria-label={label.replace('previous', 'next')}><Chevron dir="right" size={16} /></button>
      </div>

      {mode === 'months' && (
        <div className="calendar__picker">
          {MONTHS.map((name, i) => (
            <button type="button" key={name} className={i === m ? 'is-selected' : ''}
              onClick={() => { setView(new Date(y, i, 1)); setMode('days') }}>{name}</button>
          ))}
        </div>
      )}
      {mode === 'years' && (
        <div className="calendar__picker">
          {Array.from({ length: 12 }, (_, i) => yearStart + i).map((yr) => (
            <button type="button" key={yr} className={yr === y ? 'is-selected' : ''}
              onClick={() => { setView(new Date(yr, m, 1)); setMode('months') }}>{yr}</button>
          ))}
        </div>
      )}
      {mode === 'days' && (
        <>
          <div className="calendar__dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="calendar__grid">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const key = iso(new Date(y, m, d))
              return (
                <button type="button" key={i} onClick={() => onChange(key === value ? '' : key)}
                  className={`${key === value ? 'is-selected' : ''} ${key === today ? 'is-today' : ''}`}>
                  {d}
                </button>
              )
            })}
          </div>
        </>
      )}
      {value && (
        <button type="button" className="calendar__clear" onClick={() => onChange('')}>Clear date</button>
      )}
    </div>
  )
}

export function DatePill({ label, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, () => setOpen(false))
  const shown = value ? `Since ${new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : label
  return (
    <div className="pill-wrap" ref={ref}>
      <button type="button" className={`pill ${value ? 'pill--set' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {shown} <Chevron size={12} dir={open ? 'up' : 'down'} />
      </button>
      {open && (
        <div className="pill-pop">
          <Calendar value={value} onChange={(v) => { onChange(v); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  return (
    <label className="searchbox">
      <Search size={16} />
      <span className="sr-only">Search</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
