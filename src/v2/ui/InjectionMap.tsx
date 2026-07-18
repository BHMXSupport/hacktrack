// InjectionMap v5 — "Bitácora": figura anatómica ilustrada (frente + espalda) de rotación de sitios.
// Ilustración lápiz-editorial theme-aware: body-papel.webp (Papel) / body-noche.webp (oscuro),
// ambas montadas siempre y conmutadas por [data-theme] vía opacity (cero flash al cambiar tema).
// mix-blend integra el fondo del papel/obsidiana de la lámina con la card (multiply / screen).
// SIN jeringas/agujas — solo dots de recencia sobre la anatomía real.
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
import bodyPapel from '../../assets/rebuild/body-papel.webp'
import bodyNoche from '../../assets/rebuild/body-noche.webp'

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

// Posición (% del contenedor con aspecto 1264×848 = el de la ilustración, que llena el box —
// % del contenedor ≡ % de la lámina). Coords MEDIDAS píxel a píxel sobre body-papel.webp
// (body-noche comparte geometría): FRENTE centrado en x≈32.2% con ombligo en (32.2, 40);
// ESPALDA centrada en x≈67.7% con pliegue glúteo en y≈52. Abdomen bajo flanqueando el ombligo
// (y=41.5), muslos en tercio superior-medio (y=58), glúteos en cuadrante superior-lateral (y=49.5).
// Lateralidad = perspectiva del USUARIO ("tu izquierda/derecha"), igual que antes:
//  FRENTE (visto de frente): der de la figura = lado IZQUIERDO del espectador (x menor).
//  ESPALDA (vista por detrás): izq de la figura = lado IZQUIERDO del espectador (x menor).
const ZONES: { site: InjectionSite; x: number; y: number; pair: 'l' | 'r' }[] = [
  { site: 'abdomen-der', x: 29.2, y: 41.5, pair: 'l' },
  { site: 'abdomen-izq', x: 35.2, y: 41.5, pair: 'r' },
  { site: 'muslo-der', x: 28.7, y: 59.5, pair: 'l' },
  { site: 'muslo-izq', x: 35.6, y: 59.5, pair: 'r' },
  { site: 'gluteo-izq', x: 64.7, y: 49.5, pair: 'l' },
  { site: 'gluteo-der', x: 70.6, y: 49.5, pair: 'r' },
]

// Los pares anatómicos distan ~21.6px en pantalla y los targets miden 44px: sin recorte, el botón
// vecino (posterior en el DOM) eclipsaría el CENTRO del dot par — tocar el dot der. caía en izq.
// Recorte del área de hit en la MEDIANA del par (nearest-wins): rectángulo hasta la mediana
// (mitad propia + 11px hacia el vecino) ∪ círculo r13.5 alrededor del dot propio, así el hit
// conserva 44px en las 3 direcciones libres y NADA visible (dot+halo r12.5, aro sugerido r13)
// queda recortado. Coordenadas en px del border-box fijo de 44×44.
const PAIR_CIRCLE = 'M8.5 22 a13.5 13.5 0 1 1 27 0 a13.5 13.5 0 1 1 -27 0 Z'
const PAIR_CLIP: Record<'l' | 'r', string> = {
  l: `path('M0 0 H33 V44 H0 Z ${PAIR_CIRCLE}')`,
  r: `path('M11 0 H44 V44 H11 Z ${PAIR_CIRCLE}')`,
}
// Centros horizontales de las dos figuras (para rotular Frente/Espalda bajo la lámina).
const FRONT_CX = 32.2
const BACK_CX = 67.7

function relLabel(ts: number | null): string {
  if (ts == null) return 'sin registro'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

// Lámina anatómica theme-aware. AMBAS imágenes viven en el DOM y se conmutan con [data-theme]
// vía opacity (no display:none): las dos se cargan/decodifican al montar, así el cambio de tema
// es instantáneo — cero flash ni re-fetch. loading=lazy: el mapa vive colapsado (Inicio) o
// diferido (RegistrarSheet), la lámina solo baja cuando el box entra al viewport.
// mix-blend funde el fondo de la lámina con la card (bg-raised): multiply en Papel (el crema
// se hace papel de la card), screen en oscuro (el negro se hace obsidiana de la card) — la
// ilustración queda "impresa" en la card, sin costura. Requiere `isolate` en la card raíz.
function BodyIllustration() {
  const common =
    'absolute inset-0 h-full w-full select-none object-cover transition-none pointer-events-none'
  return (
    <>
      <img
        src={bodyPapel}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`${common} mix-blend-multiply opacity-100 [[data-theme=dark]_&]:opacity-0`}
      />
      <img
        src={bodyNoche}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`${common} mix-blend-screen opacity-0 [[data-theme=dark]_&]:opacity-100`}
      />
    </>
  )
}

function Zone({
  site,
  x,
  y,
  pair,
  recency,
  isSelected,
  isSuggested,
  onSelect,
  reduce,
}: {
  site: InjectionSite
  x: number
  y: number
  pair: 'l' | 'r'
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
      style={{ left: `${x}%`, top: `${y}%`, clipPath: PAIR_CLIP[pair] }}
    >
      {/* halo de zona sugerida — ámbar (tu atención aquí), guiño discontinuo de instrumento.
          inset-[9px] → aro de 26px que abraza el dot: en la anatomía real los pares distan ~21px,
          un aro más ancho invadiría al vecino. */}
      {isSuggested && (
        <span
          aria-hidden
          className="absolute inset-[9px] rounded-full"
          style={{ border: '1.5px dashed var(--amber)', opacity: 0.9 }}
        />
      )}
      {/* dot de recencia — 20px (los pares anatómicos distan ~21px en pantalla; a 28px se
          traslapaban). El chip/halo color superficie lo despega del trazo de la lámina en ambos
          temas; el fondo activo mezcla sobre --surface (opaco) para no dejar pasar la ilustración. */}
      <span
        aria-hidden
        className="grid h-5 w-5 place-items-center rounded-full font-mono text-[11px] leading-none"
        style={{
          background: active
            ? `color-mix(in srgb, ${color} 22%, var(--surface))`
            : 'var(--surface)',
          border: `${isSelected ? 2.5 : 1.5}px solid ${
            isSelected ? 'var(--blue)' : active ? color : 'color-mix(in srgb, var(--ink-3) 60%, transparent)'
          }`,
          color: isSelected ? 'var(--blue)' : active ? color : 'var(--ink-3)',
          boxShadow: '0 0 0 2.5px color-mix(in srgb, var(--surface) 82%, transparent)',
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
      className="isolate rounded-sm border border-hairline bg-raised p-4"
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

      {/* Lámina anatómica (frente + espalda) + zonas interactivas encima */}
      <div className="relative mx-auto w-full" style={{ maxWidth: 360 }}>
        <div className="relative w-full aspect-[1264/848]">
          <BodyIllustration />
          {ZONES.map((z) => (
            <Zone
              key={z.site}
              site={z.site}
              x={z.x}
              y={z.y}
              pair={z.pair}
              recency={recencyMap[z.site]?.recency ?? 'none'}
              isSelected={selected === z.site}
              isSuggested={suggested === z.site}
              onSelect={() => onSelect(z.site)}
              reduce={reduce}
            />
          ))}
        </div>
        {/* Rótulos centrados bajo CADA figura (las figuras no están en 25/75 de la lámina) */}
        <div className="relative h-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3" aria-hidden>
          <span className="absolute -translate-x-1/2" style={{ left: `${FRONT_CX}%` }}>Frente</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${BACK_CX}%` }}>Espalda</span>
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
