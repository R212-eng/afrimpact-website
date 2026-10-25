import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { DEMO } from '../api'
import { useUI } from '../context/UIContext'
import { Chevron, Clock, Close, Facebook, Instagram, LinkedIn, Mail, Menu, Phone, Pin, XTwitter, YouTube } from './Icons'
import { LogoBadge } from './Logo'
import { track } from '../lib/utils'
import seed from '@seed'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/services', label: 'Services' },
  { to: '/news-events', label: 'News & Events' },
  { to: '/contact', label: 'Contact Us' },
]

export const CONTACT = seed.site.contact
export const SOCIALS = seed.site.socials

export function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="site-header">
      <Link to="/" className="site-header__logo" aria-label="Afrimpact Consultancy home">
        <LogoBadge />
      </Link>
      <button className="site-header__burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
        {open ? <Close size={26} /> : <Menu size={26} />}
      </button>
      <nav className={`site-nav ${open ? 'is-open' : ''}`} aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="site-nav__item">
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

export function SocialLinks({ size = 32, chips = false }) {
  return (
    <div className={`social-links ${chips ? 'social-links--chips' : ''}`}>
      <a href={SOCIALS.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={size} /></a>
      <a href={SOCIALS.youtube} target="_blank" rel="noreferrer" aria-label="YouTube"><YouTube size={size + 2} /></a>
      <a href={SOCIALS.x} target="_blank" rel="noreferrer" aria-label="X"><XTwitter size={size - 2} /></a>
      <a href={SOCIALS.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn"><LinkedIn size={size - 1} /></a>
      <a href={SOCIALS.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={size + 2} /></a>
    </div>
  )
}

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <Link to="/" aria-label="Afrimpact Consultancy home"><LogoBadge size={84} /></Link>
          <p>Investment consulting and travel advisory across Africa, from market entry to the journey itself.</p>
          <SocialLinks size={20} chips />
        </div>
        <nav className="site-footer__col" aria-label="Footer">
          <h4>Explore</h4>
          {NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}</Link>)}
        </nav>
        <div className="site-footer__col">
          <h4>Services</h4>
          <Link to="/services#investment">Investment Consulting</Link>
          <Link to="/services#travel">Travel Advisory</Link>
          <Link to="/services#other">Other Services</Link>
          <Link to="/opportunities">Current Opportunities</Link>
        </div>
        <div className="site-footer__col site-footer__contact">
          <h4>Get in touch</h4>
          <a href={`mailto:${CONTACT.email}`}><Mail size={16} /> {CONTACT.email}</a>
          <a href={`tel:${CONTACT.phone}`}><Phone size={16} /> {CONTACT.phone}</a>
          <span><Pin size={16} /> {CONTACT.address}</span>
          <span><Clock size={16} /> {CONTACT.hours}</span>
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {year} Afrimpact Consultancy. All rights reserved.</span>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="site-footer__top-btn">
          Back to top <Chevron dir="up" size={14} />
        </button>
      </div>
    </footer>
  )
}

/** Red band with the outlined "Request a Consultation" button (design frame 6). */
export function ConsultationCTA({ interest }) {
  const { openConsultation } = useUI()
  return (
    <section className="cta-band">
      <button className="cta-band__btn" onClick={() => openConsultation({ interest })}>
        Request a Consultation
      </button>
    </section>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    track('page', pathname, 'view')
  }, [pathname])
  return (
    <>
      {DEMO && (
        <div className="demo-banner">
          Live demo · sample content · forms are saved in this browser · <a href="#/admin">Admin portal</a> (admin@afrimpact.com / demo1234)
        </div>
      )}
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
