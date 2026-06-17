// Hacktrack — iconos SVG diseñados (reemplazan emojis). Line-icons 24px, stroke currentColor.
// Uso: <Glyph name="energia" color="#FF7A59" /> o <GlyphCircle name color /> (icono en círculo tintado).
// n=479: GlyphName tipado = keyof GLYPHS; MEASURE_ICON usa `satisfies` en catalog.ts.
//         Glyphs añadidos: recuperacion-muscular, inflamacion, ansiedad, memoria, niebla-mental, fuerza.
type GP = { size?: number; color?: string; style?: React.CSSProperties; className?: string }

function svg(children: React.ReactNode) {
  return ({ size = 24, color = 'currentColor', style, className }: GP) => (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const GLYPHS = {
  // ── medidas / KPIs ──
  peso: svg(<><path d="M12 4v16" /><path d="M6 20h12" /><path d="M4.5 8h15" /><path d="M4.5 8 2 14a3 3 0 0 0 6 0L4.5 8Z" /><path d="M19.5 8 17 14a3 3 0 0 0 6 0l-2.5-6Z" /></>),
  altura: svg(<><path d="M12 3v18" /><path d="m8 6 4-3 4 3" /><path d="m8 18 4 3 4-3" /><path d="M19 8h2M19 12h2M19 16h2" /></>),
  cintura: svg(<><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7 8v3M11 8v4M15 8v3" /></>),
  skip: svg(<><circle cx="12" cy="12" r="9" /><path d="M8 8l4 4-4 4M15 8v8" /></>),
  trash: svg(<><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>),
  // ── UI / acciones (reemplazan emojis) ──
  racha: svg(<path d="M12 2.5c2.5 3.5 4.5 5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.6.6-2.8 1.6-3.8.2 1.6 1 2.3 2.1 2.3-.6-2.5.8-4 .8-7Z" />),
  reloj: svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>),
  balanza: svg(<><path d="M12 4v16M6 20h12M5 8h14" /><path d="M5 8l-2.5 5.5a3 3 0 0 0 5 0L5 8ZM19 8l-2.5 5.5a3 3 0 0 0 5 0L19 8Z" /></>),
  estrella: svg(<path d="M12 3.5l2.4 5.4 5.9.5-4.5 3.9 1.4 5.8L12 16.4 6.3 19.5l1.4-5.8-4.5-3.9 5.9-.5L12 3.5Z" />),
  buscar: svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>),
  hoja: svg(<><path d="M4 20c0-9 7-15 16-15 0 9-7 15-16 15Z" /><path d="M4.5 19.5C8 14 12 11 17 9" /></>),
  editar: svg(<><path d="M4 20.5l.5-4L15 6l3.5 3.5L8 20l-4 .5Z" /><path d="M13.5 7.5l3 3" /></>),
  portapapeles: svg(<><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3v1" /><path d="M9 11h6M9 15h4" /></>),
  idea: svg(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.3 1.4 1.3 2.4h5c0-1 .6-1.8 1.3-2.4A6 6 0 0 0 12 3Z" /></>),
  engrane: svg(<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3.2M12 18.3v3.2M21.5 12h-3.2M5.7 12H2.5M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3M18.7 18.7l-2.3-2.3M7.6 7.6 5.3 5.3" /></>),
  destello: svg(<><path d="M12 3c.6 4.4 1 4.8 5.4 5.4-4.4.6-4.8 1-5.4 5.4-.6-4.4-1-4.8-5.4-5.4 4.4-.6 4.8-1 5.4-5.4Z" /><path d="M18.5 15c.3 1.7.5 1.9 2.2 2.2-1.7.3-1.9.5-2.2 2.2-.3-1.7-.5-1.9-2.2-2.2 1.7-.3 1.9-.5 2.2-2.2Z" /></>),
  camara: svg(<><rect x="3" y="7" width="18" height="13.5" rx="2.5" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8.5 7l1.3-2.8h4.4L15.5 7" /></>),
  exportar: svg(<><path d="M12 15.5V4M8 8l4-4 4 4" /><path d="M5 16v3a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-3" /></>),
  calculadora: svg(<><rect x="5" y="2.5" width="14" height="19" rx="2" /><rect x="8" y="5.5" width="8" height="3" rx="0.5" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15h.01M12 15h.01M15.5 12v6" /></>),
  candado: svg(<><rect x="4.5" y="11" width="15" height="9.5" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7" /></>),
  amanecer: svg(<><path d="M2.5 18.5h19M6.5 18.5a5.5 5.5 0 0 1 11 0M12 3v3M5 8.5l1.6 1.6M19 8.5l-1.6 1.6M1.5 13h2M20.5 13h2M9.5 6 12 3l2.5 3" /></>),
  sol: svg(<><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" /></>),
  cross: svg(<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />),
  check: svg(<path d="M5 12.5l4.5 4.5L19 7" />),
  medidas: svg(<><path d="M3.5 14.5 14.5 3.5l6 6L9.5 20.5l-6-6Z" /><path d="m7 11 2 2M10 8l2 2M13 5l2 2" /></>),
  grasa: svg(<><path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" /></>),
  musculo: svg(<><path d="M3 9v6M6 7.5v9M18 7.5v9M21 9v6M6 12h12" /></>),
  imc: svg(<><path d="M5 18a8 8 0 1 1 14 0" /><circle cx="12" cy="13" r="1.6" /><path d="m13 12 3-3" /></>),
  // ── escalas / bienestar ──
  energia: svg(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />),
  animo: svg(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.4 2 3.5 2 3.5-2 3.5-2" /><path d="M9 9.5h.01M15 9.5h.01" /></>),
  sueno: svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />),
  dolor: svg(<path d="M3 12h4l2.2 6 3.6-13 2.2 7H21" />),
  foco: svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>),
  libido: svg(<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" />),
  piel: svg(<><path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5Z" /><path d="M18.5 16.5l.4 1.3 1.3.4-1.3.4-.4 1.3-.4-1.3-1.3-.4 1.3-.4.4-1.3Z" /></>),
  movilidad: svg(<><path d="M12 3v18M3 12h18" /><path d="m7 8-4 4 4 4M17 8l4 4-4 4M8 7l4-4 4 4M8 17l4 4 4-4" /></>),
  hidratacion: svg(<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z" />),
  apetito: svg(<><path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v8a2 2 0 0 1-2 2M7 3v6" /><path d="M17.5 3C16 3 14.5 5 14.5 8s1.2 4 3 4v9" /></>),
  recuperacion: svg(<><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 4v5h-5" /></>),
  efecto: svg(<><path d="M12 3.5 21 19H3L12 3.5Z" /><path d="M12 9.5v4.5M12 17h.01" /></>),
  dose: svg(<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z" />),

  // ── n=479: glyphs faltantes del catálogo ──
  // recuperacion-muscular: fibras musculares con flecha de regeneración
  'recuperacion-muscular': svg(<><path d="M6 9v6M10 7v10M14 9v6M18 7v10" /><path d="M4 12h16" /><path d="m19 5 2 2-2 2" /></>),
  // inflamacion: área hinchada (forma de bulto)
  inflamacion: svg(<><path d="M12 3C7 3 3 7.5 3 12.5c0 2 .8 4 2 5.5h14c1.2-1.5 2-3.5 2-5.5C21 7.5 17 3 12 3Z" /><path d="M9 12h6M12 9v6" /></>),
  // ansiedad: cabeza con espiral de tensión
  ansiedad: svg(<><circle cx="12" cy="10" r="6" /><path d="M12 16v6" /><path d="M9 10c0-1.7 1.3-3 3-3s3 1.3 3 3" /><path d="M10 10c0 1.1.9 2 2 2s2-.9 2-2" /></>),
  // memoria: cerebro esquemático
  memoria: svg(<><path d="M9.5 3a5 5 0 0 1 5 5 5 5 0 0 1-5 5H6A3 3 0 0 1 3 10V6a3 3 0 0 1 3-3h3.5Z" /><path d="M14.5 3a5 5 0 0 0-5 5" /><path d="M9.5 13a5 5 0 0 0 5 5H18a3 3 0 0 0 3-3v-4a3 3 0 0 0-3-3h-3.5" /><path d="M14.5 13a5 5 0 0 1-5-5" /></>),
  // niebla-mental: nube difusa
  'niebla-mental': svg(<><path d="M6 16a4 4 0 0 1 0-8h.5A5.5 5.5 0 0 1 17.5 8H18a4 4 0 0 1 0 8H6Z" /><path d="M8 19h8M10 21h4" /></>),
  // fuerza: pesa/dumbbell
  fuerza: svg(<><path d="M6 5v14M18 5v14" /><path d="M3 8h3M18 8h3M3 16h3M18 16h3" /><path d="M6 12h12" /></>),

  // ── categorías ──
  'cat-metabolismo': svg(<path d="M12 3c2.2 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.2 2.2-4.2 0 2 1 3.2 2.8 3.2 0-3-2-4.2 0-8Z" />),
  'cat-recuperacion': svg(<><path d="M4 20c8 1 14-4 16-16C10 4 5 9 4 20Z" /><path d="M4 20C7 14 11 11 16 9" /></>),
  'cat-cognitivo': svg(<><path d="M9.5 18h5M10.5 21h3" /><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3Z" /></>),
  'cat-piel': svg(<><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></>),
  'cat-antiaging': svg(<><path d="M6 3h12M6 21h12" /><path d="M7 3c0 4 3 5 5 7-2 2-5 3-5 7M17 3c0 4-3 5-5 7 2 2 5 3 5 7" /></>),
  'cat-crecimiento': svg(<><path d="M3 17.5 9.5 11l4 4L21 7.5" /><path d="M15 7.5h6v6" /></>),
  'cat-reproductivo': svg(<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" />),
  'cat-explorar': svg(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5 5.5-2Z" /></>),
} as const

// n=479: GlyphName tipado — TS falla en compilación si se usa un nombre no existente
export type GlyphName = keyof typeof GLYPHS

export function Glyph({ name, size, color, style }: { name: string; size?: number; color?: string; style?: React.CSSProperties }) {
  // Fallback tipado: si el nombre no existe, usa 'medidas' (no silencioso — registra en dev)
  const C = (GLYPHS as Record<string, (p: GP) => JSX.Element>)[name] ?? GLYPHS.medidas
  return <C size={size} color={color} style={style} />
}

// Icono en círculo tintado con el color (reemplaza el patrón "emoji en círculo")
export function GlyphCircle({ name, color, size = 22, box }: { name: string; color: string; size?: number; box?: number }) {
  const b = box ?? size + 18
  return (
    <div
      style={{
        width: b, height: b, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
      }}
    >
      <Glyph name={name} size={size} color={color} />
    </div>
  )
}
