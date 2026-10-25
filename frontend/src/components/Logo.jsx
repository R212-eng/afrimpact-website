// Recreated Afrimpact marks (vector, so they stay crisp at any size).
// Replace with the official logo files when available.

function Waves({ color = '#fff', size = 40 }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 64 40" fill="none" aria-hidden="true">
      <circle cx="6" cy="20" r="3" fill={color} />
      <g stroke={color} strokeWidth="2.6" strokeLinecap="round">
        <path d="M14 11a13 13 0 0 1 0 18" />
        <path d="M20 5a21 21 0 0 1 0 30" />
        <path d="M44 11a13 13 0 0 0 0 18" />
        <path d="M38 5a21 21 0 0 0 0 30" />
      </g>
      <circle cx="56" cy="20" r="3" fill={color} />
    </svg>
  )
}

/** Circular badge used in the site header (161px in the design). */
export function LogoBadge({ size = 105 }) {
  return (
    <div className="logo-badge" style={{ width: size, height: size }}>
      <Waves size={size * 0.27} />
      <span className="logo-badge__name" style={{ fontSize: size * 0.098 }}>AFRIMPACT</span>
      <span className="logo-badge__sub" style={{ fontSize: size * 0.066 }}>CONSULTANCY</span>
      <span className="logo-badge__line" />
    </div>
  )
}

/** Horizontal white wordmark used over the home hero photo. */
export function LogoWordmark() {
  return (
    <div className="logo-wordmark">
      <Waves size={96} />
      <div>
        <span>Afrimpact</span>
        <span>Consultancy</span>
      </div>
    </div>
  )
}
