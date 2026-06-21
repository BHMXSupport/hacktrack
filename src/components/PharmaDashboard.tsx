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
  thresholdCrossTs,
  washoutMs,
  hasAccumulation,
} from '../lib/pharma'
import { CATEGORY_COLOR, PEPTIDES } from '../lib/catalog'
import { upcomingDoses } from '../lib/calendar'
import { MultiLineChart } from './MultiLineChart'
import { Segmented } from './controls'
import { IntervalHistogram, NextDosePill, PharmaAdvancedPanel } from './PharmaDashboardParts'
import { staggerParent, staggerItem } from '../lib/motion'

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

// IntervalHistogram + NextDosePill → ./PharmaDashboardParts ; hasAccumulation → ../lib/pharma (split)

export function PharmaDashboard() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [win, setWin] = useState<Win>('7d')
  const [mode, setMode] = useState<Mode>('percent')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showNextDose, setShowNextDose] = useState(true)
  const [showWeight, setShowWeight] = useState(false)
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

  // Dosis por producto: una sola vez (antes se recalculaba en 4 memos distintos). collectDosesByProduct
  // solo lee state.log, así que se memoiza con esa dependencia y los demás memos lo consumen.
  const byProduct = useMemo(() => collectDosesByProduct(state), [state.log])

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
    const s = withHalf[0]
    const halfMs = (HALF_LIFE_H[s.product] ?? 0) * H_MS
    const doses = byProduct.get(s.product)
    if (!doses || !doses.length) return undefined
    const lastDoseTs = Math.max(...doses.map((d) => d.ts))
    return lastDoseTs + washoutMs(HALF_LIFE_H[s.product] ?? 0)
  }, [data.series, hidden, state])

  // ── n°418: KPI overlay — opciones y puntos ──
  // Excluye 'Altura' (estática) y solo ofrece KPIs con AL MENOS un dato dentro de la ventana del chart,
  // si no, se elegían KPIs que no mostraban nada en la curva ("no se registran bien").
  const kpiHistoryOptions = useMemo(
    () => Object.keys(state.history).filter((k) =>
      k !== 'Altura' && (state.history[k] ?? []).some((s) => s.ts >= data.domainX[0] && s.ts <= data.domainX[1]),
    ),
    [state.history, data.domainX],
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

  // ── Análisis avanzado (panel siempre visible) ──
  const advancedMetrics = useMemo(() => {
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
        : cv < 15 ? { label: 'Regular', color: 'var(--success-ink)' }
        : cv < 30 ? { label: 'Irregular', color: 'var(--warning-ink)' }
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

      return { product: s.product, color: s.color, halfLifeH: s.halfLifeH, cv, cvLabel, intervals, targetIntervalH, hint, fi, isGlp1, accum }
    })

    // Co-presencia (item 283)
    const coPres = coPresenceWindows(
      data.series.map((s) => ({ product: s.product, peakMg: s.peakMg })),
      now,
      byProduct as Map<string, { product: string; value: number; ts: number }[]>,
    )

    return { tssItems, ratios, aucEntries, perProduct, coPres }
  }, [data.series, state, hidden, now])

  // ── item 279: badge de acumulación en la leyenda ──
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
          Estimado de cuánto sigue activo tras cada dosis
        </div>

        {/* Controles primarios: solo ventana + escala (los secundarios van detrás de "Más opciones") */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Segmented<Win>
              value={win}
              onChange={setWin}
              options={[{ value: '24h', label: '24 h' }, { value: '72h', label: '72 h' }, { value: '7d', label: '7 d' }]}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[{ value: 'percent', label: '% pico' }, { value: 'absolute', label: 'mg' }]}
            />
          </div>
        </div>

        {/* Controles secundarios — siempre visibles (disclosure retirado: el contenido queda abierto) */}
        {(nextDose || hasGlp1 || kpiHistoryOptions.length > 0) && (
          <div style={{ marginBottom: 14 }}>
            <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600 }}>Opciones de gráfica</span>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, alignItems: 'flex-start' }}>
              {nextDose && (
                <button
                  className="chip"
                  style={{ maxWidth: '100%', background: showNextDose ? 'var(--brand-100)' : undefined, color: showNextDose ? 'var(--brand-700)' : undefined }}
                  onClick={() => setShowNextDose((v) => !v)}
                >
                  Próxima dosis
                </button>
              )}
              {hasGlp1 && (
                <button
                  className="chip"
                  style={{ maxWidth: '100%', background: showWeight ? 'var(--brand-100)' : undefined, color: showWeight ? 'var(--brand-700)' : undefined }}
                  onClick={() => setShowWeight((v) => !v)}
                >
                  Mostrar peso
                </button>
              )}
              {/* n°418: KPI overlay selector — ocupa su propia línea para no competir por ancho */}
              {kpiHistoryOptions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flexBasis: '100%', minWidth: 0 }}>
                  <span className="sm" style={{ color: 'var(--ink-300)', fontSize: 11, flexShrink: 0 }}>KPI:</span>
                  {kpiHistoryOptions.slice(0, 4).map((k) => (
                    <button
                      key={k}
                      className="chip"
                      style={{
                        fontSize: 11, maxWidth: '100%', minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        background: kpiOverlay === k ? 'var(--brand-100)' : undefined,
                        color: kpiOverlay === k ? 'var(--brand-700)' : undefined,
                      }}
                      onClick={() => setKpiOverlay((prev) => prev === k ? null : k)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mini-nota eje Y en modo mg */}
        {mode === 'absolute' && (
          <div className="sm" style={{ color: 'var(--ink-300)', marginBottom: 8, lineHeight: 1.4 }}>
            Eje Y en mg · dosis-equivalente residual (no concentración plasmática)
          </div>
        )}

        {/* pill "Próxima dosis en ~X" — usa la dosis PROGRAMADA (cadencia), igual que la línea de
            referencia del gráfico. (Antes usaba la ventana PK del 25% agregada entre productos, lo que
            daba "~0 min" en cuanto cualquier producto corto estaba ya por debajo del umbral.) */}
        <AnimatePresence>
          {nextDose && nextDose.date.getTime() > now && (
            <NextDosePill key="ndw-pill" nextTs={nextDose.date.getTime()} now={now} />
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
                          tooltip: 'En este punto queda el 25 % del pico estimado. Es solo un dato educativo — la cadencia la defines tú o tu profesional de salud.',
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
                          // marcador permanente con z bajo para no pisar la línea/etiqueta "ahora";
                          // sube de capa solo cuando su tooltip está abierto
                          zIndex: kpiTipIdx === i ? 12 : 4,
                          pointerEvents: 'auto',
                        }}
                      >
                        {/* Triangle marker — opacidad reducida para no tapar la curva ni "ahora" */}
                        <svg width="11" height="9" viewBox="0 0 12 10" fill="var(--success)" opacity={0.7} style={{ display: 'block' }}>
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
                            maxWidth: 160,
                            width: 'max-content',
                            textAlign: 'center',
                            lineHeight: 1.3,
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

            {/* n°500: sr-only data table — screen reader alternative.
                clip-path + 1px box (sin left:-9999) para no generar scroll horizontal fantasma. */}
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

        {/* Leyenda: chips con mg presentes ahora + toggle de serie + badge acumulación (item 279).
            Línea 1: dot + nombre (encoge con ellipsis) + mg actual.
            Línea 2: t½ + marca de estimación + badge acumulación (detalle secundario, envuelve). */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, minWidth: 0 }}>
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
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                  minHeight: 40, padding: '6px 12px', maxWidth: '100%', minWidth: 0,
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'var(--ink-100)',
                  border: `1.5px solid ${s.color}`,
                  position: 'relative',
                }}
              >
                {/* Línea 1: dot + nombre + mg */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, maxWidth: '100%', minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: off ? 'var(--ink-300)' : s.color, flexShrink: 0 }} />
                  <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 600, flexShrink: 0 }}>{fmtApproxMg(s.currentMg)}</span>
                </span>
                {/* Línea 2: detalle secundario (t½ · estimación · acumulación) — envuelve, no fuerza ancho */}
                {(s.halfLifeH > 0 || s.isEstimatedOnly || (isAccum && !off)) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', maxWidth: '100%', minWidth: 0, paddingLeft: 17 }}>
                    {s.halfLifeH > 0 && (
                      <span className="sm mono" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>
                        {formatHalfLife(s.halfLifeH)}
                      </span>
                    )}
                    {s.isEstimatedOnly && (
                      <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>estimación</span>
                    )}
                    {/* item 279 — badge acumulación */}
                    {isAccum && !off && (
                      <span style={{
                        fontSize: 8,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: 'var(--warning-ink)',
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
                  <div key={s.product} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="sm" style={{ width: 84, flexShrink: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product}</span>
                    <div style={{ flex: 1, minWidth: 32, height: 6, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}
                        style={{ width: `${(s.aucMgH / maxAuc) * 100}%`, height: '100%', background: s.color, borderRadius: 999, transformOrigin: 'left center' }}
                      />
                    </div>
                    <span className="sm mono" style={{ minWidth: 88, textAlign: 'right', flexShrink: 0, color: 'var(--ink-900)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtAuc(s.aucMgH)} mg·h</span>
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

        {/* ── PANEL: Análisis avanzado (educativo) — siempre visible (disclosure retirado) — items 287/285/286/288/290/293/283 */}
        <div>
          <span className="sm" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-700)', fontWeight: 600 }}>
            Análisis avanzado <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>(educativo)</span>
          </span>

          {advancedMetrics && (
            <PharmaAdvancedPanel advancedMetrics={advancedMetrics} series={data.series} />
          )}
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
