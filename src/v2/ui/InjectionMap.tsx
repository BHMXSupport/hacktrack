// InjectionMap v2 — mapa interactivo de rotación de sitios de inyección.
//
// ── APARIENCIA VISUAL (redesign premium) ─────────────────────────────────────
// Siluetas: formas rellenas con gradiente lineal oscuro (slate claro arriba →
//   slate profundo abajo) + contorno teal #5FC9B8 con glow difuso (feGaussianBlur
//   + feMerge en <defs>) que da efecto de rim-light en los bordes del cuerpo.
//   Proporciones más orgánicas: hombros redondeados, cintura definida, caderas
//   amplias, piernas con volumen. Vista trasera incluye prominencia glútea.
// Zonas: "parches" elegantes sobre el cuerpo — relleno semitransparente con
//   gradiente radial interno + borde de recencia. La zona sugerida tiene halo
//   teal punteado exterior. La seleccionada tiene glow teal-bright.
// Todo bajo <defs> SVG puras (linearGradient, radialGradient, filter) — sin
//   imágenes externas. Reduced-motion respetado en transiciones de zona.
// ─────────────────────────────────────────────────────────────────────────────
//
// API: export function InjectionMap({ selected, onSelect }) — sin cambios.
// Recencia: injectionZoneRecency(state) — sin cambios.
// A11y: tabIndex/role=button/aria-label/Enter-Space/aria-pressed — sin cambios.
// Leyenda: color + ícono + texto (nunca color solo) — sin cambios.
// es-MX, sin jeringas, reduced-motion, tap targets ≥44px — sin cambios.

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp, SITE_LABEL, injectionZoneRecency } from '../../lib/store'
import type { InjectionSite } from '../../lib/types'
import type { ZoneRecency } from '../../lib/store'

// ── Tokens de recencia ────────────────────────────────────────────────────────
const RECENCY_COLOR: Record<ZoneRecency, string> = {
  fresh:  'var(--alert)',              // <1 día — rojo
  recent: 'var(--warn)',               // <2 días — ámbar
  ok:     'var(--ok)',                 // <3 días — verde
  none:   'var(--muted-foreground)',   // neutral
}

const RECENCY_LABEL: Record<ZoneRecency, string> = {
  fresh:  '< 1 día',
  recent: '< 2 días',
  ok:     '< 3 días',
  none:   'Sin uso reciente',
}

// Ícono de recencia (texto unicode accesible, no color solo — regla DURA)
const RECENCY_ICON: Record<ZoneRecency, string> = {
  fresh:  '●',   // relleno (recién usado)
  recent: '◐',   // medio
  ok:     '○',   // vacío-ok
  none:   '·',   // punto tenue
}

// Etiquetas cortas para las zonas (es-MX, sentence case)
const SITE_SHORT: Record<InjectionSite, string> = {
  'abdomen-izq': 'Abd. izq.',
  'abdomen-der': 'Abd. der.',
  'muslo-izq':   'Muslo izq.',
  'muslo-der':   'Muslo der.',
  'gluteo-izq':  'Glúteo izq.',
  'gluteo-der':  'Glúteo der.',
}

// ── Helpers de timestamp ──────────────────────────────────────────────────────
function relLabel(ts: number | null): string {
  if (ts == null) return 'sin registro'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

// ── Geometría del SVG ─────────────────────────────────────────────────────────
// Cada silueta se dibuja en un viewBox 100×220.
// Las zonas son <ellipse> tappables (rx≥22, ry≥22 → ≥44px de target).

interface ZoneEllipse {
  site:  InjectionSite
  cx:    number
  cy:    number
  rx:    number
  ry:    number
  label: string
}

// FRENTE: abdomen y muslos (orientación espejo: persona-izq → pantalla-der)
const FRONT_ZONES: ZoneEllipse[] = [
  { site: 'abdomen-der', cx: 34, cy: 108, rx: 20, ry: 16, label: 'Abd. der.' },
  { site: 'abdomen-izq', cx: 66, cy: 108, rx: 20, ry: 16, label: 'Abd. izq.' },
  { site: 'muslo-der',   cx: 33, cy: 163, rx: 18, ry: 18, label: 'Muslo der.' },
  { site: 'muslo-izq',   cx: 67, cy: 163, rx: 18, ry: 18, label: 'Muslo izq.' },
]

// ESPALDA: glúteos (directo: persona-izq → pantalla-izq)
const BACK_ZONES: ZoneEllipse[] = [
  { site: 'gluteo-izq', cx: 35, cy: 122, rx: 22, ry: 19, label: 'Glúteo izq.' },
  { site: 'gluteo-der', cx: 65, cy: 122, rx: 22, ry: 19, label: 'Glúteo der.' },
]

// ── Silueta SVG: frente ───────────────────────────────────────────────────────
// Proporciones más orgánicas: cabeza redonda, hombros anchos redondeados,
// cintura definida (estrechamiento en y≈88-96), caderas amplias, piernas
// con volumen lateral. Curvas Bézier en lugar de líneas rectas.
const BODY_FRONT = `
  M50,10
  C58,10 65,16 65,24
  C65,31 61,36 56,38.5
  L59,47
  C67,47 76,53 78,62
  L82,84
  C83,91 79,97 72,98.5
  C73,104 72,110 70,116
  L69,138
  C73,141 76,148 76,156
  L76,196
  C76,202 71,206 67,206
  L62,206
  C59,206 58,204 58,201
  L58,162
  C58,154 54,149 50,149
  C46,149 42,154 42,162
  L42,201
  C42,204 41,206 38,206
  L33,206
  C29,206 24,202 24,196
  L24,156
  C24,148 27,141 31,138
  L30,116
  C28,110 27,104 28,98.5
  C21,97 17,91 18,84
  L22,62
  C24,53 33,47 41,47
  L44,38.5
  C39,36 35,31 35,24
  C35,16 42,10 50,10
  Z
`

// ── Silueta SVG: espalda ──────────────────────────────────────────────────────
// Vista posterior. Glúteos con prominencia natural: curva amplia hacia afuera
// en la zona y≈112-132, luego vuelve al centro antes de las piernas.
const BODY_BACK = `
  M50,10
  C58,10 65,16 65,24
  C65,31 61,36 56,38.5
  L59,47
  C67,47 76,53 78,62
  L82,84
  C83,91 79,97 72,98.5
  L73,108
  C78,116 80,128 74,138
  L72,142
  C74,146 76,152 76,156
  L76,196
  C76,202 71,206 67,206
  L62,206
  C59,206 58,204 58,201
  L58,162
  C58,154 54,149 50,149
  C46,149 42,154 42,162
  L42,201
  C42,204 41,206 38,206
  L33,206
  C29,206 24,202 24,196
  L24,156
  C24,152 26,146 28,142
  L26,138
  C20,128 22,116 27,108
  L28,98.5
  C21,97 17,91 18,84
  L22,62
  C24,53 33,47 41,47
  L44,38.5
  C39,36 35,31 35,24
  C35,16 42,10 50,10
  Z
`

// ── Unique IDs for SVG defs (avoid collisions between front/back) ─────────────
function makeDefs(id: string) {
  return {
    bodyGradId:    `bodyGrad-${id}`,
    bodyShineId:   `bodyShine-${id}`,
    rimFilterId:   `rimFilter-${id}`,
    zoneGradId:    `zoneGrad-${id}`,
  }
}

// ── SVG <defs> — gradients + glow filter ─────────────────────────────────────
function BodyDefs({ id }: { id: string }) {
  const { bodyGradId, bodyShineId, rimFilterId, zoneGradId } = makeDefs(id)

  return (
    <defs>
      {/* Gradiente lineal principal del cuerpo: slate claro arriba → slate profundo abajo */}
      <linearGradient id={bodyGradId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#2d3a4a" stopOpacity="1" />
        <stop offset="45%"  stopColor="#1e2a38" stopOpacity="1" />
        <stop offset="100%" stopColor="#101820" stopOpacity="1" />
      </linearGradient>

      {/* Gradiente radial de brillo/profundidad en el torso */}
      <radialGradient id={bodyShineId} cx="50%" cy="30%" r="55%" fx="50%" fy="25%">
        <stop offset="0%"   stopColor="#3d5060" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#101820" stopOpacity="0"   />
      </radialGradient>

      {/* Filtro rim-light teal: blur + merge para halo en contorno */}
      <filter id={rimFilterId} x="-20%" y="-10%" width="140%" height="120%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feFlood floodColor="#5FC9B8" floodOpacity="0.55" result="tealFlood" />
        <feComposite in="tealFlood" in2="blur" operator="in" result="tealGlow" />
        <feMerge>
          <feMergeNode in="tealGlow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Gradiente radial interno para los parches de zona */}
      <radialGradient id={zoneGradId} cx="50%" cy="40%" r="60%">
        <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0"    />
      </radialGradient>
    </defs>
  )
}

// ── SubComponent: zona tappable (parche elegante) ─────────────────────────────
interface ZoneButtonProps {
  zone:          ZoneEllipse
  recency:       ZoneRecency
  isSelected:    boolean
  isSuggested:   boolean
  onSelect:      () => void
  reducedMotion: boolean | null
  defsId:        string
}

function ZoneButton({
  zone, recency, isSelected, isSuggested, onSelect, reducedMotion, defsId,
}: ZoneButtonProps) {
  const color      = RECENCY_COLOR[recency]
  const hasActivity = recency !== 'none'
  const { zoneGradId } = makeDefs(defsId)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  // Colores del parche según estado
  const patchFill    = hasActivity ? color : 'rgba(255,255,255,0.05)'
  const patchOpacity = hasActivity ? 0.22  : 1
  const strokeColor  = isSelected
    ? 'var(--teal-bright)'
    : hasActivity
      ? color
      : 'rgba(255,255,255,0.18)'
  const strokeWidth  = isSelected ? 2.5 : 1.5

  const glowFilter = isSelected
    ? 'drop-shadow(0 0 7px var(--teal-bright)) drop-shadow(0 0 14px var(--teal-bright))'
    : hasActivity
      ? `drop-shadow(0 0 5px ${color})`
      : 'none'

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${SITE_LABEL[zone.site]}: ${RECENCY_LABEL[recency]}`}
      aria-pressed={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none', cursor: 'pointer' }}
    >
      {/* Halo de sugerencia (zona menos usada) — teal punteado exterior */}
      {isSuggested && (
        <ellipse
          cx={zone.cx}
          cy={zone.cy}
          rx={zone.rx + 7}
          ry={zone.ry + 7}
          fill="none"
          stroke="#5FC9B8"
          strokeWidth="1"
          strokeDasharray="3 2.5"
          opacity="0.55"
        />
      )}

      {/* Parche principal — relleno semitransparente con color de recencia */}
      <ellipse
        cx={zone.cx}
        cy={zone.cy}
        rx={zone.rx}
        ry={zone.ry}
        fill={patchFill}
        fillOpacity={patchOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        style={{
          filter: glowFilter,
          transition: reducedMotion ? 'none' : 'stroke 0.15s, fill-opacity 0.15s, filter 0.15s',
        }}
      />

      {/* Brillo interno del parche (gradiente radial sobre el relleno) */}
      <ellipse
        cx={zone.cx}
        cy={zone.cy}
        rx={zone.rx}
        ry={zone.ry}
        fill={`url(#${zoneGradId})`}
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* Punto central de estado (ícono en texto SVG — color + ícono, nunca color solo) */}
      <text
        x={zone.cx}
        y={zone.cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fill={isSelected ? 'var(--teal-bright)' : hasActivity ? color : 'rgba(255,255,255,0.3)'}
        fontFamily="'JetBrains Mono', monospace"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        aria-hidden="true"
      >
        {RECENCY_ICON[recency]}
      </text>

      {/* Área de tap aumentada (≥44px) + focus ring visible */}
      <ellipse
        cx={zone.cx}
        cy={zone.cy}
        rx={Math.max(zone.rx, 22)}
        ry={Math.max(zone.ry, 22)}
        fill="transparent"
        stroke={isSelected ? 'var(--teal-bright)' : 'transparent'}
        strokeWidth={isSelected ? 2.5 : 0}
        style={{ outline: 'none' }}
      />
    </g>
  )
}

// ── SubComponent: silueta + zonas ─────────────────────────────────────────────
interface FigureProps {
  bodyPath:    string
  zones:       ZoneEllipse[]
  label:       string
  figId:       string   // unique prefix for <defs> IDs
  recencyMap:  Record<InjectionSite, { recency: ZoneRecency; lastTs: number | null }>
  selected:    InjectionSite | null | undefined
  suggested:   InjectionSite | null
  onSelect:    (s: InjectionSite) => void
  reducedMotion: boolean | null
}

function Figure({
  bodyPath, zones, label, figId, recencyMap, selected, suggested, onSelect, reducedMotion,
}: FigureProps) {
  const { bodyGradId, bodyShineId, rimFilterId } = makeDefs(figId)

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <svg
        viewBox="0 0 100 220"
        width="100%"
        style={{ maxWidth: 130, display: 'block', overflow: 'visible' }}
        role="group"
        aria-label={label}
        focusable="true"
      >
        <BodyDefs id={figId} />

        {/* Capa de glow rim-light: misma silueta, solo filtro difuso teal */}
        <path
          d={bodyPath}
          fill="none"
          stroke="#5FC9B8"
          strokeWidth="1.5"
          strokeLinejoin="round"
          filter={`url(#${rimFilterId})`}
          opacity="0.7"
          aria-hidden="true"
        />

        {/* Cuerpo — relleno con gradiente lineal premium */}
        <path
          d={bodyPath}
          fill={`url(#${bodyGradId})`}
          strokeLinejoin="round"
        />

        {/* Brillo de profundidad sobre el torso (gradiente radial) */}
        <path
          d={bodyPath}
          fill={`url(#${bodyShineId})`}
          aria-hidden="true"
          style={{ pointerEvents: 'none' }}
        />

        {/* Contorno nítido teal muy tenue — define la silueta con elegancia */}
        <path
          d={bodyPath}
          fill="none"
          stroke="#5FC9B8"
          strokeWidth="0.6"
          strokeLinejoin="round"
          opacity="0.45"
          aria-hidden="true"
        />

        {/* Zonas tappables (parches sobre el cuerpo) */}
        {zones.map((zone) => (
          <ZoneButton
            key={zone.site}
            zone={zone}
            recency={recencyMap[zone.site]?.recency ?? 'none'}
            isSelected={selected === zone.site}
            isSuggested={suggested === zone.site}
            onSelect={() => onSelect(zone.site)}
            reducedMotion={reducedMotion}
            defsId={figId}
          />
        ))}
      </svg>

      <span
        className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase"
        aria-hidden="true"
      >
        {label}
      </span>
    </div>
  )
}

// ── Leyenda ───────────────────────────────────────────────────────────────────
const LEGEND_ITEMS: { recency: ZoneRecency; label: string }[] = [
  { recency: 'fresh',  label: '< 1 día' },
  { recency: 'recent', label: '< 2 días' },
  { recency: 'ok',     label: '< 3 días' },
  { recency: 'none',   label: 'Sin uso reciente' },
]

// ── Componente principal ──────────────────────────────────────────────────────
export function InjectionMap({
  selected,
  onSelect,
}: {
  selected?: InjectionSite | null
  onSelect: (s: InjectionSite) => void
}) {
  const { state }       = useApp()
  const reducedMotion   = useReducedMotion()

  // Mapa de recencia calculado desde state.log (misma lógica que el v1/store)
  const recencyMap = useMemo(() => injectionZoneRecency(state), [state])

  // Zona sugerida = la menos usada recientemente (primer 'none', luego 'ok', etc.)
  const suggested = useMemo<InjectionSite | null>(() => {
    const ORDER: ZoneRecency[] = ['none', 'ok', 'recent', 'fresh']
    for (const level of ORDER) {
      const site = (
        ['abdomen-izq','abdomen-der','muslo-izq','muslo-der','gluteo-izq','gluteo-der'] as InjectionSite[]
      ).find((s) => recencyMap[s]?.recency === level)
      if (site) return site
    }
    return null
  }, [recencyMap])

  // Detalle de zona seleccionada
  const detail = useMemo(() => {
    if (!selected) return null
    const info = recencyMap[selected]
    return {
      label:   SITE_LABEL[selected],
      recency: info?.recency ?? 'none',
      lastTs:  info?.lastTs ?? null,
    }
  }, [selected, recencyMap])

  const handleSelect = (site: InjectionSite) => {
    onSelect(site)
  }

  return (
    <div
      className="rounded-lg border border-white/10 bg-raised p-4"
      role="group"
      aria-label="Mapa de rotación de sitios de inyección"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          Sitio de inyección
        </h3>
        {suggested && (
          <span className="text-[11px] font-mono text-teal flex items-center gap-1">
            <span aria-hidden="true">◎</span>
            <span>Sugerido: {SITE_SHORT[suggested]}</span>
          </span>
        )}
      </div>

      {/* Siluetas + zonas */}
      <div className="flex gap-3 justify-center items-end">
        <Figure
          bodyPath={BODY_FRONT}
          zones={FRONT_ZONES}
          label="Frente"
          figId="front"
          recencyMap={recencyMap}
          selected={selected}
          suggested={suggested}
          onSelect={handleSelect}
          reducedMotion={reducedMotion}
        />
        <Figure
          bodyPath={BODY_BACK}
          zones={BACK_ZONES}
          label="Espalda"
          figId="back"
          recencyMap={recencyMap}
          selected={selected}
          suggested={suggested}
          onSelect={handleSelect}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Panel de detalle de la zona seleccionada */}
      <motion.div
        aria-live="polite"
        className="mt-3 min-h-[44px]"
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
      >
        {detail ? (
          <div className="rounded-md bg-void border border-white/[0.06] px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="text-base leading-none"
                style={{ color: RECENCY_COLOR[detail.recency] }}
              >
                {RECENCY_ICON[detail.recency]}
              </span>
              <span className="text-sm font-semibold text-foreground">{detail.label}</span>
              <span
                className="text-xs font-mono ml-auto"
                style={{ color: RECENCY_COLOR[detail.recency] }}
              >
                {RECENCY_LABEL[detail.recency]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              Última: {relLabel(detail.lastTs)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Toca una zona para ver su historial
          </p>
        )}
      </motion.div>

      {/* Leyenda de colores — color + ícono + texto (nunca color solo) */}
      <div
        className="mt-3 pt-3 border-t border-white/[0.08] flex flex-wrap gap-x-4 gap-y-1.5"
        aria-label="Leyenda de recencia"
      >
        {LEGEND_ITEMS.map(({ recency, label }) => (
          <span
            key={recency}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className="font-mono text-[10px]"
              style={{ color: RECENCY_COLOR[recency] }}
            >
              {RECENCY_ICON[recency]}
            </span>
            {label}
          </span>
        ))}
      </div>

      {/* Microcopy de privacidad (regla DURA del design system) */}
      <p className="mt-2 text-[10px] text-muted-foreground text-center">
        Tu historial se guarda solo en tu dispositivo
      </p>
    </div>
  )
}
