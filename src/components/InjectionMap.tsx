// InjectionMap — mapa de zonas de inyección sobre un render 3D (wireframe teal, frente+espalda).
// El cuerpo es un render generado con Higgsfield (nano_banana_2); encima se superponen 6 marcadores
// que se colorean dinámicamente por recencia (rojo <1d, ámbar <2d, verde <3d, tenue si sin uso reciente).
// Orientación: FRENTE = espejo (izq de la persona → derecha de pantalla); ESPALDA = directo (la ves de atrás).
import { useId, useState } from 'react'
import type { InjectionSite } from '../lib/types'
import type { ZoneRecency, ZoneInfo } from '../lib/store'
import { SITE_LABEL } from '../lib/store'
import bodyImg from '../assets/injection-body.png'

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

// Posición de cada zona como % del render (760×567). Frente ≈x27%, espalda ≈x72%.
interface Marker { site: InjectionSite; x: number; y: number }
const MARKERS: Marker[] = [
  // FRENTE (espejo): persona-der → pantalla-izq, persona-izq → pantalla-der
  { site: 'abdomen-der', x: 24.5, y: 47 },
  { site: 'abdomen-izq', x: 30.5, y: 47 },
  { site: 'muslo-der', x: 23, y: 67 },
  { site: 'muslo-izq', x: 32, y: 67 },
  // ESPALDA (directo): persona-izq → pantalla-izq, persona-der → pantalla-der
  { site: 'gluteo-izq', x: 69.5, y: 55 },
  { site: 'gluteo-der', x: 74.5, y: 55 },
]

interface LegendItem { color: string; label: string }
const LEGEND: LegendItem[] = [
  { color: 'var(--error)', label: '< 1 día' },
  { color: 'var(--warning)', label: '< 2 días' },
  { color: 'var(--success)', label: '< 3 días' },
  { color: 'rgba(255,255,255,0.45)', label: 'Sin uso reciente' },
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

      {/* render del cuerpo + marcadores superpuestos */}
      <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', lineHeight: 0 }} role="group" aria-labelledby={titleId}>
        <img src={bodyImg} alt="Cuerpo, vista de frente y de espalda" style={{ width: '100%', display: 'block' }} />
        {/* leyendas frente/espalda sobre el render */}
        <span aria-hidden="true" style={{ position: 'absolute', left: '27%', bottom: 6, transform: 'translateX(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>FRENTE</span>
        <span aria-hidden="true" style={{ position: 'absolute', left: '72%', bottom: 6, transform: 'translateX(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>ESPALDA</span>
        {MARKERS.map((m) => {
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
                width: 22, height: 22, borderRadius: '50%', padding: 0, cursor: 'pointer',
                border: `2px solid ${active ? color : 'rgba(255,255,255,0.5)'}`,
                background: active ? color : 'rgba(255,255,255,0.06)',
                opacity: active ? 0.95 : 0.6,
                boxShadow: active ? `0 0 9px 1px ${color}` : 'none',
                outline: isSel ? '2px solid #fff' : 'none', outlineOffset: 2,
                transition: 'box-shadow .15s, opacity .15s',
              }}
            />
          )
        })}
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
