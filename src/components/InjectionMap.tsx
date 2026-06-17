// InjectionMap — mapa anatómico (frente/espalda) de zonas de inyección, color por recencia.
// Render generado por panel multiagente (variante 3) + revisado. Tipos desde la fuente única del proyecto.
import { useId } from 'react'
import type { InjectionSite } from '../lib/types'
import type { ZoneRecency } from '../lib/store'

interface ZoneStyle {
  fill: string
  fillOpacity: number
  stroke: string
  strokeOpacity: number
}

const RECENCY_STYLE: Record<ZoneRecency, ZoneStyle> = {
  fresh: {
    fill: 'var(--error)',
    fillOpacity: 0.32,
    stroke: 'var(--error)',
    strokeOpacity: 0.9,
  },
  recent: {
    fill: 'var(--warning)',
    fillOpacity: 0.3,
    stroke: 'var(--warning)',
    strokeOpacity: 0.9,
  },
  ok: {
    fill: 'var(--success)',
    fillOpacity: 0.28,
    stroke: 'var(--success)',
    strokeOpacity: 0.9,
  },
  none: {
    fill: 'var(--ink-200)',
    fillOpacity: 0.14,
    stroke: 'var(--ink-300)',
    strokeOpacity: 0.4,
  },
}

const SITE_LABEL: Record<InjectionSite, string> = {
  'abdomen-izq': 'Abdomen izquierdo',
  'abdomen-der': 'Abdomen derecho',
  'muslo-izq': 'Muslo izquierdo',
  'muslo-der': 'Muslo derecho',
  'gluteo-izq': 'Glúteo izquierdo',
  'gluteo-der': 'Glúteo derecho',
}

const RECENCY_WORD: Record<ZoneRecency, string> = {
  fresh: 'aplicado hoy, menos de un día',
  recent: 'aplicado hace menos de dos días',
  ok: 'aplicado hace menos de tres días',
  none: 'sin uso reciente, disponible',
}

interface ZoneShape {
  site: InjectionSite
  cx: number
  cy: number
  rx: number
  ry: number
}

// Vista de espejo: la IZQUIERDA de la persona queda a la DERECHA del espectador.
// Figura FRENTE centrada ~x=82; figura ESPALDA centrada ~x=248.
const FRONT_ZONES: ZoneShape[] = [
  // abdomen-der (persona) -> izquierda del espectador
  { site: 'abdomen-der', cx: 67, cy: 96, rx: 13, ry: 14 },
  // abdomen-izq (persona) -> derecha del espectador
  { site: 'abdomen-izq', cx: 97, cy: 96, rx: 13, ry: 14 },
  // muslo-der (persona) -> izquierda del espectador
  { site: 'muslo-der', cx: 68, cy: 150, rx: 12, ry: 17 },
  // muslo-izq (persona) -> derecha del espectador
  { site: 'muslo-izq', cx: 96, cy: 150, rx: 12, ry: 17 },
]

const BACK_ZONES: ZoneShape[] = [
  // gluteo-der (persona) -> izquierda del espectador
  { site: 'gluteo-der', cx: 234, cy: 118, rx: 14, ry: 15 },
  // gluteo-izq (persona) -> derecha del espectador
  { site: 'gluteo-izq', cx: 262, cy: 118, rx: 14, ry: 15 },
]

interface LegendItem {
  color: string
  label: string
}

const LEGEND: LegendItem[] = [
  { color: 'var(--error)', label: 'Hoy (menos de 1 día)' },
  { color: 'var(--warning)', label: 'Menos de 2 días' },
  { color: 'var(--success)', label: 'Menos de 3 días' },
]

export function InjectionMap({
  recency,
}: {
  recency: Record<InjectionSite, ZoneRecency>
}): JSX.Element {
  const titleId = useId()

  const renderZone = (zone: ZoneShape): JSX.Element => {
    const state = recency[zone.site]
    const style = RECENCY_STYLE[state]
    const label = `${SITE_LABEL[zone.site]}: ${RECENCY_WORD[state]}`
    return (
      <ellipse
        key={zone.site}
        cx={zone.cx}
        cy={zone.cy}
        rx={zone.rx}
        ry={zone.ry}
        fill={style.fill}
        fillOpacity={style.fillOpacity}
        stroke={style.stroke}
        strokeOpacity={style.strokeOpacity}
        strokeWidth={1.6}
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
      </ellipse>
    )
  }

  return (
    <figure
      style={{
        margin: 0,
        padding: '14px 16px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        maxWidth: 362,
        boxSizing: 'border-box',
      }}
    >
      <figcaption
        id={titleId}
        style={{
          margin: '0 0 10px',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: 'var(--ink-900)',
        }}
      >
        Mapa de inyección
      </figcaption>

      <svg
        viewBox="0 0 330 210"
        width="100%"
        role="group"
        aria-labelledby={titleId}
        style={{ display: 'block', maxWidth: 330, margin: '0 auto' }}
      >
        {/* ====== FIGURA FRENTE (izquierda) ====== */}
        <g
          fill="none"
          stroke="var(--brand-700)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* cabeza */}
          <circle cx="82" cy="28" r="13" />
          {/* cuello */}
          <path d="M76 39 L76 46 M88 39 L88 46" strokeWidth={2} />
          {/* torso */}
          <path d="M76 46 C58 50 56 58 56 70 L60 118 L104 118 L108 70 C108 58 106 50 88 46 Z" />
          {/* brazo der (espectador izq) */}
          <path d="M58 56 C44 62 40 80 41 104" />
          {/* brazo izq (espectador der) */}
          <path d="M106 56 C120 62 124 80 123 104" />
          {/* pierna der (espectador izq) */}
          <path d="M62 118 C60 138 62 162 65 184" />
          {/* pierna izq (espectador der) */}
          <path d="M102 118 C104 138 102 162 99 184" />
          {/* entrepierna */}
          <path d="M82 118 L82 132" strokeWidth={1.8} />
        </g>
        {/* zonas frente */}
        {FRONT_ZONES.map(renderZone)}

        {/* ====== FIGURA ESPALDA (derecha) ====== */}
        <g
          fill="none"
          stroke="var(--brand-700)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* cabeza */}
          <circle cx="248" cy="28" r="13" />
          {/* cuello */}
          <path d="M242 39 L242 46 M254 39 L254 46" strokeWidth={2} />
          {/* torso/espalda */}
          <path d="M242 46 C224 50 222 58 222 70 L226 130 L270 130 L274 70 C274 58 272 50 254 46 Z" />
          {/* línea de columna */}
          <path d="M248 50 L248 128" strokeWidth={1.4} stroke="var(--brand-500)" />
          {/* brazo der (espectador izq) */}
          <path d="M224 56 C210 62 206 80 207 104" />
          {/* brazo izq (espectador der) */}
          <path d="M272 56 C286 62 290 80 289 104" />
          {/* pierna der (espectador izq) */}
          <path d="M230 130 C228 150 230 168 233 184" />
          {/* pierna izq (espectador der) */}
          <path d="M266 130 C268 150 266 168 263 184" />
          {/* separación glúteos */}
          <path d="M248 130 L248 146" strokeWidth={1.8} />
        </g>
        {/* zonas espalda */}
        {BACK_ZONES.map(renderZone)}

        {/* etiquetas de figura */}
        <g
          fill="var(--ink-400)"
          fontSize="11"
          fontWeight={500}
          textAnchor="middle"
        >
          <text x="82" y="202">
            Frente
          </text>
          <text x="248" y="202">
            Espalda
          </text>
        </g>
      </svg>

      {/* ====== LEYENDA ====== */}
      <ul
        style={{
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          margin: '12px 0 0',
          padding: '10px 0 0',
          borderTop: '1px solid var(--border)',
        }}
      >
        {LEGEND.map((item) => (
          <li
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              color: 'var(--ink-400)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: 'var(--r-md)',
                background: item.color,
                flex: '0 0 auto',
              }}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </figure>
  )
}