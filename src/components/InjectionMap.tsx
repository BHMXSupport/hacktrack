// InjectionMap — mapa de zonas de inyección sobre renders 3D (wireframe teal, frente y espalda).
// Cuerpos generados con Higgsfield (nano_banana_2) + fondo recortado (transparentes); se montan sobre
// un panel con el degradado oscuro de marca para que el glow teal resalte. Encima van 6 marcadores que
// se colorean por recencia (rojo <1d, ámbar <2d, verde <3d, tenue si sin uso) y son tappables.
// Orientación: FRENTE = espejo (izq de la persona → derecha de pantalla); ESPALDA = directo (la ves de atrás).
import { useId, useState } from 'react'
import type { InjectionSite } from '../lib/types'
import type { ZoneRecency, ZoneInfo } from '../lib/store'
import { SITE_LABEL } from '../lib/store'
import frontImg from '../assets/injection-front.png'
import backImg from '../assets/injection-back.png'

const MARKER_COLOR: Record<ZoneRecency, string> = {
  fresh: 'var(--error)',
  recent: 'var(--warning)',
  ok: 'var(--success)',
  none: 'transparent',
}

// Descriptivo del HISTORIAL (no del semáforo): nada que insinúe aptitud/recomendación de aplicar.
const RECENCY_WORD: Record<ZoneRecency, string> = {
  fresh: 'registrada hace menos de 1 día',
  recent: 'registrada hace menos de 2 días',
  ok: 'registrada hace menos de 3 días',
  none: 'sin registro en los últimos 3 días',
}

interface Marker { site: InjectionSite; x: number; y: number } // x,y = % dentro de cada figura
const FRONT_MARKERS: Marker[] = [
  { site: 'abdomen-der', x: 44, y: 42 }, // espejo: persona-der → pantalla-izq
  { site: 'abdomen-izq', x: 56, y: 42 },
  { site: 'muslo-der', x: 42, y: 63 },
  { site: 'muslo-izq', x: 58, y: 63 },
]
const BACK_MARKERS: Marker[] = [
  { site: 'gluteo-izq', x: 44, y: 52 }, // directo: persona-izq → pantalla-izq
  { site: 'gluteo-der', x: 56, y: 52 },
]

interface LegendItem { color: string; label: string }
const LEGEND: LegendItem[] = [
  { color: 'var(--error)', label: '< 1 día' },
  { color: 'var(--warning)', label: '< 2 días' },
  { color: 'var(--success)', label: '< 3 días' },
  { color: 'rgba(255,255,255,0.4)', label: 'Sin uso reciente' },
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

  const detail = selected
    ? `${SITE_LABEL[selected]} · ${RECENCY_WORD[infoOf(selected).recency]} · última: ${relLabel(infoOf(selected).lastTs)}`
    : 'Toca una zona para ver tu último registro.'

  const renderMarker = (m: Marker): JSX.Element => {
    const info = infoOf(m.site)
    const active = info.recency !== 'none'
    const color = MARKER_COLOR[info.recency]
    const isSel = selected === m.site
    return (
      <button
        key={m.site}
        onClick={() => setSelected((p) => (p === m.site ? null : m.site))}
        aria-label={`${SITE_LABEL[m.site]}: ${RECENCY_WORD[info.recency]}`}
        aria-pressed={isSel}
        style={{
          position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)',
          width: 18, height: 18, borderRadius: '50%', padding: 0, cursor: 'pointer',
          border: `2px solid ${active ? color : 'rgba(255,255,255,0.45)'}`,
          background: active ? color : 'rgba(255,255,255,0.05)',
          opacity: active ? 0.8 : 0.45,
          boxShadow: active ? `0 0 6px 1px ${color}` : 'none',
          outline: isSel ? '2px solid #fff' : 'none', outlineOffset: 2,
          transition: 'opacity .15s, box-shadow .15s',
        }}
      />
    )
  }

  const renderFigure = (img: string, label: string, markers: Marker[]): JSX.Element => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
      <div style={{ position: 'relative', lineHeight: 0 }}>
        <img src={img} alt={label} style={{ height: 226, width: 'auto', maxWidth: '100%', display: 'block' }} />
        {markers.map(renderMarker)}
      </div>
      <span aria-hidden="true" style={{ marginTop: 4, fontSize: 10, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)' }}>{label}</span>
    </div>
  )

  return (
    <figure
      style={{
        margin: 0, padding: '14px 16px 12px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', maxWidth: 362, boxSizing: 'border-box',
      }}
    >
      <figcaption id={titleId} style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--ink-900)' }}>
        Mapa de inyección
      </figcaption>

      {/* panel con el degradado oscuro de marca: el wireframe teal (transparente) resalta sobre él */}
      <div
        role="group"
        aria-labelledby={titleId}
        style={{
          display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'flex-end',
          background: 'linear-gradient(160deg, #1f2937, #0f172a)',
          borderRadius: 'var(--r-md)', padding: '14px 8px 8px',
        }}
      >
        {renderFigure(frontImg, 'FRENTE', FRONT_MARKERS)}
        {renderFigure(backImg, 'ESPALDA', BACK_MARKERS)}
      </div>

      {/* detalle de la zona tocada */}
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-700)', minHeight: 17 }} aria-live="polite">{detail}</p>

      {/* ====== LEYENDA ====== */}
      <ul style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '6px 14px', margin: '10px 0 0', padding: '10px 0 0', borderTop: '1px solid var(--border)' }}>
        {LEGEND.map((item) => (
          <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-700)' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 'var(--r-md)', background: item.color, flex: '0 0 auto' }} />
            {item.label}
          </li>
        ))}
      </ul>

      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--ink-300)' }}>
        Refleja cuándo registraste cada zona por última vez. Dato personal, no es consejo médico.
      </p>
    </figure>
  )
}
