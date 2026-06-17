// InjectionMap — mapa anatómico (frente/espalda) de zonas de inyección, color por recencia.
// Render generado por panel multiagente (variante 3) + revisado por equipo multiagente.
// Tipos y etiquetas desde la fuente única del proyecto (store/types).
import { useId, useState } from 'react'
import type { InjectionSite } from '../lib/types'
import type { ZoneRecency, ZoneInfo } from '../lib/store'
import { SITE_LABEL } from '../lib/store'

interface ZoneStyle { fill: string; fillOpacity: number; stroke: string; strokeOpacity: number }

const RECENCY_STYLE: Record<ZoneRecency, ZoneStyle> = {
  fresh: { fill: 'var(--error)', fillOpacity: 0.32, stroke: 'var(--error)', strokeOpacity: 0.9 },
  recent: { fill: 'var(--warning)', fillOpacity: 0.3, stroke: 'var(--warning)', strokeOpacity: 0.9 },
  ok: { fill: 'var(--success)', fillOpacity: 0.28, stroke: 'var(--success)', strokeOpacity: 0.9 },
  none: { fill: 'var(--ink-200)', fillOpacity: 0.14, stroke: 'var(--ink-300)', strokeOpacity: 0.4 },
}

// Descriptivo del HISTORIAL (no del semáforo): nada que insinúe aptitud/recomendación de aplicar.
const RECENCY_WORD: Record<ZoneRecency, string> = {
  fresh: 'registrada hace menos de 1 día',
  recent: 'registrada hace menos de 2 días',
  ok: 'registrada hace menos de 3 días',
  none: 'sin registro en los últimos 3 días',
}

interface ZoneShape { site: InjectionSite; cx: number; cy: number; rx: number; ry: number }

// Vista de ESPEJO: la IZQUIERDA de la persona se dibuja a la DERECHA del espectador (como un espejo).
// Figura FRENTE centrada ~x=82; figura ESPALDA centrada ~x=248.
const FRONT_ZONES: ZoneShape[] = [
  { site: 'abdomen-der', cx: 70, cy: 96, rx: 11, ry: 13 }, // persona-der -> espectador-izq
  { site: 'abdomen-izq', cx: 94, cy: 96, rx: 11, ry: 13 }, // persona-izq -> espectador-der
  { site: 'muslo-der', cx: 71, cy: 150, rx: 10, ry: 16 },
  { site: 'muslo-izq', cx: 93, cy: 150, rx: 10, ry: 16 },
]

const BACK_ZONES: ZoneShape[] = [
  { site: 'gluteo-der', cx: 236, cy: 118, rx: 13, ry: 15 }, // persona-der -> espectador-izq
  { site: 'gluteo-izq', cx: 260, cy: 118, rx: 13, ry: 15 }, // persona-izq -> espectador-der
]

interface LegendItem { color: string; label: string }
const LEGEND: LegendItem[] = [
  { color: 'var(--error)', label: '< 1 día' },
  { color: 'var(--warning)', label: '< 2 días' },
  { color: 'var(--success)', label: '< 3 días' },
  { color: 'var(--ink-300)', label: 'Sin uso reciente' },
]

function relLabel(ts: number | null): string {
  if (ts == null) return 'sin registro'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

export function InjectionMap({ zones }: { zones: Record<InjectionSite, ZoneInfo> }): JSX.Element {
  const titleId = useId()
  const [selected, setSelected] = useState<InjectionSite | null>(null)

  const infoOf = (site: InjectionSite): ZoneInfo => zones[site] ?? { recency: 'none', lastTs: null }

  const renderZone = (zone: ZoneShape): JSX.Element => {
    const info = infoOf(zone.site)
    const style = RECENCY_STYLE[info.recency]
    const isSel = selected === zone.site
    const label = `${SITE_LABEL[zone.site]}: ${RECENCY_WORD[info.recency]}`
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
        strokeWidth={isSel ? 2.6 : 1.6}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={isSel}
        style={{ cursor: 'pointer' }}
        onClick={() => setSelected((p) => (p === zone.site ? null : zone.site))}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected((p) => (p === zone.site ? null : zone.site)) } }}
      >
        <title>{label}</title>
      </ellipse>
    )
  }

  const detail = selected
    ? `${SITE_LABEL[selected]} · ${RECENCY_WORD[infoOf(selected).recency]} · última: ${relLabel(infoOf(selected).lastTs)}`
    : 'Toca una zona para ver tu último registro.'

  return (
    <figure
      style={{
        margin: 0, padding: '14px 16px 12px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', maxWidth: 362, boxSizing: 'border-box',
      }}
    >
      <figcaption id={titleId} style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--ink-900)' }}>
        Mapa de inyección
      </figcaption>
      {/* Comunica la convención de espejo para no confundir izq/der */}
      <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--ink-400)' }}>
        Vista de espejo · tu izquierda está a la derecha de la pantalla.
      </p>

      <svg viewBox="0 0 330 210" width="100%" role="group" aria-labelledby={titleId} style={{ display: 'block', maxWidth: 330, margin: '0 auto' }}>
        {/* ====== FIGURA FRENTE (decorativa) ====== */}
        <g fill="none" stroke="var(--brand-700)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="82" cy="28" r="13" />
          <path d="M76 39 L76 46 M88 39 L88 46" strokeWidth={2} />
          <path d="M76 46 C58 50 56 58 56 70 L60 118 L104 118 L108 70 C108 58 106 50 88 46 Z" />
          <path d="M58 56 C44 62 40 80 41 104" />
          <path d="M106 56 C120 62 124 80 123 104" />
          {/* piernas con la cara externa marcada */}
          <path d="M62 118 C60 138 62 162 65 184" />
          <path d="M102 118 C104 138 102 162 99 184" />
          {/* entrepierna extendida: separa las piernas a la altura de las zonas de muslo */}
          <path d="M82 118 L82 152" strokeWidth={1.8} />
        </g>
        {FRONT_ZONES.map(renderZone)}

        {/* ====== FIGURA ESPALDA (decorativa) ====== */}
        <g fill="none" stroke="var(--brand-700)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="248" cy="28" r="13" />
          <path d="M242 39 L242 46 M254 39 L254 46" strokeWidth={2} />
          <path d="M242 46 C224 50 222 58 222 70 L226 130 L270 130 L274 70 C274 58 272 50 254 46 Z" />
          <path d="M248 50 L248 128" strokeWidth={1.4} stroke="var(--brand-500)" />
          <path d="M224 56 C210 62 206 80 207 104" />
          <path d="M272 56 C286 62 290 80 289 104" />
          <path d="M230 130 C228 150 230 168 233 184" />
          <path d="M266 130 C268 150 266 168 263 184" />
          <path d="M248 130 L248 146" strokeWidth={1.8} />
        </g>
        {BACK_ZONES.map(renderZone)}

        {/* etiquetas de figura (decorativas) */}
        <g fill="var(--ink-400)" fontSize="11" fontWeight={500} textAnchor="middle" aria-hidden="true">
          <text x="82" y="202">Frente</text>
          <text x="248" y="202">Espalda</text>
        </g>
      </svg>

      {/* detalle de la zona tocada */}
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-700)', minHeight: 17 }} aria-live="polite">{detail}</p>

      {/* ====== LEYENDA ====== */}
      <ul style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '6px 14px', margin: '10px 0 0', padding: '10px 0 0', borderTop: '1px solid var(--border)' }}>
        {LEGEND.map((item) => (
          <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-700)' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 'var(--r-md)', background: item.color, flex: '0 0 auto' }} />
            {item.label}
          </li>
        ))}
      </ul>

      {/* aclara que es un espejo del historial, no una pauta de aplicación */}
      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--ink-300)' }}>
        Refleja cuándo registraste cada zona por última vez. Dato personal, no es consejo médico.
      </p>
    </figure>
  )
}
