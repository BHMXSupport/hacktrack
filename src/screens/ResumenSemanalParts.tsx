// ResumenSemanalParts — componentes de nivel-módulo extraídos de ResumenSemanal.tsx.
// Dependencia unidireccional: ResumenSemanal → ResumenSemanalParts → lib.
// No importa nada de ResumenSemanal.tsx.
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Glyph } from '../components/glyphs'
import { useApp, isoKey, adherenceMonth } from '../lib/store'
import {
  weightProjection, kcalSeries, productKpis, dayMacros, protocolList,
  litersFromMl, waterGoalLiters,
} from '../lib/nutrition'
import { Sparkline, TrendChart, MacroBar, ConsistencyHeatmap, R2Chip, movingAverage } from '../components/charts'
import { EmptyState } from '../components/EmptyState'
import { staggerParent, staggerItem, dur, ease } from '../lib/motion'
import { dayStatusEx } from '../lib/calendar'
import { WDS, MEASURES_BY, MEASURE_META, PEPTIDES } from '../lib/catalog'

// Constante compartida (usada por TrendsCard y por ResumenSemanal)
export const DAY = 86_400_000

// ── R² helper (interno, expuesto vía R2Chip en TrendChart) ──
export function calcR2(data: number[]): number {
  const n = data.length
  if (n < 3) return 0
  const mean = data.reduce((a, b) => a + b, 0) / n
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) { sx += i; sy += data[i]; sxx += i * i; sxy += i * data[i] }
  const den = n * sxx - sx * sx
  if (!den) return 0
  const sl = (n * sxy - sx * sy) / den
  const ic = (sy - sl * sx) / n
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < n; i++) {
    ssTot += (data[i] - mean) ** 2
    ssRes += (data[i] - (ic + sl * i)) ** 2
  }
  return ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1
}

// ── Accordion: agrupa el segundo nivel de Perspectivas Plus ──
export function Accordion({ title, subtitle, defaultOpen = false, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <motion.div variants={staggerItem}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          padding: '4px 0',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h2" style={{ color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <span style={{
          display: 'inline-block', color: 'var(--ink-300)', fontSize: 12, lineHeight: 1, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease',
        }}>▼</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur.base, ease: ease.decelerate }}
            style={{ overflow: 'hidden' }}
          >
            {/* Re-establece la propagación de variantes: el motion.div de arriba anima height/opacity
                con objetos explícitos, lo que cortaba el cascade y dejaba las Card hijas (staggerItem)
                en su estado initial (opacity:0) → invisibles. Este wrapper las vuelve a animar a visible. */}
            <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div variants={staggerItem} className="card">
      <div className="h2" style={{ color: 'var(--ink-900)' }}>{title}</div>
      {subtitle && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>{subtitle}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </motion.div>
  )
}

export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

// ── ProgressBar reutilizable ──
export function ProgressBar({ pct, color = 'var(--brand-700)' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 6, background: 'var(--ink-100)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 'var(--r-sm)', transition: 'width 0.3s ease' }} />
    </div>
  )
}

// ── WellnessRing: score 0–100 animado ──
export function WellnessRing({ score }: { score: number }) {
  const R = 30, CX = 36, CY = 36, SW = 7
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * C
  const col = pct >= 70 ? 'var(--success)' : pct >= 45 ? 'var(--brand-500)' : 'var(--warning)'
  return (
    <svg width={72} height={72} aria-label={`Score de semana: ${score} puntos`}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--ink-100)" strokeWidth={SW} />
      <motion.circle
        cx={CX} cy={CY} r={R} fill="none"
        stroke={col} strokeWidth={SW}
        strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C - dash }}
        transition={{ duration: dur.draw, ease: ease.decelerate }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
      />
      <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={14} fontFamily="JetBrains Mono" fontWeight={800} fill={col}>{pct}</text>
    </svg>
  )
}

// ── ComparativaCard: antes vs durante el protocolo por producto ──
export function ComparativaCard() {
  const { state } = useApp()
  const protos = protocolList(state)
  if (protos.length === 0) return null

  return (
    <>
      {protos.map((pr) => {
        const measures = (MEASURES_BY[pr.cat] ?? MEASURES_BY['Explorar']).slice(0, 4)
        const rows = measures.map((m) => {
          const meta = MEASURE_META[m]
          const allPts = [...(state.history[m] ?? [])].sort((a, b) => a.ts - b.ts)
          const before = allPts.filter((p) => p.ts < pr.startDate)
          const beforeVal = before.length ? before[before.length - 1].value : null
          const during = allPts.filter((p) => p.ts >= pr.startDate)
          const duringVal = during.length ? during[during.length - 1].value : null
          const delta = beforeVal != null && duringVal != null
            ? Math.round((duringVal - beforeVal) * 10) / 10
            : null
          const unit = meta?.kind === 'num' ? (meta.unit ? ` ${meta.unit}` : '') : meta?.max ? `/${meta.max}` : ''
          const down = !!meta?.down
          return { m, beforeVal, duringVal, delta, unit, down }
        }).filter((r) => r.beforeVal != null || r.duringVal != null)

        if (rows.length === 0) return null

        return (
          <motion.div key={pr.product + '-comp'} variants={staggerItem} className="card">
            <div className="h2" style={{ color: 'var(--ink-900)' }}>Antes vs durante — {pr.product}</div>
            <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2, marginBottom: 12 }}>
              Observacional — registros personales antes y desde el inicio del protocolo.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 78px 78px 64px', gap: 6, marginBottom: 6 }}>
              <span className="sm" style={{ color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Medida</span>
              <span className="sm" style={{ color: 'var(--ink-400)', textAlign: 'right' }}>Antes</span>
              <span className="sm" style={{ color: 'var(--ink-400)', textAlign: 'right' }}>Durante</span>
              <span className="sm" style={{ color: 'var(--ink-400)', textAlign: 'right' }}>Δ</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(({ m, beforeVal, duringVal, delta, unit, down }) => {
                const good = delta != null && delta !== 0 && ((down && delta < 0) || (!down && delta > 0))
                const bad = delta != null && delta !== 0 && !good
                const col = good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-400)'
                return (
                  <div key={m} style={{ display: 'grid', gridTemplateColumns: '1fr 78px 78px 64px', gap: 6, alignItems: 'center' }}>
                    <span className="sm" style={{ color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
                    <span className="mono sm" style={{ textAlign: 'right', color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {beforeVal != null ? `${beforeVal}${unit}` : '—'}
                    </span>
                    <span className="mono sm" style={{ textAlign: 'right', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {duringVal != null ? `${duringVal}${unit}` : '—'}
                    </span>
                    <span className="mono sm" style={{ textAlign: 'right', color: col, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {delta != null ? `${delta > 0 ? '+' : ''}${delta}${unit.startsWith('/') ? '' : unit}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )
      })}
    </>
  )
}

// ── StreakWeekCard: racha de la semana con mini-timeline 7 días ──
export function StreakWeekCard() {
  const { state } = useApp()
  const now = new Date(state.todayTs)

  const todayWdsIdx = (() => {
    const wd = now.getDay()
    const idx = WDS.findIndex(([, d]) => d === wd)
    return idx >= 0 ? idx : 6
  })()

  const days = WDS.map(([label], idx) => {
    const offset = idx - todayWdsIdx
    const d = new Date(now)
    d.setDate(now.getDate() + offset)
    const status = offset <= 0 ? dayStatusEx(state, d, now) : 'future' as const
    return { label, status, isFuture: offset > 0 }
  })

  let best = 0, cur = 0
  for (const day of days) {
    if (day.status === 'taken') { cur++; best = Math.max(best, cur) }
    else if (day.status === 'missed') cur = 0
  }

  const protos = protocolList(state)

  return (
    <motion.div variants={staggerItem} className="card">
      <div className="h2" style={{ color: 'var(--ink-900)' }}>Racha de la semana</div>
      <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2, marginBottom: 14 }}>
        Tu mejor racha: <strong style={{ color: 'var(--brand-700)', fontWeight: 700 }}>{best} {best === 1 ? 'día' : 'días'}</strong> consecutivos con dosis
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {days.map(({ label, status, isFuture }, idx) => {
          const color = protos[0]?.color ?? 'var(--brand-700)'
          const bg = status === 'taken'
            ? color
            : status === 'missed'
            ? 'color-mix(in srgb, var(--warning) 35%, transparent)'
            : status === 'rest'
            ? 'var(--ink-100)'
            : isFuture
            ? 'transparent'
            : 'var(--ink-100)'
          const border = status === 'missed'
            ? 'color-mix(in srgb, var(--warning) 60%, transparent)'
            : status === 'taken'
            ? color
            : status === 'rest'
            ? 'var(--ink-200)'
            : 'var(--ink-100)'
          const isToday = idx === todayWdsIdx
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
              <span className="sm" style={{ fontSize: 10, color: isToday ? 'var(--brand-700)' : 'var(--ink-400)', fontWeight: isToday ? 700 : 400 }}>
                {label}
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: bg,
                border: `2px solid ${border}`,
                opacity: isFuture ? 0.3 : 1,
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { col: protos[0]?.color ?? 'var(--brand-700)', label: 'Tomado' },
          { col: 'color-mix(in srgb, var(--warning) 35%, transparent)', label: 'Faltó' },
          { col: 'var(--ink-100)', label: 'Descanso' },
        ].map(({ col, label }) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, border: '1.5px solid var(--border)', flexShrink: 0 }} />
            <span className="sm" style={{ color: 'var(--ink-400)' }}>{label}</span>
          </span>
        ))}
      </div>
    </motion.div>
  )
}

// ── AdherenciaProyeccionCard: proyección mensual de adherencia ──
export function AdherenciaProyeccionCard() {
  const { state } = useApp()
  const now = new Date(state.todayTs)
  const stat = adherenceMonth(state, now)
  if (!stat) return null

  const { taken, due, upcoming, scheduled } = stat
  const projPct = scheduled > 0 ? Math.round(((taken + upcoming) / scheduled) * 100) : 0
  const need80 = Math.max(0, Math.ceil(0.8 * scheduled) - taken)
  const canReach = upcoming >= need80

  let msg: string
  if (projPct >= 80) {
    msg = `¡Vas al ${projPct}%! Llegarás a tu meta si sigues así.`
  } else if (canReach) {
    msg = `Necesitas tomar ${need80} de ${upcoming} dosis restantes para llegar al 80%.`
  } else {
    msg = `Con las dosis que quedan podrías llegar a ${projPct}% — cada toma cuenta.`
  }

  const barColor = projPct >= 80 ? 'var(--success)' : projPct >= 60 ? 'var(--brand-500)' : 'var(--warning)'

  return (
    <motion.div variants={staggerItem} className="card">
      <div className="h2" style={{ color: 'var(--ink-900)' }}>¿Llegaré al 80%?</div>
      <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2, marginBottom: 12 }}>
        Proyección de adherencia este mes
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 28, fontWeight: 800, color: barColor, lineHeight: 1 }}>{projPct}%</span>
        <span className="sm" style={{ color: 'var(--ink-400)' }}>proyectado · meta 80%</span>
      </div>
      {/* tick del 80% anclado DENTRO del ancho de la barra (no se sale ni se monta sobre el texto) */}
      <div style={{ position: 'relative' }}>
        <ProgressBar pct={projPct} color={barColor} />
        <div style={{
          position: 'absolute', left: '80%', top: -3, height: 'calc(100% + 6px)',
          width: 1, background: 'var(--ink-300)',
        }} />
      </div>
      <div className="sm" style={{ color: 'var(--ink-700)', marginTop: 18, lineHeight: 1.45 }}>{msg}</div>
      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 6 }}>
        {taken} tomadas · {due - taken} perdidas · {upcoming} pendientes este mes
      </div>
    </motion.div>
  )
}

// ── Ventana de tiempo para ProductCards ──
export const PROD_WINDOWS = [
  { v: 7, l: '7d' }, { v: 30, l: '30d' }, { v: 0, l: 'Todo' },
] as const

// productKpis con ventana de tiempo (usa MEASURES_BY/MEASURE_META/PEPTIDES ya importados)
export function productKpisWindowed(
  state: Parameters<typeof productKpis>[0],
  product: string,
  windowDays: number,
): ReturnType<typeof productKpis> {
  const proto = state.protocols[product]
  if (!proto) return []
  const startOverride = state.todayTs - windowDays * 86400000
  const startDate = Math.max(proto.startDate, startOverride)
  const cat = PEPTIDES[product]?.cat ?? 'Explorar'
  const measures = (MEASURES_BY[cat] ?? MEASURES_BY['Explorar']).slice(0, 4)
  return measures.map((m: string) => {
    const meta = MEASURE_META[m]
    const allPts = [...(state.history[m] ?? [])].sort((a: { ts: number }, b: { ts: number }) => a.ts - b.ts)
    const series = allPts.filter((p: { ts: number }) => p.ts >= startDate)
    const last = series.length ? series[series.length - 1].value : null
    const delta = series.length >= 2 ? series[series.length - 1].value - series[0].value : null
    const unit = meta?.kind === 'num' ? (meta.unit ? ` ${meta.unit}` : '') : meta?.max ? `/${meta.max}` : ''
    return { measure: m, unit, last, delta: delta != null ? Math.round(delta * 10) / 10 : null, points: series.slice(-8).map((p: { value: number }) => p.value), down: !!meta?.down }
  })
}

// ── Tarjeta PER-PRODUCTO: cada producto con tap-to-expand ──
export function ProductCards() {
  const { state, dispatch } = useApp()
  const protos = protocolList(state)
  const [expandedProto, setExpandedProto] = useState<string | null>(null)
  // ventana de tiempo por producto (0 = protocolo completo)
  const [productWindow, setProductWindow] = useState<Record<string, number>>({})

  if (protos.length === 0) return (
    <motion.div variants={staggerItem} className="card">
      <div className="h2" style={{ color: 'var(--ink-900)' }}>Progreso por producto</div>
      <EmptyState
        glyph="dose"
        title="Sin protocolos activos"
        subtitle="Añade un protocolo para ver tus métricas por producto."
        cta={{ label: '+ Añadir protocolo', onClick: () => dispatch({ t: 'tab', tab: 'protocolo' }) }}
      />
    </motion.div>
  )

  // delta vs. semana anterior por KPI para cada producto
  const allWeeklyDeltas = useMemo(() => {
    const out: Record<string, Record<string, number | null>> = {}
    for (const pr of protos) {
      const kpis = productKpis(state, pr.product)
      const result: Record<string, number | null> = {}
      for (const k of kpis) {
        const series = [...(state.history[k.measure] ?? [])].sort((a, b) => a.ts - b.ts)
        const nowTs = state.todayTs
        const weekAgoTs = nowTs - 7 * 86400000
        const twoWeeksAgoTs = nowTs - 14 * 86400000
        const thisWeek = series.filter((p) => p.ts >= weekAgoTs)
        const prevWeek = series.filter((p) => p.ts >= twoWeeksAgoTs && p.ts < weekAgoTs)
        const thisVal = thisWeek.length ? thisWeek[thisWeek.length - 1].value : null
        const prevVal = prevWeek.length ? prevWeek[prevWeek.length - 1].value : null
        result[k.measure] = thisVal != null && prevVal != null
          ? Math.round((thisVal - prevVal) * 10) / 10
          : null
      }
      out[pr.product] = result
    }
    return out
  }, [protos, state.history, state.todayTs]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {protos.map((pr) => {
        const win = productWindow[pr.product] ?? 0 // default: protocolo completo
        const kpis = win === 0 ? productKpis(state, pr.product) : productKpisWindowed(state, pr.product, win)
        const isExpanded = expandedProto === pr.product
        const primaryKpi = kpis[0]
        const weeklyDeltas = allWeeklyDeltas[pr.product] ?? {}

        // Insight cruzado: pérdida simultánea de músculo y grasa — observacional
        const musKpi = kpis.find((k) => k.measure === '% músculo')
        const grasaKpi = kpis.find((k) => k.measure === '% grasa')
        const muscleFatAlert = musKpi?.delta != null && grasaKpi?.delta != null
          && grasaKpi.delta < -0.3 && musKpi.delta < -0.3

        return (
          <motion.div key={pr.product} variants={staggerItem} className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpandedProto(isExpanded ? null : pr.product)}
          >
            {/* Renglón 1: nombre + categoría + chevron */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', minWidth: 0, flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.product}</span>
              <span className="sm" style={{ background: pr.color + '18', color: pr.color, padding: '2px 9px', borderRadius: 999, fontWeight: 600, flexShrink: 0, maxWidth: '100%' }}>{pr.cat}</span>
              {/* chevron */}
              <span style={{
                display: 'inline-block', color: 'var(--ink-300)', fontSize: 12, lineHeight: 1, flexShrink: 0,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}>▼</span>
            </div>
            {/* Renglón 2: "NN d activo" a la izquierda, selector de ventana a la derecha */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>{pr.daysActive} d activo</span>
              {/* selector de ventana temporal por producto */}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0, marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
                {PROD_WINDOWS.map((w) => (
                  <button key={w.v} onClick={() => setProductWindow((prev) => ({ ...prev, [pr.product]: w.v }))}
                    className="sm"
                    style={{
                      padding: '2px 8px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 10,
                      background: win === w.v ? 'var(--brand-500)' : 'var(--ink-100)',
                      color: win === w.v ? '#fff' : 'var(--ink-400)',
                    }}>
                    {w.l}
                  </button>
                ))}
              </div>
            </div>
            {/* KPI primario siempre visible */}
            {primaryKpi && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="sm" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primaryKpi.measure}</span>
                {primaryKpi.last == null ? (
                  <span className="sm" style={{ color: 'var(--ink-300)', flexShrink: 0 }}>Sin registro</span>
                ) : (
                  <>
                    <span className="mono sm" style={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{primaryKpi.last}<span style={{ color: 'var(--ink-400)' }}>{primaryKpi.unit}</span></span>
                    {primaryKpi.delta != null && (() => {
                      const good = (primaryKpi.down && primaryKpi.delta < 0) || (!primaryKpi.down && primaryKpi.delta > 0)
                      const bad = primaryKpi.delta !== 0 && !good
                      const col = good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-400)'
                      const dUnit = primaryKpi.unit.startsWith('/') ? '' : primaryKpi.unit
                      return <span className="mono sm" style={{ width: 52, textAlign: 'right', color: col, flexShrink: 0 }}>{primaryKpi.delta > 0 ? '+' : ''}{primaryKpi.delta}{dUnit}</span>
                    })()}
                  </>
                )}
              </div>
            )}
            {/* Expanded: todos los KPIs + sparkline */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: dur.base, ease: ease.decelerate }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="sm" style={{ color: 'var(--ink-400)', margin: '6px 0 10px' }}>
                    {win === 0 ? 'Tus lecturas durante este protocolo' : `Últimos ${win} días`}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {kpis.map((k) => {
                      const good = k.delta != null && k.delta !== 0 && ((k.down && k.delta < 0) || (!k.down && k.delta > 0))
                      const bad = k.delta != null && k.delta !== 0 && !good
                      const col = good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-400)'
                      const dUnit = k.unit.startsWith('/') ? '' : k.unit
                      // weekly delta for each KPI
                      const wd = weeklyDeltas[k.measure]
                      const wdGood = wd != null && (k.down ? wd < 0 : wd > 0)
                      return (
                        <div key={k.measure} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span className="sm" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.measure}</span>
                          {k.last == null ? (
                            <span className="sm" style={{ color: 'var(--ink-300)', flexShrink: 0 }}>Sin registro</span>
                          ) : (
                            <>
                              <span className="mono sm" style={{ fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{k.last}<span style={{ color: 'var(--ink-400)' }}>{k.unit}</span></span>
                              {/* deltas agrupados (protocolo · 7d) en un solo bloque que no se parte */}
                              {(k.delta != null || wd != null) && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {k.delta != null && <span className="mono sm" style={{ textAlign: 'right', color: col, whiteSpace: 'nowrap' }}>{k.delta > 0 ? '+' : ''}{k.delta}{dUnit}</span>}
                                  {wd != null && (
                                    <span className="sm" style={{ fontSize: 10, color: wdGood ? 'var(--success)' : 'var(--warning)', whiteSpace: 'nowrap' }}>
                                      {wd > 0 ? '▲' : '▼'}{Math.abs(wd)}{dUnit} 7d
                                    </span>
                                  )}
                                </span>
                              )}
                              {k.points.length >= 2 && (
                                <Sparkline
                                  data={k.points}
                                  color={good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-300)'}
                                  w={90} h={26}
                                  interactive
                                />
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Insight cruzado músculo+grasa */}
                  {muscleFatAlert && (
                    <div style={{
                      marginTop: 12, padding: '8px 10px', borderRadius: 'var(--r-sm)',
                      background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                    }}>
                      <span className="sm" style={{ color: 'var(--warning-ink)' }}>
                        <Glyph name="efecto" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Se observa reducción en % grasa y % músculo simultáneamente — solo como dato de registro.
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </>
  )
}

// ── TrendsCard: selector de ventana 7/14/30/60/Todo + MA-7 + banda σ + proyección curva ──
export function TrendsCard() {
  const { state } = useApp()
  const [win, setWin] = useState<number>(7)
  // primer nivel = 7d/30d/Todo; 14d/60d quedan tras el toggle "···"
  const [showExtraWindows, setShowExtraWindows] = useState(false)
  const PRIMARY_WINDOWS = [
    { v: 7, l: '7d' }, { v: 30, l: '30d' }, { v: 9999, l: 'Todo' },
  ]
  const EXTRA_WINDOWS = [
    { v: 14, l: '14d' }, { v: 60, l: '60d' },
  ]
  // Resolver 'Todo': longitud real del historial de peso
  const pesoAllFull = useMemo(() => [...(state.history['Peso'] ?? [])].sort((a, b) => a.ts - b.ts), [state.history])
  const effectiveWin = win === 9999
    ? (pesoAllFull.length >= 2 ? Math.ceil((pesoAllFull[pesoAllFull.length - 1].ts - pesoAllFull[0].ts) / DAY) + 1 : 30)
    : win

  const kcalAll = useMemo(() => kcalSeries(state, effectiveWin), [state, effectiveWin])
  const kcalPts = kcalAll.filter((d) => d.has).map((d) => d.kcal)
  const waterPts = useMemo(() => kcalAll.map((d) => state.nutrition[isoKey(d.ts)]?.water ?? 0), [kcalAll, state.nutrition])
  const pesoWin = pesoAllFull.filter((p) => p.ts >= state.todayTs - effectiveWin * DAY)
  const pesoPts = (pesoWin.length >= 2 ? pesoWin : pesoAllFull).map((p) => p.value)
  // Agua en LITROS (los vasos no son comparables entre tamaños): litros = vasos × ml real del vaso
  const waterLiterPts = useMemo(() => waterPts.map(litersFromMl), [waterPts])
  const waterGoalL = waterGoalLiters(state.profile.peso)

  // MA-7 sobre el peso: solo activa en ventana ≥14d
  const pesoMA = useMemo(() => effectiveWin >= 14 && pesoPts.length >= 7 ? movingAverage(pesoPts, 7) : [], [pesoPts, effectiveWin])

  // R² para chip de calidad
  const pesoR2 = useMemo(() => pesoPts.length >= 5 ? calcR2(pesoPts) : null, [pesoPts])

  // Proyección de meta para curva en TrendChart
  const proj = useMemo(() => weightProjection(state), [state])

  // Macros promedio de la ventana
  const macroAvg = useMemo(() => {
    let totP = 0, totC = 0, totF = 0, daysN = 0
    for (let i = 0; i < effectiveWin; i++) {
      const d = state.nutrition[isoKey(state.todayTs - i * DAY)]
      if (!d || d.meals.length === 0) continue
      const m = dayMacros(d.meals)
      if (!m.hasMacros) continue
      totP += m.protein; totC += m.carbs; totF += m.fat; daysN++
    }
    if (!daysN) return null
    return { protein: Math.round(totP / daysN), carbs: Math.round(totC / daysN), fat: Math.round(totF / daysN) }
  }, [state.nutrition, state.todayTs, effectiveWin])

  // Consistencia intra-semana 7×3
  const consistencyDays = useMemo(() => {
    const now = new Date(state.todayTs)
    // lunes de la semana actual
    const wd = now.getDay() === 0 ? 6 : now.getDay() - 1
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - wd + i)
      const k = isoKey(d.getTime())
      const nut = state.nutrition[k]
      const g = state.log.find((x) => x.dateKey === k)
      return {
        dose: !!g?.items.some((it) => it.type === 'dose'),
        water: !!nut && litersFromMl(nut.water) >= waterGoalL,
        meal: !!nut && nut.meals.length > 0,
      }
    })
  }, [state.todayTs, state.nutrition, state.log])

  // overlay multi-métrica (normalizada 0–100%) — la BASE es Peso; se compara contra una 2ª métrica.
  const [overlayActive, setOverlayActive] = useState(false)
  const [overlayMetric2, setOverlayMetric2] = useState<string>('Calorías')
  const normalize = (arr: number[]): number[] => {
    if (arr.length < 2) return arr
    const min = Math.min(...arr), max = Math.max(...arr)
    const range = max - min || 1
    return arr.map((v) => Math.round(((v - min) / range) * 100))
  }
  // puntos de cualquier métrica candidata (agua en litros). 'Peso' es la base, no se ofrece como 2ª.
  const metricPts = (m: string): number[] =>
    m === 'Calorías' ? kcalPts
    : m === 'Hidratación' ? waterLiterPts.filter((w) => w > 0)
    : (state.history[m] ?? []).filter((s) => s.ts >= state.todayTs - effectiveWin * DAY).map((s) => s.value)
  // SOLO se ofrecen métricas con datos suficientes (≥2 puntos) → así todas las opciones funcionan.
  const overlayOptions = [...new Set(['Calorías', 'Hidratación', ...state.selectedMeasures.slice(0, 3)])]
    .filter((m) => metricPts(m).length >= 2)
  const activeOverlay = overlayOptions.includes(overlayMetric2) ? overlayMetric2 : (overlayOptions[0] ?? '')
  const metric2Pts = activeOverlay ? metricPts(activeOverlay) : []
  // el overlay solo aplica si hay base (Peso) y al menos una 2ª métrica con datos
  const canOverlay = pesoPts.length >= 2 && overlayOptions.length > 0

  const hasAnyData = pesoPts.length >= 2 || kcalPts.length >= 2 || waterPts.some((w) => w > 0)

  const Row = ({ label, pts, unit, color, animKeyPrefix, refY }: {
    label: string; pts: number[]; unit: string; color: string; animKeyPrefix: string; refY?: number
  }) => {
    if (pts.length < 2) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="sm" style={{ width: 96, color: 'var(--ink-700)' }}>{label}</span>
        <span className="sm" style={{ color: 'var(--ink-300)' }}>Registra unos días más</span>
      </div>
    )
    const d = Math.round((pts[pts.length - 1] - pts[0]) * 10) / 10
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="sm" style={{ width: 96, color: 'var(--ink-700)' }}>{label}</span>
        <span className="sm mono" style={{ width: 64, color: 'var(--ink-400)' }}>{d > 0 ? '+' : ''}{d}{unit}</span>
        <div style={{ marginLeft: 'auto' }}>
          <Sparkline data={pts} color={color} w={120} h={26} animKey={`${animKeyPrefix}-${win}`} refY={refY} interactive />
        </div>
      </div>
    )
  }

  return (
    <Card title="Tendencias">
      {/* Selector de ventana — primer nivel 7d/30d/Todo; 14d/60d tras "···" */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {PRIMARY_WINDOWS.map((o) => (
          <button key={o.v} className="chip" style={{
            flex: 1, justifyContent: 'center', minWidth: 36,
            background: win === o.v ? 'var(--brand-700)' : undefined,
            color: win === o.v ? '#fff' : undefined,
          }} onClick={() => setWin(o.v)}>{o.l}</button>
        ))}
        {showExtraWindows && EXTRA_WINDOWS.map((o) => (
          <button key={o.v} className="chip" style={{
            flex: 1, justifyContent: 'center', minWidth: 36,
            background: win === o.v ? 'var(--brand-700)' : undefined,
            color: win === o.v ? '#fff' : undefined,
          }} onClick={() => setWin(o.v)}>{o.l}</button>
        ))}
        <button className="chip" style={{
          flexShrink: 0, minWidth: 36, justifyContent: 'center',
          background: showExtraWindows ? 'var(--ink-100)' : undefined,
        }} onClick={() => setShowExtraWindows((v) => !v)} aria-label="Más rangos de tiempo" aria-expanded={showExtraWindows}>
          ···
        </button>
      </div>
      {!hasAnyData ? (
        <EmptyState glyph="medidas" title="Sin datos todavía" subtitle="Registra peso, comidas o agua para ver tus tendencias." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Peso con TrendChart (banda σ + proyección) cuando hay ≥10 pts y ≥14d */}
          {pesoPts.length >= 2 && effectiveWin >= 14 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className="sm" style={{ width: 96, color: 'var(--ink-700)' }}>Peso</span>
                <span className="sm mono" style={{ width: 64, color: 'var(--ink-400)' }}>
                  {(() => { const d = Math.round((pesoPts[pesoPts.length - 1] - pesoPts[0]) * 10) / 10; return `${d > 0 ? '+' : ''}${d} kg` })()}
                </span>
                {pesoR2 != null && <R2Chip r2={pesoR2} n={pesoPts.length} />}
              </div>
              <TrendChart
                data={pesoPts}
                w={280} h={60}
                showBand
                projectionEtaTs={proj?.etaTs}
                projectionStartTs={proj ? undefined : undefined}
                labels={[`${pesoPts[0]} kg`, `${pesoPts[pesoPts.length - 1]} kg`]}
              />
              {proj?.etaTs && (
                <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 3 }}>
                  Proyección estimada → ~{fmtDate(proj.etaTs)} · extrapolación
                </div>
              )}
            </div>
          ) : (
            <Row label="Peso" pts={pesoPts} unit=" kg" color="var(--brand-700)" animKeyPrefix="peso" />
          )}
          <Row label="Calorías/día" pts={kcalPts} unit="" color="var(--brand-500)" animKeyPrefix="kcal" />
          {/* Hidratación en LITROS con línea de meta */}
          <Row label="Hidratación" pts={waterLiterPts} unit=" L" color="var(--brand-300)" animKeyPrefix="agua" refY={waterGoalL} />

          {/* Barra de macros apilada */}
          {macroAvg && (
            <div>
              <div className="sm" style={{ color: 'var(--ink-700)', marginBottom: 6 }}>Distribución de macros (prom.)</div>
              <MacroBar
                protein={macroAvg.protein} carbs={macroAvg.carbs} fat={macroAvg.fat}
                goalProtein={state.macroGoals?.protein} goalCarbs={state.macroGoals?.carbs} goalFat={state.macroGoals?.fat}
                w={280} h={18}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                {[
                  { label: `P ${macroAvg.protein}g`, col: 'var(--brand-700)' },
                  { label: `C ${macroAvg.carbs}g`, col: 'var(--brand-300)' },
                  { label: `G ${macroAvg.fat}g`, col: 'var(--ink-300)' },
                ].map(({ label, col }) => (
                  <span key={label} className="sm" style={{ color: col }}>{label}</span>
                ))}
              </div>
            </div>
          )}

          {/* Consistencia intra-semana 7×3 */}
          <div>
            <div className="sm" style={{ color: 'var(--ink-700)', marginBottom: 6 }}>Consistencia esta semana</div>
            <ConsistencyHeatmap days={consistencyDays} />
          </div>

          {/* Comparar con el peso (base = Peso) — solo aparece si hay peso + alguna 2ª métrica con datos */}
          {canOverlay && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button className="chip" style={{
                maxWidth: '100%',
                background: overlayActive ? 'var(--brand-500)' : undefined,
                color: overlayActive ? '#fff' : undefined,
              }} onClick={() => setOverlayActive((v) => !v)} aria-pressed={overlayActive} aria-expanded={overlayActive}>
                Comparar con tu peso
              </button>
              <AnimatePresence>
                {overlayActive && (
                  <motion.div
                    key="overlay-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {/* solo se listan métricas con datos suficientes → todas las opciones funcionan */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '10px 0 8px' }}>
                      {overlayOptions.slice(0, 6).map((m) => (
                        <button key={m} className="chip" style={{
                          maxWidth: '100%',
                          background: activeOverlay === m ? 'var(--warning)' : undefined,
                          color: activeOverlay === m ? '#fff' : undefined,
                          fontSize: 10,
                        }} onClick={() => setOverlayMetric2(m)}>{m}</button>
                      ))}
                    </div>
                    {metric2Pts.length >= 2 && (
                      <div>
                        <div style={{ position: 'relative', height: 40 }}>
                          <Sparkline data={normalize(pesoPts)} color="var(--brand-700)" w={280} h={40} animKey={`overlay-peso-${win}`} />
                          <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                            <Sparkline data={normalize(metric2Pts)} color="var(--warning)" w={280} h={40} animKey={`overlay-m2-${win}-${activeOverlay}`} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                          <span className="sm" style={{ color: 'var(--brand-700)', fontSize: 10 }}>● Peso (norm.)</span>
                          <span className="sm" style={{ color: 'var(--warning-ink)', fontSize: 10 }}>● {activeOverlay} (norm.)</span>
                          <span className="sm" style={{ color: 'var(--ink-300)', fontSize: 9 }}>0–100% normalizado</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Señales clasificadas: tipo logro/alerta/info ──
export type InsightType = 'logro' | 'alerta' | 'info'
export interface ClassifiedInsight { type: InsightType; text: string }

export function classifyInsights(raw: string[]): ClassifiedInsight[] {
  return raw.map((text) => {
    const lower = text.toLowerCase()
    // logro: mejora positiva
    if (lower.includes('cumpliste') || lower.includes('bajó') || lower.includes('subió') || lower.includes('déficit'))
      return { type: 'logro' as const, text }
    // alerta: algo a vigilar
    if (lower.includes('sin registro') || lower.includes('cero') || lower.includes('perdida') || lower.includes('alta'))
      return { type: 'alerta' as const, text }
    return { type: 'info' as const, text }
  })
}

export const INSIGHT_GLYPH: Record<InsightType, React.ReactNode> = {
  logro: <Glyph name="estrella" size={14} color="currentColor" />,
  alerta: <Glyph name="efecto" size={14} color="currentColor" />,
  info: <Glyph name="foco" size={14} color="currentColor" />,
}
export const INSIGHT_BG: Record<InsightType, string> = {
  logro: 'color-mix(in srgb, var(--brand-100) 60%, transparent)',
  alerta: 'color-mix(in srgb, var(--warning) 12%, transparent)',
  info: 'var(--surface)',
}
export const INSIGHT_COL: Record<InsightType, string> = {
  logro: 'var(--brand-700)',
  alerta: 'var(--warning)',
  info: 'var(--ink-700)',
}
