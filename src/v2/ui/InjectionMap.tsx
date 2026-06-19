// InjectionMap v2 — mapa interactivo de rotación de sitios de inyección.
// Diseño propio: siluetas SVG de cuerpo humano (frente + espalda), cockpit oscuro premium.
// 6 zonas tappables con recencia por color + ícono + texto (cumple AA, nunca color solo).
// Recencia calculada desde state.log via useApp().
import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp, SITE_LABEL, injectionZoneRecency } from '../../lib/store'
import type { InjectionSite } from '../../lib/types'
import type { ZoneRecency } from '../../lib/store'
import { cn } from '../../lib/cn'

// ── Tokens de recencia ────────────────────────────────────────────────────────
const RECENCY_COLOR: Record<ZoneRecency, string> = {
  fresh: 'var(--alert)',   // <1 día — rojo
  recent: 'var(--warn)',   // <2 días — ámbar
  ok: 'var(--ok)',         // <3 días — verde
  none: 'var(--muted-foreground)', // neutral
}

const RECENCY_LABEL: Record<ZoneRecency, string> = {
  fresh: '< 1 día',
  recent: '< 2 días',
  ok: '< 3 días',
  none: 'Sin uso reciente',
}

// Ícono de recencia (texto unicode accesible, no color solo — regla DURA)
const RECENCY_ICON: Record<ZoneRecency, string> = {
  fresh: '●',   // relleno (recién usado)
  recent: '◐',  // medio
  ok: '○',      // vacío-ok
  none: '·',    // punto tenue
}

// Etiquetas cortas para las zonas (es-MX, sentence case)
const SITE_SHORT: Record<InjectionSite, string> = {
  'abdomen-izq': 'Abd. izq.',
  'abdomen-der': 'Abd. der.',
  'muslo-izq': 'Muslo izq.',
  'muslo-der': 'Muslo der.',
  'gluteo-izq': 'Glúteo izq.',
  'gluteo-der': 'Glúteo der.',
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
// Las zonas son <ellipse> tappables (rx≥22, ry≥22 → ≥44px de target en coordenadas 1:1 al tamaño renderizado).

interface ZoneEllipse {
  site: InjectionSite
  cx: number
  cy: number
  rx: number
  ry: number
  label: string
}

// FRENTE: abdomen y muslos (orientación espejo: persona-izq → pantalla-der)
const FRONT_ZONES: ZoneEllipse[] = [
  { site: 'abdomen-der', cx: 34, cy: 108, rx: 20, ry: 16, label: 'Abd. der.' },
  { site: 'abdomen-izq', cx: 66, cy: 108, rx: 20, ry: 16, label: 'Abd. izq.' },
  { site: 'muslo-der',   cx: 33, cy: 162, rx: 18, ry: 18, label: 'Muslo der.' },
  { site: 'muslo-izq',   cx: 67, cy: 162, rx: 18, ry: 18, label: 'Muslo izq.' },
]

// ESPALDA: glúteos (directo: persona-izq → pantalla-izq)
const BACK_ZONES: ZoneEllipse[] = [
  { site: 'gluteo-izq', cx: 35, cy: 118, rx: 22, ry: 18, label: 'Glúteo izq.' },
  { site: 'gluteo-der', cx: 65, cy: 118, rx: 22, ry: 18, label: 'Glúteo der.' },
]

// ── Silueta SVG: frente ───────────────────────────────────────────────────────
// Figura simplificada tipo "mannequin de instrumento" — líneas limpias, sin detalle anatómico excesivo.
// Color: relleno slate, trazo teal dim para el aesthetic cockpit.
const BODY_FRONT = `
  M50,12 C57,12 62,17 62,24 C62,30 58,35 54,37
  L57,45 C63,45 72,50 74,58
  L78,80 C78,87 74,92 68,93
  L67,140 C70,142 72,148 72,155
  L72,195 C72,200 68,204 64,204
  L60,204 C58,204 57,202 57,200
  L57,162 C57,155 54,150 50,150
  C46,150 43,155 43,162
  L43,200 C43,202 42,204 40,204
  L36,204 C32,204 28,200 28,195
  L28,155 C28,148 30,142 33,140
  L32,93 C26,92 22,87 22,80
  L26,58 C28,50 37,45 43,45
  L46,37 C42,35 38,30 38,24
  C38,17 43,12 50,12 Z
`

// ── Silueta SVG: espalda ──────────────────────────────────────────────────────
// Vista posterior, misma proporción/viewBox. Los glúteos tienen prominencia natural.
const BODY_BACK = `
  M50,12 C57,12 62,17 62,24 C62,30 58,35 54,37
  L57,45 C63,45 72,50 74,58
  L78,80 C78,87 74,92 68,93
  L69,100 C72,108 72,118 68,128
  L66,140 C68,142 72,148 72,155
  L72,195 C72,200 68,204 64,204
  L60,204 C58,204 57,202 57,200
  L57,162 C57,155 54,150 50,150
  C46,150 43,155 43,162
  L43,200 C43,202 42,204 40,204
  L36,204 C32,204 28,200 28,195
  L28,155 C28,148 30,142 32,140
  L30,128 C26,118 28,108 31,100
  L32,93 C26,92 22,87 22,80
  L26,58 C28,50 37,45 43,45
  L46,37 C42,35 38,30 38,24
  C38,17 43,12 50,12 Z
`

// ── SubComponent: zona tappable ───────────────────────────────────────────────
interface ZoneButtonProps {
  zone: ZoneEllipse
  recency: ZoneRecency
  isSelected: boolean
  isSuggested: boolean
  onSelect: () => void
  reducedMotion: boolean | null
}

function ZoneButton({ zone, recency, isSelected, isSuggested, onSelect, reducedMotion }: ZoneButtonProps) {
  const color = RECENCY_COLOR[recency]
  const hasActivity = recency !== 'none'

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

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
      {/* Halo de sugerencia (zona menos usada) */}
      {isSuggested && (
        <ellipse
          cx={zone.cx}
          cy={zone.cy}
          rx={zone.rx + 6}
          ry={zone.ry + 6}
          fill="none"
          stroke="var(--teal)"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.5"
        />
      )}
      {/* Relleno de la zona */}
      <ellipse
        cx={zone.cx}
        cy={zone.cy}
        rx={zone.rx}
        ry={zone.ry}
        fill={hasActivity ? color : 'rgba(255,255,255,0.04)'}
        fillOpacity={hasActivity ? 0.18 : 1}
        stroke={isSelected ? 'var(--teal-bright)' : hasActivity ? color : 'rgba(255,255,255,0.2)'}
        strokeWidth={isSelected ? 2 : 1.5}
        style={{
          filter: isSelected ? 'drop-shadow(0 0 6px var(--teal-bright))' : hasActivity ? `drop-shadow(0 0 4px ${color})` : 'none',
          transition: reducedMotion ? 'none' : 'stroke 0.15s, fill-opacity 0.15s',
        }}
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
  bodyPath: string
  zones: ZoneEllipse[]
  label: string
  recencyMap: Record<InjectionSite, { recency: ZoneRecency; lastTs: number | null }>
  selected: InjectionSite | null | undefined
  suggested: InjectionSite | null
  onSelect: (s: InjectionSite) => void
  reducedMotion: boolean | null
}

function Figure({ bodyPath, zones, label, recencyMap, selected, suggested, onSelect, reducedMotion }: FigureProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <svg
        viewBox="0 0 100 220"
        width="100%"
        style={{ maxWidth: 130, display: 'block' }}
        role="group"
        aria-label={label}
        focusable="true"
      >
        {/* Cuerpo — relleno slate, tono cockpit */}
        <path
          d={bodyPath}
          fill="var(--secondary)"
          stroke="var(--teal-dim)"
          strokeWidth="0.8"
          strokeLinejoin="round"
          opacity="0.8"
        />
        {/* Zonas tappables */}
        {zones.map((zone) => (
          <ZoneButton
            key={zone.site}
            zone={zone}
            recency={recencyMap[zone.site]?.recency ?? 'none'}
            isSelected={selected === zone.site}
            isSuggested={suggested === zone.site}
            onSelect={() => onSelect(zone.site)}
            reducedMotion={reducedMotion}
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
  const { state } = useApp()
  const reducedMotion = useReducedMotion()

  // Mapa de recencia calculado desde state.log (misma lógica que el v1/store)
  const recencyMap = useMemo(() => injectionZoneRecency(state), [state])

  // Zona sugerida = la menos usada recientemente (primer 'none', luego 'ok', etc.)
  const suggested = useMemo<InjectionSite | null>(() => {
    const ORDER: ZoneRecency[] = ['none', 'ok', 'recent', 'fresh']
    for (const level of ORDER) {
      const site = (['abdomen-izq','abdomen-der','muslo-izq','muslo-der','gluteo-izq','gluteo-der'] as InjectionSite[])
        .find((s) => recencyMap[s]?.recency === level)
      if (site) return site
    }
    return null
  }, [recencyMap])

  // Detalle de zona seleccionada
  const detail = useMemo(() => {
    if (!selected) return null
    const info = recencyMap[selected]
    return {
      label: SITE_LABEL[selected],
      recency: info?.recency ?? 'none',
      lastTs: info?.lastTs ?? null,
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
