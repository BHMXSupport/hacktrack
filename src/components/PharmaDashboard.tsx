// PharmaDashboard — "Vida del péptido en el cuerpo": decaimiento multi-producto desde las dosis registradas.
// Estimación EDUCATIVA (vida media aproximada de literatura), NO consejo médico ni dosis.
// (Síntesis del equipo: investigador PK + analista de datos + dashboard + diseñador + UX.)
import { useMemo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import {
  buildPharmaSeries,
  fmtApproxMg,
  formatHalfLife,
  HALF_LIFE_H,
  getProductNote,
  type Mode,
  collectDosesByProduct,
  timeToSteadyState,
  aucRatios,
  dosingRegularityCV,
  fluctuationIndex,
  doseIntervals,
  aucStabilityHint,
  coPresenceWindows,
  nextDoseWindow,
  thresholdCrossTs,
  washoutMs,
} from '../lib/pharma'
import { CATEGORY_COLOR, PEPTIDES } from '../lib/catalog'
import { upcomingDoses } from '../lib/calendar'
import { MultiLineChart } from './MultiLineChart'
import { Segmented } from './controls'
import { staggerParent, staggerItem, dur, ease } from '../lib/motion'

type Win = '24h' | '72h' | '7d'
const WIN_MS: Record<Win, number> = { '24h': 24 * 3_600_000, '72h': 72 * 3_600_000, '7d': 7 * 86_400_000 }
const H_MS = 3_600_000

// Notas educativas movidas a pharma.ts (getProductNote). Ver item 151.

// SVG ojo barrado para estado vacío
const EyeOffIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M1 1l22 22" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

// ── Mini SVG histograma de intervalos (sin librería) ──────────────────────────
// item 290: muestra la distribución de intervalos entre dosis consecutivas
function IntervalHistogram({ intervalsH, targetH, color }: { intervalsH: number[]; targetH?: number; color: string }) {
  if (intervalsH.length === 0) return null
  const W = 120; const H = 36
  const min = Math.min(...intervalsH)
  const max = Math.max(...intervalsH)
  const span = (max - min) || 1
  const bins = 6
  const counts = Array(bins).fill(0)
  for (const v of intervalsH) {
    const b = Math.min(bins - 1, Math.floor(((v - min) / span) * bins))
    counts[b]++
  }
  const maxCount = Math.max(...counts) || 1
  const barW = (W - 4) / bins - 2

  // posición X del target (intervalo objetivo)
  const targetX = targetH != null && targetH >= min && targetH <= max
    ? 2 + ((targetH - min) / span) * (W - 4)
    : null

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {counts.map((c, i) => {
        const bh = (c / maxCount) * (H - 10)
        const bx = 2 + i * (barW + 2)
        return (
          <rect
            key={i}
            x={bx}
            y={H - 10 - bh}
            width={barW}
            height={bh}
            fill={color}
            opacity={0.55}
            rx={1.5}
          />
        )
      })}
      {targetX != null && (
        <>
          <line x1={targetX} y1={4} x2={targetX} y2={H - 10} stroke="var(--ink-400)" strokeWidth={1} strokeDasharray="2 2" />
          <text x={targetX + 2} y={10} fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-400)">obj.</text>
        </>
      )}
      {/* eje X mínimo/máximo */}
      <text x={2} y={H - 1} fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
        {min < 48 ? `${Math.round(min)}h` : `${Math.round(min / 24)}d`}
      </text>
      <text x={W - 2} y={H - 1} textAnchor="end" fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
        {max < 48 ? `${Math.round(max)}h` : `${Math.round(max / 24)}d`}
      </text>
    </svg>
  )
}

// ── Badge de acumulación ──────────────────────────────────────────────────────
// item 279: visible cuando la 2ª dosis se aplica antes de que la 1ª llegue al 10%
function hasAccumulation(doses: { ts: number; value: number; product: string }[], halfMs: number): boolean {
  if (doses.length < 2) return false
  const sorted = [...doses].sort((a, b) => a.ts - b.ts)
  for (let i = 1; i < sorted.length; i++) {
    const dtMs = sorted[i].ts - sorted[i - 1].ts
    // fracción restante de dosis[i-1] cuando llega dosis[i]
    const remaining = Math.pow(0.5, dtMs / halfMs)
    if (remaining > 0.1) return true // >10% todavía circulando → acumulación real
  }
  return false
}

// ── Pill "Próxima dosis en ~X h" ─────────────────────────────────────────────
// item 377
function NextDosePill({ nextTs, now }: { nextTs: number; now: number }) {
  const diffMs = nextTs - now
  if (diffMs < 0) return null
  const diffH = diffMs / H_MS
  let label: string
  if (diffH < 1) label = `~${Math.round(diffH * 60)} min`
  else if (diffH < 48) label = `~${diffH < 1.5 ? '1' : Math.round(diffH)} h`
  else label = `~${Math.round(diffH / 24)} d`

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: dur.fast, ease: ease.standard }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        background: 'var(--brand-100)',
        border: '1px solid var(--brand-300)',
        marginTop: 8,
      }}
    >
      <span style={{ fontSize: 9, color: 'var(--brand-700)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
        Próxima dosis en {label}
      </span>
    </motion.div>
  )
}

export function PharmaDashboard() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [win, setWin] = useState<Win>('7d')
  const [mode, setMode] = useState<Mode>('percent')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showNextDose, setShowNextDose] = useState(true)
  const [showWeight, setShowWeight] = useState(false)
  // item 287/285/286/288/290/293/283 — panel análisis avanzado colapsable
  const [showAdvanced, setShowAdvanced] = useState(false)
  // n°418: KPI overlay selector
  const [kpiOverlay, setKpiOverlay] = useState<string | null>(null)
  const [kpiTipIdx, setKpiTipIdx] = useState<number | null>(null)
  // n°500: chart ref for sr-only table (prefers-reduced-motion handled by MultiLineChart internally)
  const chartRef = useRef<HTMLDivElement>(null)

  // "ahora" en vivo (el punto de cada serie y la línea avanzan)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const data = useMemo(
    () => buildPharmaSeries(state, { now, windowMs: WIN_MS[win], mode }),
    [state, now, win, mode],
  )

  const nextDose = useMemo(() => {
    const upcoming = upcomingDoses(state, new Date(now), 3, 30)
    return upcoming[0] ?? null
  }, [state, now])

  const hasGlp1 = useMemo(() =>
    data.series.some((s) => PEPTIDES[s.product]?.cat === 'Metabolismo' && (HALF_LIFE_H[s.product] ?? 0) >= 24),
    [data.series],
  )

  const weightOverlay = useMemo(() => {
    if (!hasGlp1 || !showWeight) return null
    const pts = (state.history['Peso'] ?? [])
      .filter((p) => p.ts >= data.domainX[0] && p.ts <= data.domainX[1])
      .sort((a, b) => a.ts - b.ts)
      .map((p) => [p.ts, p.value] as [number, number])
    if (pts.length < 2) return null
    const vals = pts.map((p) => p[1])
    return {
      points: pts,
      domainY2: [Math.min(...vals) - 0.5, Math.max(...vals) + 0.5] as [number, number],
      color: 'var(--ink-400)',
      label: 'kg',
    }
  }, [hasGlp1, showWeight, state.history, data.domainX])

  const toggle = (product: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(product) ? next.delete(product) : next.add(product)
      return next
    })

  const visible = data.series.filter((s) => !hidden.has(s.product))

  // Notas por producto: solo de los productos ACTIVOS (en la gráfica, consumidos sin t½, o en protocolo)
  const noteProducts = (() => {
    const set = new Set<string>()
    data.series.forEach((s) => set.add(s.product))
    data.skipped.forEach((p) => set.add(p))
    Object.keys(state.protocols).forEach((p) => set.add(p))
    const out: { product: string; color: string; text: string }[] = []
    for (const p of set) {
      const text = getProductNote(p)
      const color = data.series.find((s) => s.product === p)?.color ?? CATEGORY_COLOR[PEPTIDES[p]?.cat ?? 'Explorar'] ?? 'var(--brand-700)'
      out.push({ product: p, color, text })
    }
    return out
  })()

  const notesBlock = (
    <AnimatePresence>
      <motion.div
        key="notes-block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
      >
        {noteProducts.map((n) => (
          <div key={n.product} className="sm" style={{ color: 'var(--ink-400)', lineHeight: 1.4, display: 'flex', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: n.color, flexShrink: 0, marginTop: 5 }} />
            <span><strong style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{n.product}:</strong> {n.text}</span>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  )

  // ── Eje Y ──
  const yTicks = mode === 'percent' ? [0, 50, 100] : [0, data.domainY[1] / 2, data.domainY[1]]
  const formatY = mode === 'percent' ? (v: number) => `${Math.round(v)}%` : (v: number) => (v >= 1 ? String(Math.round(v)) : v.toFixed(1))

  // ── Eje X: 4 marcas relativas a "ahora" ──
  const xTicks = useMemo(() => {
    const [a, b] = data.domainX
    const out: { t: number; label: string }[] = []
    for (let i = 0; i < 4; i++) {
      const t = a + ((b - a) * i) / 3
      const dh = (t - now) / 3_600_000
      let label: string
      if (Math.abs(dh) < 0.5) label = 'hoy'
      else if (win === '7d') label = `${dh > 0 ? '+' : '−'}${Math.round(Math.abs(dh) / 24)}d`
      else label = `${dh > 0 ? '+' : '−'}${Math.round(Math.abs(dh))}h` // 24h / 72h → horas
      out.push({ t, label })
    }
    return out
  }, [data.domainX, now, win])

  // ── item 276: línea vertical en el cruce del 25% (thresholdCrossTs) ──
  const threshold25Refs = useMemo(() => {
    if (mode !== 'percent') return []
    const byProduct = collectDosesByProduct(state)
    const refs: { t: number; label: string; color: string }[] = []
    for (const s of data.series) {
      if (hidden.has(s.product)) continue
      const doses = byProduct.get(s.product)
      if (!doses || doses.length === 0) continue
      const halfMs = (HALF_LIFE_H[s.product] ?? 0) * H_MS
      if (halfMs <= 0) continue
      const crossTs = thresholdCrossTs(doses as { product: string; value: number; ts: number }[], s.product, halfMs, 0.25)
      if (crossTs != null && crossTs >= data.domainX[0] && crossTs <= data.domainX[1]) {
        refs.push({ t: crossTs, label: `${s.product.slice(0, 8)} 25%`, color: s.color })
      }
    }
    return refs
  }, [data.series, data.domainX, mode, state, hidden])

  // ── item 280: washout del producto con t½ más larga visible ──
  const washoutShadingTs = useMemo(() => {
    const withHalf = data.series
      .filter((s) => !hidden.has(s.product) && (HALF_LIFE_H[s.product] ?? 0) > 0)
      .sort((a, b) => (HALF_LIFE_H[b.product] ?? 0) - (HALF_LIFE_H[a.product] ?? 0))
    if (!withHalf.length) return undefined
    const byProduct = collectDosesByProduct(state)
    const s = withHalf[0]
    const halfMs = (HALF_LIFE_H[s.product] ?? 0) * H_MS
    const doses = byProduct.get(s.product)
    if (!doses || !doses.length) return undefined
    const lastDoseTs = Math.max(...doses.map((d) => d.ts))
    return lastDoseTs + washoutMs(HALF_LIFE_H[s.product] ?? 0)
  }, [data.series, hidden, state])

  // ── n°418: KPI overlay — opciones y puntos ──
  const kpiHistoryOptions = useMemo(
    () => Object.keys(state.history).filter((k) => (state.history[k]?.length ?? 0) > 0),
    [state.history],
  )
  const kpiPoints = useMemo(() => {
    if (!kpiOverlay) return []
    const samples = (state.history[kpiOverlay] ?? [])
      .filter((s) => s.ts >= data.domainX[0] && s.ts <= data.domainX[1])
      .sort((a, b) => a.ts - b.ts)
    return samples
  }, [kpiOverlay, state.history, data.domainX])

  // ── n°500: datos de tabla sr-only (pico + presencia actual + t-max) ──
  const srTableRows = useMemo(() => {
    return data.series.map((s) => {
      const peak = Math.max(...s.points.map((p) => p[1]))
      const current = s.points.find((p) => Math.abs(p[0] - now) < 1_800_000)?.[1] ?? 0
      const tMaxPt = s.points.reduce((best, p) => p[1] > best[1] ? p : best, s.points[0] ?? [0, 0])
      const dh = tMaxPt ? (tMaxPt[0] - now) / H_MS : 0
      const tMaxLabel = Math.abs(dh) < 0.5 ? 'ahora' : dh > 0 ? `+${dh.toFixed(1)}h` : `${dh.toFixed(1)}h`
      return {
        product: s.product,
        peak: mode === 'percent' ? `${peak.toFixed(0)}%` : fmtApproxMg(peak),
        current: mode === 'percent' ? `${Math.max(0, current).toFixed(0)}%` : fmtApproxMg(Math.max(0, current)),
        tMax: tMaxLabel,
      }
    })
  }, [data.series, now, mode])

  // ── Análisis avanzado (para el panel colapsable) ──
  const advancedMetrics = useMemo(() => {
    if (!showAdvanced) return null
    const byProduct = collectDosesByProduct(state)

    // Tss por producto (item 287)
    const tssItems = data.series.map((s) => ({
      product: s.product,
      color: s.color,
      tss: timeToSteadyState(s.halfLifeH),
    }))

    // Ratio AUC (item 285)
    const ratios = aucRatios(data.series.filter((s) => !hidden.has(s.product)))
    const aucEntries = Object.entries(ratios).sort((a, b) => b[1] - a[1])

    // Per-product metrics (286, 288, 290, 293)
    const perProduct = data.series.map((s) => {
      const doses = byProduct.get(s.product) ?? []
      const halfMs = s.halfLifeH * H_MS
      const cv = dosingRegularityCV(doses)
      const cvLabel = cv == null ? null
        : cv < 15 ? { label: 'Regular', color: 'var(--success)' }
        : cv < 30 ? { label: 'Irregular', color: 'var(--warning)' }
        : { label: 'Muy irregular', color: 'var(--error)' }

      // Intervalo objetivo del protocolo (horas) si existe
      let targetIntervalH: number | undefined
      const proto = state.protocols?.[s.product]
      if (proto) {
        // cadencia del protocolo: diaria→24h, semanal→168h, etc.
        const cat = PEPTIDES[s.product]?.cat
        const t = PEPTIDES[s.product]?.type
        if (t === 'diaria') targetIntervalH = 24
        else if (t === 'semanal') targetIntervalH = 168
        else if (t === 'lv') targetIntervalH = 48 // lunes/viernes ~ 3.5d promedio
        else if (cat === 'Metabolismo' && s.halfLifeH >= 24) targetIntervalH = 168
      }

      const intervals = doseIntervals(doses)
      const hint = aucStabilityHint(doses, halfMs)

      // Fluctuación (GLP-1)
      let fi: number | null = null
      const isGlp1 = PEPTIDES[s.product]?.cat === 'Metabolismo' && s.halfLifeH >= 24
      if (isGlp1 && doses.length >= 2) {
        fi = fluctuationIndex(doses as { product: string; value: number; ts: number }[], halfMs, targetIntervalH ? targetIntervalH * H_MS : 168 * H_MS)
      }

      // Acumulación (item 279)
      const accum = hasAccumulation(doses as { product: string; value: number; ts: number }[], halfMs)

      // nextDoseWindow por producto (item 377)
      const ndw = nextDoseWindow(doses as { product: string; value: number; ts: number }[], halfMs, 0.25)

      return { product: s.product, color: s.color, halfLifeH: s.halfLifeH, cv, cvLabel, intervals, targetIntervalH, hint, fi, isGlp1, accum, ndw }
    })

    // Co-presencia (item 283)
    const coPres = coPresenceWindows(
      data.series.map((s) => ({ product: s.product, peakMg: s.peakMg })),
      now,
      byProduct as Map<string, { product: string; value: number; ts: number }[]>,
    )

    return { tssItems, ratios, aucEntries, perProduct, coPres }
  }, [showAdvanced, data.series, state, hidden, now])

  // ── item 279: badge de acumulación en la leyenda ──
  const accumProducts = useMemo(() => {
    const byProduct = collectDosesByProduct(state)
    const set = new Set<string>()
    for (const s of data.series) {
      const doses = byProduct.get(s.product) ?? []
      const halfMs = s.halfLifeH * H_MS
      if (hasAccumulation(doses as { product: string; value: number; ts: number }[], halfMs)) {
        set.add(s.product)
      }
    }
    return set
  }, [data.series, state])

  // ── item 377: próxima dosis (nextDoseWindow global) ──
  const nextDoseWindowTs = useMemo(() => {
    const byProduct = collectDosesByProduct(state)
    let earliest: number | null = null
    for (const s of data.series) {
      const doses = byProduct.get(s.product) ?? []
      const halfMs = s.halfLifeH * H_MS
      const ndw = nextDoseWindow(doses as { product: string; value: number; ts: number }[], halfMs, 0.25)
      if (ndw != null && (earliest == null || ndw < earliest)) earliest = ndw
    }
    return earliest
  }, [data.series, state])

  // ── Estado vacío: sin ninguna dosis registrada ──
  if (!data.hasAnyDose) {
    return (
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16, textAlign: 'center', padding: '28px 20px' }}>
        <div className="body" style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>
          Sin dosis registradas aún
        </div>
        <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 16 }}>
          Registra tu primera dosis y aquí verás cuánto sigue activo en tu cuerpo con el tiempo.
        </div>
        <button className="btn btn-brand" style={{ width: 'auto', padding: '0 18px' }} onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}>
          Registrar dosis
        </button>
      </motion.div>
    )
  }

  // Hay dosis pero ninguna serie graficable: o todo es no-graficable (NAD+), o nada tiene
  // presencia relevante en esta ventana (p.ej. péptidos cortos inyectados hace días, ya decaídos).
  if (data.series.length === 0) {
    const noHalfLife = data.skipped.length > 0
    return (
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16, padding: 20 }}>
        <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Vida del péptido en el cuerpo</div>
        <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 8, marginBottom: 12, lineHeight: 1.4 }}>
          {noHalfLife
            ? 'Estos productos no grafican una curva de decaimiento, pero aquí tienes su contexto:'
            : 'Ningún producto tiene presencia relevante en esta ventana. Amplía el rango o registra una dosis reciente.'}
        </div>
        {noteProducts.length > 0 && notesBlock}
        {!noHalfLife && win !== '7d' && (
          <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '0 14px', marginTop: 12 }} onClick={() => setWin('7d')}>
            Ver 7 días
          </button>
        )}
        <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Estimación educativa. No es consejo médico ni recomendación de dosis.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate">
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16, padding: 20 }}>
        {/* Cabecera */}
        <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Vida del péptido en el cuerpo</div>
        <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2, marginBottom: 14 }}>
          Estimado de cuánto sigue activo después de cada dosis{' '}
          <span style={{ color: 'var(--ink-300)' }}>(dosis-equivalente residual, no concentración plasmática)</span>
        </div>

        {/* Controles: ventana + escala */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Segmented<Win>
              value={win}
              onChange={setWin}
              options={[{ value: '24h', label: '24 h' }, { value: '72h', label: '72 h' }, { value: '7d', label: '7 d' }]}
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[{ value: 'percent', label: '% pico' }, { value: 'absolute', label: 'mg' }]}
            />
          </div>
          {nextDose && (
            <button
              className="chip"
              style={{ background: showNextDose ? 'var(--brand-100)' : undefined, color: showNextDose ? 'var(--brand-700)' : undefined }}
              onClick={() => setShowNextDose((v) => !v)}
            >
              Próxima dosis
            </button>
          )}
          {hasGlp1 && (
            <button
              className="chip"
              style={{ background: showWeight ? 'var(--brand-100)' : undefined, color: showWeight ? 'var(--brand-700)' : undefined }}
              onClick={() => setShowWeight((v) => !v)}
            >
              Mostrar peso
            </button>
          )}
          {/* n°418: KPI overlay selector */}
          {kpiHistoryOptions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span className="xs" style={{ color: 'var(--ink-300)', fontSize: 11, flexShrink: 0 }}>KPI:</span>
              {kpiHistoryOptions.slice(0, 4).map((k) => (
                <button
                  key={k}
                  className="chip"
                  style={{ fontSize: 11, background: kpiOverlay === k ? 'var(--brand-100)' : undefined, color: kpiOverlay === k ? 'var(--brand-700)' : undefined }}
                  onClick={() => setKpiOverlay((prev) => prev === k ? null : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mini-nota eje Y en modo mg */}
        {mode === 'absolute' && (
          <div className="sm" style={{ color: 'var(--ink-300)', marginBottom: 8, lineHeight: 1.4 }}>
            Eje Y en mg · dosis-equivalente residual (no concentración plasmática)
          </div>
        )}

        {/* item 377 — pill "Próxima dosis en ~X h" */}
        <AnimatePresence>
          {nextDoseWindowTs != null && nextDoseWindowTs > now && (
            <NextDosePill key="ndw-pill" nextTs={nextDoseWindowTs} now={now} />
          )}
        </AnimatePresence>

        {/* Chart */}
        {visible.length > 0 ? (
          <>
            {/* n°500: a11y wrapper with role="img" + aria-label describing the PK curve */}
            <div
              ref={chartRef}
              role="img"
              aria-label={`Curva PK para ${visible.map((s) => s.product).join(', ')} en ventana ${win}. ${srTableRows.map((r) => `${r.product}: pico ${r.peak}, presencia actual ${r.current}, t-max ${r.tMax}`).join('; ')}.`}
              style={{ marginTop: 10, position: 'relative' }}
            >
              <MultiLineChart
                series={visible.map((s) => ({ ...s, dashed: s.isEstimatedOnly, halfLifeH: s.halfLifeH }))}
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
                          tooltip: 'En este punto queda el 25 % del pico estimado. Se usa como referencia educativa de ventana de re-dosificación.',
                        },
                        {
                          y: 50,
                          label: 't½',
                          tooltip: 'En este punto queda el 50 % del pico — una vida media transcurrida. Estimación educativa, no nivel en sangre.',
                        },
                      ]
                    : []
                }
                verticalRefs={[
                  ...(showNextDose && nextDose && nextDose.date.getTime() >= data.domainX[0] && nextDose.date.getTime() <= data.domainX[1]
                    ? [{ t: nextDose.date.getTime(), label: `próxima · ${nextDose.product}`, color: 'var(--brand-700)' }]
                    : []),
                  // item 276 — líneas verticales de cruce al 25%
                  ...threshold25Refs,
                ]}
                secondarySeries={weightOverlay ?? undefined}
                showSecondaryAxis={!!weightOverlay}
                domainY2={weightOverlay?.domainY2}
                // item 280 — zona de washout sombreada
                shadeFrom={washoutShadingTs}
              />

              {/* n°418: KPI markers overlay — triangular points above chart */}
              {kpiOverlay && kpiPoints.length > 0 && (
                <div
                  aria-hidden
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}
                >
                  {kpiPoints.map((pt, i) => {
                    const [xMin, xMax] = data.domainX
                    const xPct = xMax > xMin ? ((pt.ts - xMin) / (xMax - xMin)) * 100 : 50
                    if (xPct < 0 || xPct > 100) return null
                    return (
                      <button
                        key={i}
                        aria-label={`${kpiOverlay}: ${pt.value}`}
                        onClick={() => setKpiTipIdx((prev) => prev === i ? null : i)}
                        style={{
                          position: 'absolute',
                          left: `${xPct}%`,
                          top: '10%',
                          transform: 'translateX(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          zIndex: 10,
                          pointerEvents: 'auto',
                        }}
                      >
                        {/* Triangle marker */}
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="var(--success)" style={{ display: 'block' }}>
                          <polygon points="6,0 12,10 0,10" />
                        </svg>
                        {kpiTipIdx === i && (
                          <div style={{
                            position: 'absolute',
                            bottom: '120%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'var(--ink-900)',
                            color: 'var(--surface)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            boxShadow: 'var(--e2)',
                          }}>
                            {kpiOverlay}: {pt.value}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* n°500: sr-only data table — screen reader alternative */}
            <table style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }} aria-label={`Datos de la curva PK — ${win}`}>
              <thead>
                <tr><th>Producto</th><th>Pico estimado</th><th>Presencia actual</th><th>T-máx relativo</th></tr>
              </thead>
              <tbody>
                {srTableRows.map((r) => (
                  <tr key={r.product}>
                    <td>{r.product}</td><td>{r.peak}</td><td>{r.current}</td><td>{r.tMax}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {showWeight && hasGlp1 && (
              <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 8 }}>
                Observacional — no implica causalidad entre la dosis y el cambio de peso.
              </p>
            )}
          </>
        ) : (
          <div className="sm" style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '40px 0' }}>
            <EyeOffIcon />
            Toca un producto abajo para mostrar su curva.
          </div>
        )}

        {/* Leyenda: chips con mg presentes ahora + toggle de serie + badge acumulación (item 279) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {data.series.map((s) => {
            const off = hidden.has(s.product)
            const displayName = s.isEstimatedOnly ? `~${s.product}` : s.product
            const isAccum = accumProducts.has(s.product)
            return (
              <motion.button
                key={s.product}
                type="button"
                onClick={() => toggle(s.product)}
                aria-pressed={!off}
                aria-label={`${s.product}: ${fmtApproxMg(s.currentMg)} ahora`}
                whileTap={{ scale: 0.93 }}
                animate={{ opacity: off ? 0.45 : 1 }}
                transition={{ duration: 0.15 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '6px 12px',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'var(--ink-100)',
                  border: `1.5px solid ${s.color}`,
                  position: 'relative',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 999, background: off ? 'var(--ink-300)' : s.color, flexShrink: 0 }} />
                <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 500 }}>
                  {displayName}
                  {s.isEstimatedOnly && (
                    <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 400 }}> (estimación)</span>
                  )}
                </span>
                <span className="sm mono" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>
                  {formatHalfLife(s.halfLifeH)}
                </span>
                <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{fmtApproxMg(s.currentMg)}</span>
                {/* item 279 — badge acumulación */}
                {isAccum && !off && (
                  <span style={{
                    fontSize: 8,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: 'var(--warning)',
                    background: 'var(--surface)',
                    border: '1px solid var(--warning)',
                    borderRadius: 999,
                    padding: '0 5px',
                    lineHeight: '14px',
                    flexShrink: 0,
                  }}>
                    ×2 acum.
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* Exposición acumulada (AUC) en la ventana — barras relativas por producto */}
        {(() => {
          const withAuc = visible.filter((s) => s.aucMgH > 0)
          if (withAuc.length === 0) return null
          const maxAuc = Math.max(...withAuc.map((s) => s.aucMgH))
          const fmtAuc = (v: number) => (v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v)))
          return (
            <div>
              <div className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-400)', marginBottom: 8 }}>
                Exposición acumulada <span style={{ color: 'var(--ink-300)' }}>· en esta ventana</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {withAuc.map((s, i) => (
                  <div key={s.product} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="sm" style={{ width: 92, flexShrink: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}
                        style={{ width: `${(s.aucMgH / maxAuc) * 100}%`, height: '100%', background: s.color, borderRadius: 999, transformOrigin: 'left center' }}
                      />
                    </div>
                    <span className="sm mono" style={{ width: 76, textAlign: 'right', flexShrink: 0, color: 'var(--ink-900)', fontWeight: 600 }}>{fmtAuc(s.aucMgH)} mg·h</span>
                  </div>
                ))}
              </div>
              <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 8, lineHeight: 1.4 }}>
                Estimación teórica de exposición (área bajo la curva), no un nivel en sangre.
              </div>
            </div>
          )
        })()}

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* ── PANEL COLAPSABLE: Análisis avanzado (educativo) ─── items 287/285/286/288/290/293/283 */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
            aria-expanded={showAdvanced}
          >
            <motion.span
              animate={{ rotate: showAdvanced ? 90 : 0 }}
              transition={{ duration: dur.fast }}
              style={{ display: 'inline-block', fontSize: 12, color: 'var(--ink-400)' }}
            >
              ▶
            </motion.span>
            <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600 }}>
              Análisis avanzado <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>(educativo)</span>
            </span>
          </button>

          <AnimatePresence>
            {showAdvanced && advancedMetrics && (
              <motion.div
                key="advanced-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: dur.base, ease: ease.standard }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* item 287 — Tss (tiempo a steady-state) */}
                  {advancedMetrics.tssItems.length > 0 && (
                    <div>
                      <div className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Tiempo a steady-state (Tss)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {advancedMetrics.tssItems.map((it) => (
                          <div key={it.product} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: it.color, flexShrink: 0 }} />
                            <span className="sm" style={{ color: 'var(--ink-700)', flex: 1 }}>{it.product}</span>
                            <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>{it.tss}</span>
                          </div>
                        ))}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 6, lineHeight: 1.4, fontSize: 10 }}>
                        Regla estándar: ≈ 5 vidas medias con dosis repetidas a intervalo regular. Estimación educativa.
                      </div>
                    </div>
                  )}

                  {/* item 285 — Ratio AUC inter-producto */}
                  {advancedMetrics.aucEntries.length >= 2 && (
                    <div>
                      <div className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Balance de exposición (ratio AUC)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {advancedMetrics.aucEntries.map(([prod, frac]) => {
                          const s = data.series.find((x) => x.product === prod)
                          const color = s?.color ?? 'var(--brand-700)'
                          return (
                            <div key={prod} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                              <span className="sm" style={{ color: 'var(--ink-700)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod}</span>
                              <div style={{ width: 60, height: 5, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ width: `${frac * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
                              </div>
                              <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 600, width: 32, textAlign: 'right', flexShrink: 0 }}>
                                {Math.round(frac * 100)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 6, lineHeight: 1.4, fontSize: 10 }}>
                        Fracción del AUC total en esta ventana. No compara eficacia entre productos.
                      </div>
                    </div>
                  )}

                  {/* items 286/288/290/293 — métricas por producto */}
                  {advancedMetrics.perProduct.filter((p) => p.cv != null || p.intervals.length >= 2 || p.fi != null).map((p) => (
                    <div key={p.product} style={{ background: 'var(--surface)', borderRadius: 'var(--r-sm)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color, flexShrink: 0 }} />
                        <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{p.product}</span>
                        <span className="sm mono" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>{formatHalfLife(p.halfLifeH)}</span>
                      </div>

                      {/* item 286 — regularidad CV% */}
                      {p.cv != null && p.cvLabel && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="sm" style={{ color: 'var(--ink-400)', flex: 1 }}>Regularidad</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: p.cvLabel.color,
                            background: 'var(--card)', borderRadius: 999, padding: '1px 8px', border: `1px solid ${p.cvLabel.color}`,
                          }}>
                            {p.cvLabel.label} · CV {p.cv.toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {/* item 288 — índice de fluctuación (solo GLP-1) */}
                      {p.fi != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="sm" style={{ color: 'var(--ink-400)', flex: 1 }}>Fluctuación pico-valle</span>
                          <span className="sm mono" style={{ color: 'var(--ink-700)', fontWeight: 600 }}>
                            {p.fi < 0.3 ? 'baja' : p.fi < 0.7 ? 'media' : 'alta'} ({p.fi.toFixed(2)})
                          </span>
                        </div>
                      )}

                      {/* item 290 — histograma de intervalos */}
                      {p.intervals.length >= 2 && (
                        <div>
                          <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 4 }}>
                            Intervalos entre dosis ({p.intervals.length} intervalo{p.intervals.length !== 1 ? 's' : ''})
                          </div>
                          <IntervalHistogram
                            intervalsH={p.intervals}
                            targetH={p.targetIntervalH}
                            color={p.color}
                          />
                        </div>
                      )}

                      {/* item 293 — nota de estabilidad AUC */}
                      {p.hint && (
                        <div className="sm" style={{ color: 'var(--ink-400)', lineHeight: 1.4, fontSize: 10, borderLeft: `2px solid ${p.color}`, paddingLeft: 7 }}>
                          {p.hint}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* item 283 — Co-presencia entre péptidos activos */}
                  {advancedMetrics.coPres.length > 0 && (
                    <div>
                      <div className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Solapamiento activo (co-presencia)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {advancedMetrics.coPres.slice(0, 6).map((c, i) => {
                          const colorA = data.series.find((s) => s.product === c.productA)?.color ?? 'var(--ink-400)'
                          const colorB = data.series.find((s) => s.product === c.productB)?.color ?? 'var(--ink-400)'
                          const durH = c.durationH
                          const durLabel = durH < 2 ? `${Math.round(durH * 60)} min` : durH < 48 ? `${durH.toFixed(1)} h` : `${(durH / 24).toFixed(1)} d`
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: colorA, flexShrink: 0 }} />
                              <span style={{ color: 'var(--ink-700)', fontWeight: 500, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productA}</span>
                              <span style={{ color: 'var(--ink-300)' }}>+</span>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: colorB, flexShrink: 0 }} />
                              <span style={{ color: 'var(--ink-700)', fontWeight: 500, flex: 1, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productB}</span>
                              <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 600, flexShrink: 0 }}>{durLabel}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 8, lineHeight: 1.4, fontSize: 10 }}>
                        Horas con ambos productos ≥ 2 % del pico estimado. No implica interacción farmacológica.
                      </div>
                    </div>
                  )}

                  {/* Disclaimer global del panel */}
                  <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 0 }}>
                    Todas las métricas son estimaciones educativas basadas en modelos de primer orden y vidas medias de literatura. No representan farmacocinética individual ni son consejo médico.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* Notas educativas POR PRODUCTO — solo del producto activo al que aplican */}
        {noteProducts.length > 0 && notesBlock}

        {/* Disclaimer de cumplimiento */}
        <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          Estimación educativa basada en vidas medias aproximadas de la literatura científica. No representa tu
          farmacocinética individual, no es consejo médico ni recomendación de dosis.
        </p>
      </motion.div>
    </motion.div>
  )
}
