// Iconos de línea (Lucide-style, 2px rounded). Tamaño 24, stroke=currentColor.
type P = { size?: number; className?: string; style?: React.CSSProperties }
const base = (size = 24): React.SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
})

export const IcHome = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
  </svg>
)
export const IcDiary = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M4 4h16v16H4z" /><path d="M8 4v16" /><path d="M12 9h5M12 13h5" />
  </svg>
)
export const IcProto = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M4 7h16M4 7v13h16V7M8 3v4M16 3v4" /><path d="M8 12h3M8 16h6" />
  </svg>
)
export const IcGear = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
)
export const IcChevron = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}><path d="m9 6 6 6-6 6" /></svg>
)
export const IcBack = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}><path d="m15 6-6 6 6 6" /></svg>
)
export const IcClose = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IcDrop = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z" />
  </svg>
)
export const IcLeaf = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M4 20c8 1 14-4 16-16C10 4 5 9 4 20Z" /><path d="M4 20C7 14 11 11 16 9" />
  </svg>
)
export const IcCheck = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}><path d="m5 12 5 5L20 6" /></svg>
)
export const IcShield = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
  </svg>
)
export const IcBell = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
)
export const IcVida = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M3 12h4l2.5-7 4 14 2.5-7H21" />
  </svg>
)
export const IcFood = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M7 3v6a2 2 0 0 0 4 0V3" /><path d="M9 9v12" />
    <path d="M16 3c-2 1-2 7 0 8v10" />
  </svg>
)
export const IcWeek = (p: P) => (
  <svg {...base(p.size)} className={p.className} style={p.style}>
    <path d="M4 21h16" /><path d="M7 21v-6" /><path d="M12 21v-11" /><path d="M17 21v-8" />
  </svg>
)
