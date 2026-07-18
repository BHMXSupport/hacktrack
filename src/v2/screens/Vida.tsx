// Vida v2 — "Vida del péptido en el cuerpo": presencia PK multi-producto.
// Estimación EDUCATIVA (vidas medias aproximadas de literatura). No es consejo médico.
import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Eye, EyeOff, Activity, Info, Plus } from 'lucide-react'
import { useApp } from '../../lib/store'
import { SectionHero } from '../ui/SectionHero'
import {
  buildPharmaSeries,
  fmtApproxMg,
  formatHalfLife,
  HALF_LIFE_H,
  getProductNote,
  collectDosesByProduct,
  timeToSteadyState,
  aucRatios,
  dosingRegularityCV,
  fluctuationIndex,
  doseIntervals,
  aucStabilityHint,
  coPresenceWindows,
  thresholdCrossTs,
  washoutMs,
  hasAccumulation,
  PRESENCE_FLOOR_PCT,
  seriesColorMap,
  type Mode,
} from '../../lib/pharma'
import { PEPTIDES } from '../../lib/catalog'
import { upcomingDoses } from '../../lib/calendar'
import { MultiLineChart } from '../../components/MultiLineChart'
import { Glass } from '../ui/Glass'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { PlainSummary } from '../ui/PlainSummary'
import { StatNumber } from '../ui/StatNumber'
import { TermInfo } from '../ui/TermInfo'
import { FolioLabel } from '../ui/FolioLabel'

// Palabras cardinales es-MX 0–10 para el resumen llano ("tres péptidos"); >10 cae a número.
const NUM_ES = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
const numWord = (n: number) => NUM_ES[n] ?? String(n)

// ── Constantes ────────────────────────────────────────────────────────────────

type Win = '24h' | '72h' | '7d'
const WIN_MS: Record<Win, number> = {
  '24h': 24 * 3_600_000,
  '72h': 72 * 3_600_000,
  '7d': 7 * 86_400_000,
}
const H_MS = 3_600_000

const WIN_OPTS: { value: Win; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '72h', label: '72 h' },
  { value: '7d', label: '7 d' },
]
const MODE_OPTS: { value: Mode; label: string }[] = [
  { value: 'percent', label: '% pico' },
  { value: 'absolute', label: 'mg' },
]

// ── Motion ────────────────────────────────────────────────────────────────────

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0, 0, 0, 1] as [number, number, number, number] },
  },
}

// ── Sub-componente: estado vacío ──────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div variants={fade} className="mt-2">
      <Glass className="flex flex-col items-center gap-4 py-10 text-center">
        {/* Ícono de "curva/actividad" — nunca matraz/jeringa (separación de marca + compliance). */}
        <span className="grid h-14 w-14 place-items-center rounded-sm bg-amber-soft">
          <Activity size={26} className="text-amber" />
        </span>
        <div>
          <p className="font-serif text-[19px] font-normal text-ink">Sin dosis registradas aún</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
            Registra tus dosis desde <span className="text-ink">Inicio</span> o el botón <span className="text-blue">＋</span>.
            Aquí verás cuánto sigue activo en tu cuerpo.
          </p>
        </div>
      </Glass>
    </motion.div>
  )
}

// ── Sub-componente: leyenda de producto ───────────────────────────────────────

interface LegendChipProps {
  product: string
  color: string
  currentMg: number
  halfLifeH: number
  isEstimatedOnly: boolean
  isAccum: boolean
  isTooShort: boolean
  hidden: boolean
  onToggle: () => void
}

function LegendChip({ product, color, currentMg, halfLifeH, isEstimatedOnly, isAccum, isTooShort, hidden, onToggle }: LegendChipProps) {
  const displayName = isEstimatedOnly ? `~${product}` : product
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={!hidden}
      aria-label={`${product}: ${fmtApproxMg(currentMg)} ahora`}
      whileTap={{ scale: 0.93 }}
      animate={{ opacity: hidden ? 0.4 : 1 }}
      transition={{ duration: 0.15 }}
      className="flex min-h-[44px] min-w-0 max-w-full flex-col items-start gap-1 rounded-lg px-3 py-2"
      style={{ border: `1.5px solid ${color}`, background: 'rgba(255,255,255,0.04)' }}
    >
      {/* Línea 1: dot + nombre + mg actuales */}
      <span className="flex min-w-0 max-w-full items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: hidden ? 'var(--muted-foreground)' : color }}
        />
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-foreground">
          {displayName}
        </span>
        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-foreground">
          {fmtApproxMg(currentMg)}
        </span>
      </span>
      {/* Línea 2: t½ + estimación + acumulación + t½ ultracorta */}
      {(halfLifeH > 0 || isEstimatedOnly || (!hidden && isAccum) || (!hidden && isTooShort)) && (
        <span className="flex flex-wrap items-center gap-1.5 pl-[18px]">
          {halfLifeH > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">{formatHalfLife(halfLifeH)}</span>
          )}
          {isEstimatedOnly && (
            <span className="text-[11px] text-muted-foreground">estimación</span>
          )}
          {!hidden && isTooShort && (
            <span
              className="rounded-full border border-white/20 px-1.5 text-[10px] font-medium leading-4 text-muted-foreground"
              title="Vida media muy corta: se elimina casi por completo en menos de 1 h, por eso la curva casi no se ve en 24 h."
            >
              ≈0 en 24 h
            </span>
          )}
          {!hidden && isAccum && (
            <span
              className="rounded-full border px-1.5 font-mono text-[10px] font-bold leading-4"
              style={{ color: 'var(--warn)', borderColor: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 20%, transparent)' }}
            >
              ×2 acum.
            </span>
          )}
        </span>
      )}
    </motion.button>
  )
}

// ── Sub-componente: pill de próxima dosis ─────────────────────────────────────

function NextDosePill({ nextTs, now }: { nextTs: number; now: number }) {
  // #51: si la dosis ya pasó, NO desaparecer — mostrar "atrasada · hace ~X" en color warn.
  const diffMs = nextTs - now
  const overdue = diffMs < 0
  const absH = Math.abs(diffMs) / H_MS
  let label: string
  if (absH < 1) label = `~${Math.round(absH * 60)} min`
  else if (absH < 48) label = `~${absH < 1.5 ? '1' : Math.round(absH)} h`
  else label = `~${Math.round(absH / 24)} d`
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${overdue ? 'border-warn/40 bg-warn/10' : 'border-teal/30 bg-teal/10'}`}
    >
      <span className={`font-mono text-[11px] font-semibold ${overdue ? 'text-warn' : 'text-teal'}`}>
        {overdue ? `Dosis atrasada · hace ${label}` : `Próxima dosis en ${label}`}
      </span>
    </motion.div>
  )
}

// ── Sub-componente: barras AUC ────────────────────────────────────────────────

function AucBars({ series }: { series: { product: string; color: string; aucMgH: number }[] }) {
  const withAuc = series.filter((s) => s.aucMgH > 0)
  if (withAuc.length === 0) return null
  const maxAuc = Math.max(...withAuc.map((s) => s.aucMgH))
  const fmt = (v: number) =>
    v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v))
  return (
    <div className="flex flex-col gap-2.5">
      {withAuc.map((s, i) => (
        <div key={s.product} className="flex min-w-0 items-center gap-3">
          <span className="w-20 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-ink-2">
            {s.product}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                width: `${(s.aucMgH / maxAuc) * 100}%`,
                background: s.color,
                transformOrigin: 'left center',
              }}
            />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-ink">
            {fmt(s.aucMgH)} mg·h
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function Vida() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  const [now, setNow] = useState(() => Date.now())
  const [win, setWin] = useState<Win>('24h') // default: 24h (−12h/+12h centrado en ahora), no 7d
  const [mode, setMode] = useState<Mode>('percent')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showNextDose, setShowNextDose] = useState(true)
  const [showNotes, setShowNotes] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const curveRef = useRef<HTMLDivElement>(null) // ancla de "Ver la curva ↓" (scroll a la figura)

  // "ahora" en vivo — pausa el tick cuando la pestaña/app no está visible (batería).
  useEffect(() => {
    let id: number | undefined
    const start = () => {
      if (id == null) id = window.setInterval(() => setNow(Date.now()), 60_000)
    }
    const stop = () => {
      if (id != null) { window.clearInterval(id); id = undefined }
    }
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop())
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // ── Datos PK ──────────────────────────────────────────────────────────────

  const data = useMemo(
    () => buildPharmaSeries(state, { now, windowMs: WIN_MS[win], mode }),
    [state, now, win, mode],
  )

  const byProduct = useMemo(() => collectDosesByProduct(state), [state.log, state.productRecon])

  // Color de serie ESTABLE por producto (azul/oro/violeta de la ref canónica) — misma fuente
  // que buildPharmaSeries, para que refs verticales y notas coincidan con las curvas/barras.
  const seriesColors = useMemo(() => seriesColorMap(state), [state.log, state.protocols])

  const nextDose = useMemo(() => {
    const upcoming = upcomingDoses(state, new Date(now), 3, 30)
    return upcoming[0] ?? null
  }, [state, now])

  // Líneas verticales de "próxima dosis" POR PÉPTIDO (color por categoría). Si ≥2 péptidos caen en
  // la MISMA hora, se colapsan en una sola línea "stack (N péptidos) · hora". Solo dentro de la ventana.
  const nextDoseRefs = useMemo(() => {
    if (!showNextDose) return []
    const [x0, x1] = data.domainX
    const ups = upcomingDoses(state, new Date(now), 60, 14)
    const firstByProduct = new Map<string, number>() // primera próxima dosis por producto
    for (const u of ups) {
      const ts = u.date.getTime()
      if (ts <= now || ts < x0 || ts > x1) continue
      if (!firstByProduct.has(u.product)) firstByProduct.set(u.product, ts)
    }
    const byHour = new Map<number, { product: string; ts: number }[]>() // agrupar por hora
    for (const [product, ts] of firstByProduct) {
      const bucket = Math.floor(ts / 3_600_000)
      const arr = byHour.get(bucket) ?? []
      arr.push({ product, ts })
      byHour.set(bucket, arr)
    }
    const refs: { t: number; label: string; color?: string; tooltip?: string; dot?: boolean }[] = []
    for (const group of byHour.values()) {
      if (group.length >= 2) {
        const ts = Math.min(...group.map((g) => g.ts))
        const hora = new Date(ts).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
        const names = group.map((g) => g.product)
        // Si los nombres caben en el label (≤ 28 chars), los incluimos directamente;
        // si no, caemos al formato 'stack (N)' pero añadimos los nombres en el tooltip.
        const namesJoined = names.join(' + ')
        const labelBase = namesJoined.length <= 28
          ? `${namesJoined} · ${hora}`
          : `stack (${group.length}) · ${hora}`
        const tooltipStr = namesJoined.length > 28 ? `${namesJoined} · ${hora}` : undefined
        refs.push({ t: ts, label: labelBase, color: 'var(--teal-bright)', dot: true, ...(tooltipStr ? { tooltip: tooltipStr } : {}) })
      } else {
        const { product, ts } = group[0]
        const color = seriesColors.get(product) ?? 'var(--series-1)'
        refs.push({ t: ts, label: product, color, dot: true })
      }
    }
    return refs
  }, [showNextDose, state, now, data.domainX, seriesColors])

  const toggle = (product: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(product) ? next.delete(product) : next.add(product)
      return next
    })

  const visible = data.series.filter((s) => !hidden.has(s.product))

  // Productos con acumulación
  const accumProducts = useMemo(() => {
    const set = new Set<string>()
    for (const s of data.series) {
      const doses = byProduct.get(s.product) ?? []
      const halfMs = s.halfLifeH * H_MS
      if (hasAccumulation(doses as { product: string; value: number; ts: number }[], halfMs)) {
        set.add(s.product)
      }
    }
    return set
  }, [data.series, byProduct])

  // Presencia por péptido (% del pico = currentMg/peakMg) — alimenta el resumen llano, el hero y las
  // barras. Deriva de PharmaSeries (misma fuente que la gráfica); ordenado por presencia desc.
  const ranked = useMemo(
    () =>
      data.series
        .map((s) => ({
          product: s.product,
          color: s.color,
          halfLifeH: s.halfLifeH,
          isAccum: accumProducts.has(s.product),
          pct: s.peakMg > 0 ? Math.min(100, (s.currentMg / s.peakMg) * 100) : 0,
        }))
        .sort((a, b) => b.pct - a.pct),
    [data.series, accumProducts],
  )
  const dominant = ranked[0]
  const activeCount = ranked.filter((r) => r.pct >= PRESENCE_FLOOR_PCT).length

  // Notas educativas por producto
  const noteProducts = useMemo(() => {
    // #10: productos registrados pero sin presencia en la ventana → mostrarlos con su última dosis
    // (en vez de desaparecerlos y dejar al usuario con "Sin datos" tras volver de un descanso).
    const fmtAgo = (ts: number) => {
      const days = Math.floor((now - ts) / 86_400_000)
      if (days <= 0) return 'hoy'
      if (days === 1) return 'ayer'
      return `hace ${days} días`
    }
    const lastByProduct = new Map(data.outOfWindow.map((o) => [o.product, o.lastTs] as const))
    const set = new Set<string>()
    data.series.forEach((s) => set.add(s.product))
    data.skipped.forEach((p) => set.add(p))
    data.outOfWindow.forEach((o) => set.add(o.product))
    Object.keys(state.protocols).forEach((p) => set.add(p))
    return [...set].map((p) => {
      const oowTs = lastByProduct.get(p)
      return {
        product: p,
        color:
          data.series.find((s) => s.product === p)?.color ??
          seriesColors.get(p) ??
          'var(--series-1)',
        text: oowTs != null ? `sin presencia en esta ventana — última dosis ${fmtAgo(oowTs)}` : getProductNote(p),
      }
    })
  }, [data.series, data.skipped, data.outOfWindow, state.protocols, now, seriesColors])

  // ── Ejes ──────────────────────────────────────────────────────────────────

  const yTicks = useMemo(() => {
    if (mode === 'percent') return [0, 50, 100]
    return [0, data.domainY[1] / 2, data.domainY[1]]
  }, [mode, data.domainY])

  const formatY = useMemo(() => {
    if (mode === 'percent') return (v: number) => `${Math.round(v)}%`
    return (v: number) => (v >= 1 ? String(Math.round(v)) : v.toFixed(1))
  }, [mode])

  const xTicks = useMemo(() => {
    const [a, b] = data.domainX
    const out: { t: number; label: string }[] = []
    for (let i = 0; i < 4; i++) {
      const t = a + ((b - a) * i) / 3
      const dh = (t - now) / H_MS
      let label: string
      if (Math.abs(dh) < 0.5) label = 'hoy'
      else if (win === '7d') label = `${dh > 0 ? '+' : '−'}${Math.round(Math.abs(dh) / 24)}d`
      else label = `${dh > 0 ? '+' : '−'}${Math.round(Math.abs(dh))}h`
      out.push({ t, label })
    }
    return out
  }, [data.domainX, now, win])

  // Líneas de cruce al 25%
  const threshold25Refs = useMemo(() => {
    if (mode !== 'percent') return []
    const refs: { t: number; label: string; color: string }[] = []
    for (const s of data.series) {
      if (hidden.has(s.product)) continue
      const doses = byProduct.get(s.product)
      if (!doses || doses.length === 0) continue
      const halfMs = (HALF_LIFE_H[s.product] ?? 0) * H_MS
      if (halfMs <= 0) continue
      const crossTs = thresholdCrossTs(
        doses as { product: string; value: number; ts: number }[],
        s.product,
        halfMs,
        0.25,
      )
      if (crossTs != null && crossTs >= data.domainX[0] && crossTs <= data.domainX[1]) {
        refs.push({ t: crossTs, label: `${s.product.slice(0, 8)} 25%`, color: s.color })
      }
    }
    return refs
  }, [data.series, data.domainX, mode, byProduct, hidden])

  // Zona de washout
  const washoutShadingTs = useMemo(() => {
    const withHalf = data.series
      .filter((s) => !hidden.has(s.product) && (HALF_LIFE_H[s.product] ?? 0) > 0)
      .sort((a, b) => (HALF_LIFE_H[b.product] ?? 0) - (HALF_LIFE_H[a.product] ?? 0))
    if (!withHalf.length) return undefined
    const s = withHalf[0]
    const doses = byProduct.get(s.product)
    if (!doses || !doses.length) return undefined
    const lastDoseTs = Math.max(...doses.map((d) => d.ts))
    return lastDoseTs + washoutMs(HALF_LIFE_H[s.product] ?? 0)
  }, [data.series, hidden, byProduct])

  // Tabla sr-only para a11y
  const srTableRows = useMemo(
    () =>
      data.series.map((s) => {
        const peak = Math.max(...s.points.map((p) => p[1]))
        const current = s.points.find((p) => Math.abs(p[0] - now) < 1_800_000)?.[1] ?? 0
        const tMaxPt = s.points.reduce(
          (best, p) => (p[1] > best[1] ? p : best),
          s.points[0] ?? [0, 0],
        )
        const dh = tMaxPt ? (tMaxPt[0] - now) / H_MS : 0
        const tMaxLabel =
          Math.abs(dh) < 0.5 ? 'ahora' : dh > 0 ? `+${dh.toFixed(1)}h` : `${dh.toFixed(1)}h`
        return {
          product: s.product,
          peak: mode === 'percent' ? `${peak.toFixed(0)}%` : fmtApproxMg(peak),
          current:
            mode === 'percent'
              ? `${Math.max(0, current).toFixed(0)}%`
              : fmtApproxMg(Math.max(0, current)),
          tMax: tMaxLabel,
        }
      }),
    [data.series, now, mode],
  )

  // Análisis avanzado
  const advancedMetrics = useMemo(() => {
    const tssItems = data.series.map((s) => ({
      product: s.product,
      color: s.color,
      tss: timeToSteadyState(s.halfLifeH),
    }))
    const ratios = aucRatios(data.series.filter((s) => !hidden.has(s.product)))
    const aucEntries = Object.entries(ratios).sort((a, b) => b[1] - a[1])
    const perProduct = data.series.map((s) => {
      const doses = byProduct.get(s.product) ?? []
      const halfMs = s.halfLifeH * H_MS
      const cv = dosingRegularityCV(doses)
      const cvLabel =
        cv == null
          ? null
          : cv < 15
          ? { label: 'Regular', color: 'var(--ok)' }
          : cv < 30
          ? { label: 'Irregular', color: 'var(--warn)' }
          : { label: 'Muy irregular', color: 'var(--alert)' }
      let targetIntervalH: number | undefined
      const proto = state.protocols?.[s.product]
      if (proto) {
        const t = PEPTIDES[s.product]?.type
        if (t === 'diaria') targetIntervalH = 24
        else if (t === 'semanal') targetIntervalH = 168
        else if (t === 'lv') targetIntervalH = 48
        else if (PEPTIDES[s.product]?.cat === 'Metabolismo' && s.halfLifeH >= 24)
          targetIntervalH = 168
      }
      const intervals = doseIntervals(doses)
      const hint = aucStabilityHint(doses, halfMs)
      let fi: number | null = null
      const isGlp1 =
        PEPTIDES[s.product]?.cat === 'Metabolismo' && s.halfLifeH >= 24
      if (isGlp1 && doses.length >= 2) {
        fi = fluctuationIndex(
          doses as { product: string; value: number; ts: number }[],
          halfMs,
          targetIntervalH ? targetIntervalH * H_MS : 168 * H_MS,
        )
      }
      const accum = hasAccumulation(
        doses as { product: string; value: number; ts: number }[],
        halfMs,
      )
      return {
        product: s.product,
        color: s.color,
        halfLifeH: s.halfLifeH,
        cv,
        cvLabel,
        intervals,
        targetIntervalH,
        hint,
        fi,
        isGlp1,
        accum,
      }
    })
    const coPres = coPresenceWindows(
      data.series.map((s) => ({ product: s.product, peakMg: s.peakMg })),
      now,
      byProduct as Map<string, { product: string; value: number; ts: number }[]>,
    )
    return { tssItems, ratios, aucEntries, perProduct, coPres }
  }, [data.series, state, hidden, now, byProduct])

  // ── Derivados de presentación (reloj de cabecera, acciones, resumen llano) ──
  // Reloj coherente con "now" (mismo instante que status/countdowns — regla de la ref canónica).
  // h23 como la ref ("AHORA · 14:48"): el 12h sin meridiano era ambiguo y chocaba con el engrane.
  const clock = new Date(now).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  // Registrar dosis: abre la sheet existente (sin lógica nueva), prefijada al péptido dominante.
  const openRegistrar = () => dispatch({ t: 'sheet', sheet: 'registrar', arg: dominant?.product ?? null })
  const scrollToCurve = () =>
    curveRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })

  // Frase llana (Ley 1: divulgación progresiva) — nombra cuántos siguen activos y el dominante.
  const summarySentence: ReactNode =
    activeCount <= 0 ? (
      <>Por ahora, ningún péptido mantiene <b>presencia relevante</b>; los registrados siguen en lavado.</>
    ) : activeCount === 1 ? (
      <>
        Ahora mismo, <b>un péptido</b> sigue activo en tu cuerpo: <b>{dominant.product}</b>.
      </>
    ) : (
      <>
        Ahora mismo, <b>{numWord(activeCount)} péptidos</b> siguen activos en tu cuerpo. El que más
        presencia tiene es <b>{dominant.product}</b>.
      </>
    )

  // ── Estado vacío ──────────────────────────────────────────────────────────

  if (!data.hasAnyDose) {
    return (
      <motion.div
        className="flex flex-col gap-5 px-5 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      >
        <motion.div variants={fade}>
          <SectionHero
            eyebrow="Vida · en tu cuerpo"
            meta={`Ahora · ${clock}`}
            metaClear
            title="Vida"
            subtitle="Lo que sigue activo en tu cuerpo, estimado a partir de tus dosis."
          />
        </motion.div>
        <EmptyState />
      </motion.div>
    )
  }

  // Sin series graficables
  if (data.series.length === 0) {
    return (
      <motion.div
        className="flex flex-col gap-5 px-5 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      >
        <motion.div variants={fade}>
          <SectionHero
            eyebrow="Vida · en tu cuerpo"
            meta={`Ahora · ${clock}`}
            metaClear
            title="Vida"
            subtitle="Lo que sigue activo en tu cuerpo, estimado a partir de tus dosis."
          />
        </motion.div>
        <motion.div variants={fade}>
          <Glass>
            <p className="font-serif text-[19px] font-normal text-ink">Vida del péptido en el cuerpo</p>
            <p className="mt-2 text-[14px] text-ink-2 leading-relaxed">
              {(data.skipped.length > 0 || data.outOfWindow.length > 0)
                ? 'Estos productos están registrados pero sin presencia en esta ventana. Aquí tienes su contexto — amplía el rango para ver dosis más antiguas:'
                : 'Ningún producto tiene presencia relevante en esta ventana. Amplía el rango o registra una dosis reciente.'}
            </p>
            {noteProducts.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {noteProducts.map((n) => (
                  <div key={n.product} className="flex gap-2 text-[12px] text-ink-3 leading-snug">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: n.color }}
                    />
                    <span>
                      <strong className="font-semibold text-ink-2">{n.product}:</strong>{' '}
                      {n.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {data.skipped.length === 0 && win !== '7d' && (
              <button
                onClick={() => setWin('7d')}
                className="mt-3 text-[14px] font-semibold text-blue"
              >
                Ver 7 días
              </button>
            )}
          </Glass>
        </motion.div>
        {/* Disclaimer sólido */}
        <motion.div variants={fade}>
          <div className="flex gap-2.5 rounded-sm border border-hairline bg-raised px-3.5 py-3">
            <Info size={16} className="mt-0.5 shrink-0 text-ink-3" />
            <p className="text-[12px] text-ink-2 leading-relaxed">
              Esta visualización no constituye guía médica. Estimación educativa basada en vidas medias
              aproximadas de literatura científica.
            </p>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // ── Render principal ──────────────────────────────────────────────────────

  return (
    <motion.div
      className="flex flex-col gap-5 px-5 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* Cabecera — masthead editorial (kicker + reloj coherente con "now") */}
      <motion.div variants={fade}>
        <SectionHero
          eyebrow="Vida · en tu cuerpo"
          meta={`Ahora · ${clock}`}
          metaClear
          title="Vida"
          subtitle="Lo que sigue activo en tu cuerpo, estimado a partir de tus dosis."
        />
      </motion.div>

      {/* ── LEAD llano (Ley 1): frase + numeral grande + acción + barras por péptido ── */}
      <motion.div variants={fade}>
        <Glass className="flex flex-col gap-4 p-[18px]">
          <PlainSummary>{summarySentence}</PlainSummary>

          {/* Hero: dominante % del pico (serif, count-up) + etiqueta con tap-explain */}
          {dominant && (
            <div className="flex items-end gap-3.5">
              {/* El "%" en ámbar/oro como la ref (.hero .pct): 28px ≈ texto grande → AA con ≥3:1. */}
              <StatNumber value={dominant.pct} unit="%" decimals={0} size={72} unitSize={28} unitClass="text-amber" />
              <div className="pb-1.5">
                <div className="font-serif text-[19px] font-normal leading-tight text-ink">
                  {dominant.product}
                </div>
                <div className="mt-1 flex items-center gap-1 font-mono text-[12px] text-ink-3">
                  de su pico estimado
                  <TermInfo term="% del pico">
                    Qué tan cerca está del punto más alto que alcanzó tras tu última dosis (estimado).
                    No es un nivel en sangre.
                  </TermInfo>
                </div>
              </div>
            </div>
          )}

          {/* Acciones: Registrar dosis (azul) + Ver la curva ↓ (contorno, ancla a la figura) */}
          <div className="flex gap-2.5">
            <Button variant="primary" size="full" className="flex-1" onClick={openRegistrar}>
              <Plus size={16} strokeWidth={2.4} aria-hidden />
              Registrar dosis
            </Button>
            <Button variant="outline" size="full" className="flex-1" onClick={scrollToCurve}>
              Ver la curva ↓
            </Button>
          </div>

          {/* Resumen llano por péptido: nombre + t½ + barra en su color + % o "en lavado" */}
          {ranked.length > 0 && (
            <div className="-mb-1 mt-1">
              {ranked.map((r, i) => {
                const washout = r.pct < 5
                return (
                  <div key={r.product} className="flex items-center gap-3 border-t border-hairline py-3">
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: r.color }} />
                    <div className="w-[92px] shrink-0">
                      <div className="truncate font-serif text-[16px] leading-none text-ink">{r.product}</div>
                      <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-ink-3">
                        <span className="truncate">
                          t½ ~{formatHalfLife(r.halfLifeH)}
                          {r.isAccum ? ' · acum.' : ''}
                        </span>
                        {i === 0 && (
                          <TermInfo term="t½ (vida media)">
                            El tiempo que tarda en quedar la mitad de lo que había. Marca qué tan
                            rápido se elimina.
                          </TermInfo>
                        )}
                      </div>
                    </div>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(2, r.pct)}%`, background: r.color, transformOrigin: 'left center' }}
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.5, delay: 0.1 + i * 0.06, ease: [0, 0, 0, 1] }}
                      />
                    </div>
                    <div className="min-w-[70px] shrink-0 whitespace-nowrap text-right">
                      {washout ? (
                        <span
                          className="inline-block rounded-full border px-2 py-0.5 font-mono text-[12px] font-medium"
                          style={{
                            /* Texto 12px: mezcla hacia tinta para AA (≥4.5) en las 3 series y ambos temas;
                               el borde/fondo conservan el color puro de la serie (elemento gráfico). */
                            color: `color-mix(in srgb, ${r.color} 60%, var(--ink))`,
                            borderColor: `color-mix(in srgb, ${r.color} 40%, transparent)`,
                            background: `color-mix(in srgb, ${r.color} 8%, transparent)`,
                          }}
                        >
                          en lavado
                        </span>
                      ) : (
                        <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">
                          {Math.round(r.pct)}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Glass>
      </motion.div>

      {/* ── LA CURVA COMPLETA: folio + controles + figura científica (divulgación) ── */}
      <motion.div variants={fade} ref={curveRef} className="scroll-mt-4 flex flex-col gap-3">
        <FolioLabel n={2}>La curva completa</FolioLabel>

        {/* Controles como la ref: ventana = píldoras sueltas con activa EN TINTA (izq);
            escala (% pico / mg) = toggle agrupado con activa azul (der). */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedTabs<Win>
            options={WIN_OPTS}
            value={win}
            onChange={setWin}
            variant="pills"
          />
          <SegmentedTabs<Mode>
            options={MODE_OPTS}
            value={mode}
            onChange={setMode}
          />
        </div>

        {/* Próxima dosis: toggle (líneas verticales por péptido) + pill */}
        {nextDose && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={showNextDose} onClick={() => setShowNextDose((v) => !v)}>
              Próxima dosis
            </Chip>
            <AnimatePresence>
              {nextDose.date.getTime() > now && (
                <NextDosePill key="ndp" nextTs={nextDose.date.getTime()} now={now} />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Figura ("Fig. 1 · tu estimación personal") */}
        <Glass className="p-0">
          <div className="px-4 pt-4">
            <div
              className="flex items-baseline justify-between gap-2 pb-3"
              style={{ borderBottom: '1.5px solid var(--ink)' }}
            >
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
                  Fig. 1 · tu estimación personal
                </div>
                <div className="mt-0.5 font-serif text-[18px] leading-tight text-ink">
                  Presencia estimada
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-ink-3">
                {mode === 'percent' ? '% del pico' : 'mg residual'}
                <TermInfo term={mode === 'percent' ? '% del pico' : 'mg residual'}>
                  {mode === 'percent'
                    ? 'Porcentaje del punto más alto que alcanzó tras tu última dosis (estimado).'
                    : 'Miligramos que se estima siguen presentes ahora, según las vidas medias publicadas.'}
                </TermInfo>
              </div>
            </div>
            {/* #31: rotular la unidad del eje Y */}
            <p className="mt-2.5 font-mono text-[11px] leading-snug text-ink-3">
              Eje vertical:{' '}
              {mode === 'percent'
                ? '% del pico estimado — no es un nivel en sangre.'
                : 'mg estimados en el cuerpo — no es un nivel en sangre.'}
            </p>
          </div>

          {/* Gráfica SVG — sin padding horizontal para usar todo el ancho */}
          {visible.length > 0 ? (
            <div className="relative">
              <div
                ref={chartRef}
                role="img"
                aria-label={`Curva PK para ${visible.map((s) => s.product).join(', ')} en ventana ${win}. ${srTableRows.map((r) => `${r.product}: pico ${r.peak}, presencia actual ${r.current}, t-max ${r.tMax}`).join('; ')}.`}
              >
                <MultiLineChart
                  series={visible.map((s) => ({
                    ...s,
                    dashed: s.isEstimatedOnly,
                    halfLifeH: s.halfLifeH,
                  }))}
                  mode={mode}
                  domainX={data.domainX}
                  domainY={data.domainY}
                  nowTs={data.nowTs}
                  yTicks={yTicks}
                  formatY={formatY}
                  xTicks={xTicks}
                  refLines={
                    mode === 'percent'
                      ? [
                          {
                            y: 25,
                            label: '25%',
                            tooltip:
                              'En este punto queda el 25 % del pico estimado. Es solo un dato educativo — la cadencia la defines tú o tu profesional de salud.',
                          },
                          {
                            y: 50,
                            label: 't½',
                            tooltip:
                              'En este punto queda el 50 % del pico — una vida media transcurrida. Estimación educativa, no nivel en sangre.',
                          },
                        ]
                      : []
                  }
                  verticalRefs={[
                    ...nextDoseRefs,
                    ...threshold25Refs,
                  ]}
                  shadeFrom={washoutShadingTs}
                />

              </div>

              {/* Tabla sr-only para lectores de pantalla */}
              <table
                aria-label={`Datos de la curva PK — ${win}`}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clipPath: 'inset(50%)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Pico estimado</th>
                    <th>Presencia actual</th>
                    <th>T-máx relativo</th>
                  </tr>
                </thead>
                <tbody>
                  {srTableRows.map((r) => (
                    <tr key={r.product}>
                      <td>{r.product}</td>
                      <td>{r.peak}</td>
                      <td>{r.current}</td>
                      <td>{r.tMax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EyeOff size={24} className="text-ink-3" />
              <p className="text-[14px] text-ink-2">
                Toca un producto abajo para mostrar su curva.
              </p>
            </div>
          )}

          {/* Leyenda de productos */}
          <div className="flex flex-wrap gap-2 p-4 pt-3">
            {data.series.map((s) => (
              <LegendChip
                key={s.product}
                product={s.product}
                color={s.color}
                currentMg={s.currentMg}
                halfLifeH={s.halfLifeH}
                isEstimatedOnly={s.isEstimatedOnly}
                isAccum={accumProducts.has(s.product)}
                isTooShort={s.isTooShort}
                hidden={hidden.has(s.product)}
                onToggle={() => toggle(s.product)}
              />
            ))}
          </div>

        </Glass>
      </motion.div>

      {/* ── Exposición acumulada (AUC) — folio §-graft ── */}
      {visible.some((s) => s.aucMgH > 0) && (
        <motion.div variants={fade} className="flex flex-col gap-3">
          <FolioLabel n={3}>
            Carga acumulada (AUC)
            {/* normal-case + tracking-normal: el popover de TermInfo hereda el UPPER/tracking del folio
                si no se resetea aquí (TermInfo es primitiva compartida, no se edita). */}
            <span className="inline-flex normal-case tracking-normal">
              <TermInfo term="AUC">
                Concentración × tiempo: cuánta exposición total acumuló tu cuerpo en esta ventana.
                Estimación teórica, no un nivel en sangre.
              </TermInfo>
            </span>
          </FolioLabel>
          <Glass>
            <AucBars series={visible} />
            <p className="mt-3 text-[12px] text-ink-3 leading-snug">
              Cuánta concentración × tiempo pasó en tu cuerpo en esta ventana (estimación teórica, no un nivel en sangre).
            </p>
          </Glass>
        </motion.div>
      )}

      {/* ── Análisis avanzado ── */}
      {advancedMetrics.tssItems.length > 0 && (
        <motion.div variants={fade}>
          <Glass>
            <p className="mb-1 text-[13px] font-semibold text-foreground">
              Análisis avanzado{' '}
              <span className="font-normal text-muted-foreground">(educativo)</span>
            </p>
            {/* #84: disclaimer inline como primer elemento — los KPIs clínicos no deben quedar sin aviso */}
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
              Estimación educativa basada en vidas medias publicadas. No es un diagnóstico ni un nivel en sangre real.
            </p>
            <div className="flex flex-col gap-4">
              {/* Tss */}
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tiempo a steady-state (Tss)
                </p>
                <div className="flex flex-col gap-1.5">
                  {advancedMetrics.tssItems.map((it) => (
                    <div key={it.product} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: it.color }}
                      />
                      <span className="flex-1 text-[12px] text-secondary-foreground">
                        {it.product}
                      </span>
                      <span className="font-mono text-[12px] font-semibold text-teal">
                        {it.tss}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] text-muted-foreground leading-snug">
                  ≈ 5 vidas medias con dosis repetidas a intervalo regular. Estimación educativa.
                </p>
              </div>

              {/* AUC ratio */}
              {advancedMetrics.aucEntries.length >= 2 && (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Balance de exposición (ratio AUC)
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {advancedMetrics.aucEntries.map(([prod, frac]) => {
                      const s = data.series.find((x) => x.product === prod)
                      const color = s?.color ?? 'var(--teal)'
                      return (
                        <div key={prod} className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-secondary-foreground">
                            {prod}
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-raised">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${frac * 100}%`, background: color }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right font-mono text-[12px] font-semibold text-foreground">
                            {Math.round(frac * 100)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted-foreground leading-snug">
                    Fracción del AUC total en esta ventana. No compara eficacia entre productos.
                  </p>
                </div>
              )}

              {/* Métricas por producto */}
              {advancedMetrics.perProduct
                .filter((p) => p.cv != null || p.intervals.length >= 2 || p.fi != null)
                .map((p) => (
                  <div key={p.product} className="rounded-md bg-raised p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: p.color }}
                      />
                      <span className="text-[12px] font-semibold text-secondary-foreground">
                        {p.product}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatHalfLife(p.halfLifeH)}
                      </span>
                    </div>
                    {p.cv != null && p.cvLabel && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="flex-1 text-[12px] text-muted-foreground">Regularidad</span>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[12px] font-bold"
                          style={{ color: p.cvLabel.color, borderColor: p.cvLabel.color }}
                        >
                          {p.cvLabel.label} · CV {p.cv.toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {p.fi != null && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="flex-1 text-[12px] text-muted-foreground">
                          Fluctuación pico-valle
                        </span>
                        <span className="font-mono text-[12px] font-semibold text-secondary-foreground">
                          {p.fi < 0.3 ? 'baja' : p.fi < 0.7 ? 'media' : 'alta'} ({p.fi.toFixed(2)})
                        </span>
                      </div>
                    )}
                    {p.hint && (
                      <p
                        className="text-[12px] text-muted-foreground leading-snug"
                        style={{ borderLeft: `2px solid ${p.color}`, paddingLeft: 8 }}
                      >
                        {p.hint}
                      </p>
                    )}
                  </div>
                ))}

              {/* Co-presencia */}
              {advancedMetrics.coPres.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Solapamiento activo (co-presencia)
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {advancedMetrics.coPres.slice(0, 6).map((c, i) => {
                      const colorA =
                        data.series.find((s) => s.product === c.productA)?.color ??
                        'var(--muted-foreground)'
                      const colorB =
                        data.series.find((s) => s.product === c.productB)?.color ??
                        'var(--muted-foreground)'
                      const dh = c.durationH
                      const durLabel =
                        dh < 2
                          ? `${Math.round(dh * 60)} min`
                          : dh < 48
                          ? `${dh.toFixed(1)} h`
                          : `${(dh / 24).toFixed(1)} d`
                      return (
                        <div key={i} className="flex items-center gap-2 text-[12px]">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: colorA }}
                          />
                          <span className="max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap font-medium text-secondary-foreground">
                            {c.productA}
                          </span>
                          <span className="text-muted-foreground">+</span>
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: colorB }}
                          />
                          <span className="max-w-[72px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-secondary-foreground">
                            {c.productB}
                          </span>
                          <span className="shrink-0 font-mono font-semibold text-teal">
                            {durLabel}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted-foreground leading-snug">
                    Horas con ambos productos ≥ 2 % del pico estimado. No implica interacción farmacológica.
                  </p>
                </div>
              )}

              <p className="text-[12px] text-muted-foreground leading-snug border-l-2 border-hairline pl-3">
                Todas las métricas son estimaciones educativas basadas en modelos de primer orden y
                vidas medias de literatura. No representan farmacocinética individual ni son consejo
                médico.
              </p>
            </div>
          </Glass>
        </motion.div>
      )}

      {/* ── Notas educativas por producto ── */}
      {noteProducts.length > 0 && (
        <motion.div variants={fade}>
          <Glass>
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowNotes((v) => !v)}
            >
              <p className="text-[13px] font-semibold text-foreground">
                Notas educativas por péptido
              </p>
              <span className="text-muted-foreground">
                {showNotes ? <Eye size={16} /> : <Info size={16} />}
              </span>
            </button>
            <AnimatePresence>
              {showNotes && (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex flex-col gap-2">
                    {noteProducts.map((n) => (
                      <div
                        key={n.product}
                        className="flex gap-2 text-[12px] text-muted-foreground leading-snug"
                      >
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: n.color }}
                        />
                        <span>
                          <strong className="font-semibold text-secondary-foreground">
                            {n.product}:
                          </strong>{' '}
                          {n.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Glass>
        </motion.div>
      )}

      {/* ── Disclaimer — superficie sólida (no Glass), siempre visible ── */}
      <motion.div variants={fade}>
        <div className="flex gap-2.5 rounded-sm border border-hairline bg-raised px-3.5 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-ink-3" />
          <p className="text-[12px] text-ink-2 leading-relaxed">
            Esta visualización no constituye guía médica. Estimación educativa basada en vidas
            medias aproximadas de la literatura científica. No representa tu farmacocinética
            individual ni es recomendación de dosis. Es tu bitácora, no un dispositivo clínico.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
