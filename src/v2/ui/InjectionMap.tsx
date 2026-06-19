// InjectionMap v3 — mapa interactivo de rotación de sitios de inyección.
// Base visual: figura premium generada (Higgsfield, maniquí slate + rim-light teal,
//   frente + espalda) como imagen; las 6 zonas son botones interactivos posicionados
//   encima (coords %). Conserva: recencia (injectionZoneRecency), zona sugerida,
//   detalle, leyenda color+ícono+texto, a11y (button nativo + aria), es-MX, sin jeringas.

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp, SITE_LABEL, injectionZoneRecency } from '../../lib/store'
import type { InjectionSite } from '../../lib/types'
import type { ZoneRecency } from '../../lib/store'
import bodySrc from '../../assets/rebuild/injection-body.webp'

const RECENCY_COLOR: Record<ZoneRecency, string> = {
  fresh: 'var(--alert)',
  recent: 'var(--warn)',
  ok: 'var(--ok)',
  none: 'var(--muted-foreground)',
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

// Posición (% del contenedor, que ahora respeta el aspecto nativo de la imagen 2432×1792
// → sin letterbox, las coords mapean 1:1 sobre la figura). Calibradas con overlay visual.
// Figura FRENTE ≈ izquierda (centro x~32.5%), ESPALDA ≈ derecha (centro x~66.5%).
// En FRENTE: der = lado del espectador izquierdo (x menor). En ESPALDA: der = espectador derecho (x mayor).
const ZONES: { site: InjectionSite; x: number; y: number }[] = [
  { site: 'abdomen-der', x: 30.5, y: 38 },
  { site: 'abdomen-izq', x: 35, y: 38 },
  { site: 'muslo-der', x: 30.5, y: 61 },
  { site: 'muslo-izq', x: 35.5, y: 61 },
  { site: 'gluteo-izq', x: 64, y: 43 },
  { site: 'gluteo-der', x: 69, y: 43 },
]

function relLabel(ts: number | null): string {
  if (ts == null) return 'sin registro'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
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
      {/* halo de zona sugerida */}
      {isSuggested && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ border: '1.5px dashed var(--teal)', opacity: 0.6 }}
        />
      )}
      {/* parche */}
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-full font-mono text-[12px]"
        style={{
          background: active ? `color-mix(in srgb, ${color} 22%, transparent)` : 'rgba(255,255,255,0.06)',
          border: `${isSelected ? 2.5 : 1.5}px solid ${isSelected ? 'var(--teal-bright)' : active ? color : 'rgba(255,255,255,0.25)'}`,
          color: isSelected ? 'var(--teal-bright)' : active ? color : 'rgba(255,255,255,0.45)',
          boxShadow: isSelected
            ? '0 0 8px var(--teal-bright), 0 0 16px var(--teal-bright)'
            : active
              ? `0 0 6px ${color}`
              : 'none',
          transition: reduce ? 'none' : 'border-color .15s, box-shadow .15s, background .15s',
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

  const suggested = useMemo<InjectionSite | null>(() => {
    const ORDER: ZoneRecency[] = ['none', 'ok', 'recent', 'fresh']
    const all: InjectionSite[] = ['abdomen-izq', 'abdomen-der', 'muslo-izq', 'muslo-der', 'gluteo-izq', 'gluteo-der']
    for (const level of ORDER) {
      const site = all.find((s) => recencyMap[s]?.recency === level)
      if (site) return site
    }
    return null
  }, [recencyMap])

  const detail = useMemo(() => {
    if (!selected) return null
    const info = recencyMap[selected]
    return { label: SITE_LABEL[selected], recency: info?.recency ?? 'none', lastTs: info?.lastTs ?? null }
  }, [selected, recencyMap])

  return (
    <div className="rounded-lg border border-white/10 bg-raised p-4" role="group" aria-label="Mapa de rotación de sitios de inyección">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Sitio de inyección</h3>
        {suggested && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-teal">
            <span aria-hidden>◎</span>
            <span>Sugerido: {SITE_SHORT[suggested]}</span>
          </span>
        )}
      </div>

      {/* Imagen del cuerpo + zonas interactivas encima */}
      <div className="relative mx-auto w-full" style={{ maxWidth: 360 }}>
        <div className="relative w-full" style={{ aspectRatio: '2432 / 1792' }}>
          <img src={bodySrc} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain" />
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
        <div className="flex justify-around px-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground" aria-hidden>
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
          <div className="rounded-md border border-white/[0.06] bg-void px-3 py-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-base leading-none" style={{ color: RECENCY_COLOR[detail.recency] }}>
                {RECENCY_ICON[detail.recency]}
              </span>
              <span className="text-sm font-semibold text-foreground">{detail.label}</span>
              <span className="ml-auto font-mono text-xs" style={{ color: RECENCY_COLOR[detail.recency] }}>
                {RECENCY_LABEL[detail.recency]}
              </span>
            </div>
            <p className="ml-6 mt-0.5 text-xs text-muted-foreground">Última: {relLabel(detail.lastTs)}</p>
          </div>
        ) : (
          <p className="pt-2 text-center text-xs text-muted-foreground">Toca una zona para ver su historial</p>
        )}
      </motion.div>

      {/* Leyenda color + ícono + texto */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.08] pt-3" aria-label="Leyenda de recencia">
        {LEGEND.map(({ recency, label }) => (
          <span key={recency} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span aria-hidden className="font-mono text-[10px]" style={{ color: RECENCY_COLOR[recency] }}>
              {RECENCY_ICON[recency]}
            </span>
            {label}
          </span>
        ))}
      </div>

      <p className="mt-2 text-center text-[10px] text-muted-foreground">Tu historial se guarda solo en tu dispositivo</p>
    </div>
  )
}
