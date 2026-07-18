// InjectionMap v4 — "Bitácora": figura editorial abstracta de rotación de sitios.
// Ref canónica docs/design-refs (zonecard): torso en hairline (cabeza + tronco simétrico),
// SIN jeringas/agujas ni imagen fotográfica — solo dots de recencia sobre la silueta.
// CONSERVA ÍNTEGRO el comportamiento: modos visor (Inicio) y selector (RegistrarSheet) vía
// selected/onSelect, recencia (injectionZoneRecency), zona sugerida (#19: rotación real del
// store), detalle con aria-live, leyenda color+ícono+texto (nunca color solo), es-MX.
// Semántica de color: recencia = estados (alert/warn/ok); selección = azul (interactivo);
// sugerido = ámbar (tu atención aquí / ahora). Elevación = reglas, no sombras (sin glows).

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp, SITE_LABEL, injectionZoneRecency, nextInjectionSite } from '../../lib/store'
import type { InjectionSite } from '../../lib/types'
import type { ZoneRecency } from '../../lib/store'

const RECENCY_COLOR: Record<ZoneRecency, string> = {
  fresh: 'var(--alert)',
  recent: 'var(--warn)',
  ok: 'var(--ok)',
  none: 'var(--ink-3)',
}
const RECENCY_LABEL: Record<ZoneRecency, string> = {
  fresh: '< 1 día',
  recent: '< 2 días',
  ok: '< 3 días',
  none: 'Sin uso reciente',
}
const RECENCY_ICON: Record<ZoneRecency, string> = {
  fresh: '●',
  recent: '◐',
  ok: '○',
  none: '·',
}
const SITE_SHORT: Record<InjectionSite, string> = {
  'abdomen-izq': 'Abd. izq.',
  'abdomen-der': 'Abd. der.',
  'muslo-izq': 'Muslo izq.',
  'muslo-der': 'Muslo der.',
  'gluteo-izq': 'Glúteo izq.',
  'gluteo-der': 'Glúteo der.',
}

// Posición (% del contenedor con aspecto 1200×896 — mismo aspecto que la figura anterior, así el
// placeholder de RegistrarSheet sigue midiendo igual). La silueta SVG de abajo se dibuja en el
// MISMO sistema de coordenadas (viewBox 1200×896): FRENTE centrado en x=25% y ESPALDA en x=75%.
// Coords RECALIBRADAS a la silueta abstracta (abdomen y=49%, muslos y=74%, glúteos y=66% —
// bajo la línea de cintura y=60%). Lateralidad = perspectiva del USUARIO ("tu izquierda/derecha"):
//  FRENTE (centro x=25%): der = lado del espectador izquierdo (x menor); izq = espectador derecho.
//  ESPALDA (centro x=75%): der = espectador derecho (x mayor); izq = espectador izquierdo.
const ZONES: { site: InjectionSite; x: number; y: number }[] = [
  { site: 'abdomen-der', x: 21, y: 49 },
  { site: 'abdomen-izq', x: 29, y: 49 },
  { site: 'muslo-der', x: 19, y: 74 },
  { site: 'muslo-izq', x: 31, y: 74 },
  { site: 'gluteo-izq', x: 69, y: 66 },
  { site: 'gluteo-der', x: 81, y: 66 },
]

function relLabel(ts: number | null): string {
  if (ts == null) return 'sin registro'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

// Silueta editorial (cabeza + tronco simétrico de la ref, escalada ×7 al viewBox 1200×896).
// Trazo hairline con vector-effect para que la regla mida ~1.5px en pantalla a cualquier tamaño.
const TORSO_D = (dx: number) =>
  `M${300 + dx} 195 C${230 + dx} 195 ${174 + dx} 216 ${146 + dx} 251 ` +
  `C${121.5 + dx} 282.5 ${114.5 + dx} 321 ${114.5 + dx} 370 ` +
  `C${114.5 + dx} 433 ${135.5 + dx} 475 ${142.5 + dx} 531 ` +
  `C${149.5 + dx} 587 ${142.5 + dx} 657 ${156.5 + dx} 706 ` +
  `C${170.5 + dx} 755 ${223 + dx} 769 ${300 + dx} 769 ` +
  `C${377 + dx} 769 ${429.5 + dx} 755 ${443.5 + dx} 706 ` +
  `C${457.5 + dx} 657 ${450.5 + dx} 587 ${457.5 + dx} 531 ` +
  `C${464.5 + dx} 475 ${485.5 + dx} 433 ${485.5 + dx} 370 ` +
  `C${485.5 + dx} 321 ${478.5 + dx} 282.5 ${454 + dx} 251 ` +
  `C${426 + dx} 216 ${370 + dx} 195 ${300 + dx} 195 Z`

function AbstractBody() {
  return (
    <svg
      viewBox="0 0 1200 896"
      className="absolute inset-0 h-full w-full"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="var(--ink-3)" strokeOpacity={0.55} strokeWidth={1.5}>
        {/* FRENTE (x centro = 300) */}
        <circle cx={300} cy={104} r={59.5} fill="var(--surface)" vectorEffect="non-scaling-stroke" />
        <path d={TORSO_D(0)} fill="var(--surface)" vectorEffect="non-scaling-stroke" />
        {/* línea de cintura (referencia editorial) */}
        <line x1={167} y1={538} x2={433} y2={538} strokeDasharray="14 18" vectorEffect="non-scaling-stroke" />
        {/* ESPALDA (x centro = 900) */}
        <circle cx={900} cy={104} r={59.5} fill="var(--surface)" vectorEffect="non-scaling-stroke" />
        <path d={TORSO_D(600)} fill="var(--surface)" vectorEffect="non-scaling-stroke" />
        <line x1={767} y1={538} x2={1033} y2={538} strokeDasharray="14 18" vectorEffect="non-scaling-stroke" />
        {/* línea de columna (distingue la vista de espalda) */}
        <line x1={900} y1={216} x2={900} y2={530} strokeDasharray="14 18" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

function Zone({
  site,
  x,
  y,
  recency,
  isSelected,
  isSuggested,
  onSelect,
  reduce,
}: {
  site: InjectionSite
  x: number
  y: number
  recency: ZoneRecency
  isSelected: boolean
  isSuggested: boolean
  onSelect: () => void
  reduce: boolean
}) {
  const color = RECENCY_COLOR[recency]
  const active = recency !== 'none'
  return (
    <button
      type="button"
      aria-label={`${SITE_LABEL[site]}: ${RECENCY_LABEL[recency]}`}
      aria-pressed={isSelected}
      onClick={onSelect}
      className="absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* halo de zona sugerida — ámbar (tu atención aquí), guiño discontinuo de instrumento */}
      {isSuggested && (
        <span
          aria-hidden
          className="absolute inset-0.5 rounded-full"
          style={{ border: '1.5px dashed var(--amber)', opacity: 0.8 }}
        />
      )}
      {/* dot de recencia (la marca editorial de la ref) */}
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-full font-mono text-[12px]"
        style={{
          background: active
            ? `color-mix(in srgb, ${color} 20%, transparent)`
            : 'var(--surface)',
          border: `${isSelected ? 2.5 : 1.5}px solid ${
            isSelected ? 'var(--blue)' : active ? color : 'color-mix(in srgb, var(--ink-3) 60%, transparent)'
          }`,
          color: isSelected ? 'var(--blue)' : active ? color : 'var(--ink-3)',
          transition: reduce ? 'none' : 'border-color .15s, background .15s',
        }}
      >
        {RECENCY_ICON[recency]}
      </span>
    </button>
  )
}

const LEGEND: { recency: ZoneRecency; label: string }[] = [
  { recency: 'fresh', label: '< 1 día' },
  { recency: 'recent', label: '< 2 días' },
  { recency: 'ok', label: '< 3 días' },
  { recency: 'none', label: 'Sin uso reciente' },
]

export function InjectionMap({
  selected,
  onSelect,
}: {
  selected?: InjectionSite | null
  onSelect: (s: InjectionSite) => void
}) {
  const { state } = useApp()
  const reduce = !!useReducedMotion()
  const recencyMap = useMemo(() => injectionZoneRecency(state), [state])

  // #19: seguir la ROTACIÓN real del store (siguiente sitio tras el ÚLTIMO usado), no el primer
  // sitio "sin uso" en orden de array (que siempre devolvía abdomen-izq).
  const suggested = useMemo<InjectionSite | null>(() => {
    const sites = Object.keys(recencyMap) as InjectionSite[]
    let lastSite: InjectionSite | null = null
    let lastTs = -Infinity
    for (const s of sites) {
      const ts = recencyMap[s]?.lastTs
      if (ts != null && ts > lastTs) { lastTs = ts; lastSite = s }
    }
    return nextInjectionSite(lastSite ?? undefined)
  }, [recencyMap])

  const detail = useMemo(() => {
    if (!selected) return null
    const info = recencyMap[selected]
    return { label: SITE_LABEL[selected], recency: info?.recency ?? 'none', lastTs: info?.lastTs ?? null }
  }, [selected, recencyMap])

  return (
    <div
      className="rounded-sm border border-hairline bg-raised p-4"
      role="group"
      aria-label="Mapa de rotación de sitios de inyección"
    >
      {/* Kicker editorial + chip de zona sugerida (ámbar suave, texto tinta AA) */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-ink-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-amber" />
          Sitio de inyección
        </h3>
        {suggested && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-amber-soft px-2.5 py-1 font-mono text-[12px] font-medium text-ink">
            <span aria-hidden style={{ color: 'var(--amber)' }}>◎</span>
            <span>Sugerido: {SITE_SHORT[suggested]}</span>
          </span>
        )}
      </div>
      <p className="mb-3 text-[12px] text-ink-3">
        Izq./der. son desde <span className="font-medium text-ink-2">tu</span> perspectiva.
      </p>

      {/* Figura abstracta (frente + espalda) + zonas interactivas encima */}
      <div className="relative mx-auto w-full" style={{ maxWidth: 360 }}>
        <div className="relative w-full" style={{ aspectRatio: '1200 / 896' }}>
          <AbstractBody />
          {ZONES.map((z) => (
            <Zone
              key={z.site}
              site={z.site}
              x={z.x}
              y={z.y}
              recency={recencyMap[z.site]?.recency ?? 'none'}
              isSelected={selected === z.site}
              isSuggested={suggested === z.site}
              onSelect={() => onSelect(z.site)}
              reduce={reduce}
            />
          ))}
        </div>
        <div className="flex justify-around px-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3" aria-hidden>
          <span>Frente</span>
          <span>Espalda</span>
        </div>
      </div>

      {/* Detalle de zona seleccionada */}
      <motion.div
        aria-live="polite"
        className="mt-3 min-h-[44px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.2 }}
      >
        {detail ? (
          <div className="rounded-[8px] border border-hairline bg-surface px-3 py-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="font-mono text-base leading-none" style={{ color: RECENCY_COLOR[detail.recency] }}>
                {RECENCY_ICON[detail.recency]}
              </span>
              <span className="text-[14px] font-semibold text-ink">{detail.label}</span>
              <span className="ml-auto font-mono text-[12px] tabular-nums" style={{ color: RECENCY_COLOR[detail.recency] }}>
                {RECENCY_LABEL[detail.recency]}
              </span>
            </div>
            <p className="ml-6 mt-0.5 font-mono text-[12px] text-ink-3">Última: {relLabel(detail.lastTs)}</p>
          </div>
        ) : (
          <p className="pt-2 text-center text-[12px] text-ink-3">Toca una zona para ver su historial</p>
        )}
      </motion.div>

      {/* Leyenda color + ícono + texto (estado nunca es color solo) */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-hairline pt-3" aria-label="Leyenda de recencia">
        {LEGEND.map(({ recency, label }) => (
          <span key={recency} className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-2">
            <span aria-hidden className="font-mono text-[11px]" style={{ color: RECENCY_COLOR[recency] }}>
              {RECENCY_ICON[recency]}
            </span>
            {label}
          </span>
        ))}
      </div>

      <p className="mt-2 text-center text-[12px] text-ink-3">Tu historial se guarda solo en tu dispositivo</p>
    </div>
  )
}
