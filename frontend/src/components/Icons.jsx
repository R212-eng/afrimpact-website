const S = ({ children, size = 18, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
)

export const Heart = ({ filled, ...p }) => (
  <S {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
  </S>
)
export const Share = (p) => (
  <S {...p}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></S>
)
export const Bookmark = ({ filled, ...p }) => (
  <S {...p} fill={filled ? 'currentColor' : 'none'}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></S>
)
export const Chevron = ({ dir = 'down', ...p }) => {
  const r = { down: 0, up: 180, left: 90, right: -90 }[dir]
  return <S {...p} style={{ transform: `rotate(${r}deg)` }}><path d="M6 9l6 6 6-6" /></S>
}
export const Arrow = (p) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>
export const Pin = (p) => <S {...p}><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></S>
export const Calendar = (p) => <S {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></S>
export const Clock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>
export const Search = (p) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></S>
export const Check = (p) => <S {...p}><path d="M20 6L9 17l-5-5" /></S>
export const Close = (p) => <S {...p}><path d="M18 6L6 18M6 6l12 12" /></S>
export const Menu = (p) => <S {...p}><path d="M3 6h18M3 12h18M3 18h18" /></S>
export const Mail = (p) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></S>
export const Phone = (p) => (
  <S {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></S>
)
export const Users = (p) => <S {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" /></S>
export const Briefcase = (p) => <S {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></S>
export const Globe = (p) => <S {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></S>
export const Tag = (p) => <S {...p}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1.5" /></S>
export const Plane = (p) => (
  <S {...p}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></S>
)
export const Spark = (p) => <S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></S>
export const Eye = (p) => <S {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></S>
export const Download = (p) => <S {...p}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></S>
export const Link = (p) => <S {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></S>

// ---- brand-coloured social icons (as in the design footer)
export const Facebook = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#0866FF" d="M14 8V6.2c0-.8.2-1.2 1.4-1.2H17V1.2C16.7 1.1 15.6 1 14.4 1 11.8 1 10 2.6 10 5.5V8H7v4h3v11h4V12h3l.5-4H14z" />
  </svg>
)
export const YouTube = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1" y="4.5" width="22" height="15" rx="4" fill="#FF0000" />
    <path d="M10 8.8v6.4l5.5-3.2z" fill="#fff" />
  </svg>
)
export const XTwitter = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#000" d="M17.8 2h3.3l-7.2 8.3L22.4 22h-6.6l-5.2-6.8L4.6 22H1.3l7.7-8.8L.9 2h6.8l4.7 6.2L17.8 2zm-1.2 18h1.8L6.6 3.9H4.6L16.6 20z" />
  </svg>
)
export const LinkedIn = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="3" fill="#0A66C2" />
    <path fill="#fff" d="M5.3 9.2h3v9.6h-3zM6.8 4.5a1.7 1.7 0 1 1 0 3.5 1.7 1.7 0 0 1 0-3.5zM10.2 9.2h2.9v1.3c.4-.8 1.4-1.6 2.9-1.6 3 0 3.6 2 3.6 4.6v5.3h-3v-4.7c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5v4.8h-3z" />
  </svg>
)
export const Instagram = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#FEDA75" /><stop offset=".3" stopColor="#FA7E1E" />
        <stop offset=".6" stopColor="#D62976" /><stop offset="1" stopColor="#4F5BD5" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#ig)" />
    <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
    <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
  </svg>
)
