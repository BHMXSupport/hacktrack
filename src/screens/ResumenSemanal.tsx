// ResumenSemanal — recap de 7 días + perspectivas Plus (premium).
// Muestra los datos DEL USUARIO por protocolo (puede nombrar el producto). App Store: el copy no
// afirma causalidad/eficacia ni recomienda dosis; "desde que iniciaste <producto>" es solo el ancla temporal.
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, adherence, isoKey, adherenceMonth } from '../lib/store'
import {
  protocolNumbers, tdee, avgKcal, weightProjection, compositeStreak, weeklyInsights, kcalSeries, streakDetail, anchorProduct, protocolList, productKpis, dayMacros,
} from '../lib/nutrition'
import { Sparkline, TrendChart, MacroBar, ConsistencyHeatmap, R2Chip, movingAverage } from '../components/charts'
import { EmptyState } from '../components/EmptyState'
import { PremiumGate } from '../components/PremiumGate'
import type { Actividad, Sexo } from '../lib/types'
import { staggerParent, staggerItem, dur, ease } from '../lib/motion'
import { dayStatusEx } from '../lib/calendar'
import { WDS, MEASURES_BY, MEASURE_META } from '../lib/catalog'

const DAY = 86_400_000
const ACT_LABEL: { v: Actividad; l: string }[] = [
  { v: 'sedentario', l: 'Sedentario' }, { v: 'ligero', l: 'Ligero' }, { v: 'moderado', l: 'Moderado' }, { v: 'activo', l: 'Activo' }, { v: 'muy-activo', l: 'Muy activo' },
]

// ── R² helper (interno, se expone en el chip de TrendChart) ──
function calcR2(data: number[]): number {
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

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div variants={staggerItem} className="card">
      <div className="h2" style={{ color: 'var(--ink-900)' }}>{title}</div>
      {subtitle && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>{subtitle}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </motion.div>
  )
}
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

// ── ProgressBar reutilizable ──
function ProgressBar({ pct, color = 'var(--brand-700)' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 6, background: 'var(--ink-100)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 'var(--r-sm)', transition: 'width 0.3s ease' }} />
    </div>
  )
}

// ── WellnessRing: score 0–100 animado (n=291) ──
function WellnessRing({ score }: { score: number }) {
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
function ComparativaCard() {
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px 60px', gap: 6, marginBottom: 6 }}>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>Medida</span>
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
                  <div key={m} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px 60px', gap: 6, alignItems: 'center' }}>
                    <span className="sm" style={{ color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
                    <span className="mono sm" style={{ textAlign: 'right', color: 'var(--ink-400)' }}>
                      {beforeVal != null ? `${beforeVal}${unit}` : '—'}
                    </span>
                    <span className="mono sm" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {duringVal != null ? `${duringVal}${unit}` : '—'}
                    </span>
                    <span className="mono sm" style={{ textAlign: 'right', color: col, fontWeight: 600 }}>
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
function StreakWeekCard() {
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
function AdherenciaProyeccionCard() {
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
      <ProgressBar pct={projPct} color={barColor} />
      <div style={{ position: 'relative', height: 0 }}>
        <div style={{
          position: 'absolute', left: '80%', top: -8,
          width: 1, height: 14, background: 'var(--ink-300)',
        }} />
      </div>
      <div className="sm" style={{ color: 'var(--ink-700)', marginTop: 14, lineHeight: 1.45 }}>{msg}</div>
      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 6 }}>
        {taken} tomadas · {due - taken} perdidas · {upcoming} pendientes este mes
      </div>
    </motion.div>
  )
}

// ── Tarjeta PER-PRODUCTO: cada producto con tap-to-expand (n=296) ──
function ProductCards() {
  const { state, dispatch } = useApp()
  const protos = protocolList(state)
  const [expandedProto, setExpandedProto] = useState<string | null>(null)

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

  return (
    <>
      {protos.map((pr) => {
        const kpis = productKpis(state, pr.product)
        const isExpanded = expandedProto === pr.product
        const primaryKpi = kpis[0]

        // Insight cruzado: pérdida simultánea de músculo y grasa (n=298) — observacional
        const musKpi = kpis.find((k) => k.measure === '% músculo')
        const grasaKpi = kpis.find((k) => k.measure === '% grasa')
        const muscleFatAlert = musKpi?.delta != null && grasaKpi?.delta != null
          && grasaKpi.delta < -0.3 && musKpi.delta < -0.3

        return (
          <motion.div key={pr.product} variants={staggerItem} className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpandedProto(isExpanded ? null : pr.product)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{pr.product}</span>
              <span className="sm" style={{ background: pr.color + '18', color: pr.color, padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>{pr.cat}</span>
              <span className="sm" style={{ color: 'var(--ink-400)', marginLeft: 'auto' }}>{pr.daysActive} d activo</span>
              {/* chevron */}
              <span style={{
                display: 'inline-block', color: 'var(--ink-300)', fontSize: 12, lineHeight: 1,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}>▼</span>
            </div>
            {/* KPI primario siempre visible */}
            {primaryKpi && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <span className="sm" style={{ flex: 1, color: 'var(--ink-700)' }}>{primaryKpi.measure}</span>
                {primaryKpi.last == null ? (
                  <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); dispatch({ t: 'sheet', sheet: 'medida', arg: primaryKpi.measure }) }}>+ Registrar</button>
                ) : (
                  <>
                    <span className="mono sm" style={{ fontWeight: 700 }}>{primaryKpi.last}<span style={{ color: 'var(--ink-400)' }}>{primaryKpi.unit}</span></span>
                    {primaryKpi.delta != null && (() => {
                      const good = (primaryKpi.down && primaryKpi.delta < 0) || (!primaryKpi.down && primaryKpi.delta > 0)
                      const bad = primaryKpi.delta !== 0 && !good
                      const col = good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-400)'
                      const dUnit = primaryKpi.unit.startsWith('/') ? '' : primaryKpi.unit
                      return <span className="mono sm" style={{ width: 52, textAlign: 'right', color: col }}>{primaryKpi.delta > 0 ? '+' : ''}{primaryKpi.delta}{dUnit}</span>
                    })()}
                  </>
                )}
              </div>
            )}
            {/* Expanded: todos los KPIs + sparkline de 30d (n=296) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: dur.base, ease: ease.decelerate }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="sm" style={{ color: 'var(--ink-400)', margin: '6px 0 10px' }}>Tus lecturas durante este protocolo</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {kpis.map((k) => {
                      const good = k.delta != null && k.delta !== 0 && ((k.down && k.delta < 0) || (!k.down && k.delta > 0))
                      const bad = k.delta != null && k.delta !== 0 && !good
                      const col = good ? 'var(--success)' : bad ? 'var(--warning)' : 'var(--ink-400)'
                      const dUnit = k.unit.startsWith('/') ? '' : k.unit
                      return (
                        <div key={k.measure} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="sm" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.measure}</span>
                          {k.last == null ? (
                            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); dispatch({ t: 'sheet', sheet: 'medida', arg: k.measure }) }}>+ Registrar</button>
                          ) : (
                            <>
                              <span className="mono sm" style={{ fontWeight: 700 }}>{k.last}<span style={{ color: 'var(--ink-400)' }}>{k.unit}</span></span>
                              {k.delta != null && <span className="mono sm" style={{ width: 52, textAlign: 'right', color: col }}>{k.delta > 0 ? '+' : ''}{k.delta}{dUnit}</span>}
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
                  {/* Insight cruzado músculo+grasa (n=298) */}
                  {muscleFatAlert && (
                    <div style={{
                      marginTop: 12, padding: '8px 10px', borderRadius: 'var(--r-sm)',
                      background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                    }}>
                      <span className="sm" style={{ color: 'var(--warning)' }}>
                        ⚠ Se observa reducción en % grasa y % músculo simultáneamente — solo como dato de registro.
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

// ── Tendencias: selector de ventana ampliado 7/14/30/60/Todo (n=350) + MA-7 + banda σ + proyección curva ──
function TrendsCard() {
  const { state } = useApp()
  const [win, setWin] = useState<number>(7)
  const WINDOWS = [
    { v: 7, l: '7d' }, { v: 14, l: '14d' }, { v: 30, l: '30d' }, { v: 60, l: '60d' }, { v: 9999, l: 'Todo' },
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

  // MA-7 sobre el peso (n=295): solo activa en ventana ≥14d
  const pesoMA = useMemo(() => effectiveWin >= 14 && pesoPts.length >= 7 ? movingAverage(pesoPts, 7) : [], [pesoPts, effectiveWin])

  // R² para chip de calidad (n=349)
  const pesoR2 = useMemo(() => pesoPts.length >= 5 ? calcR2(pesoPts) : null, [pesoPts])

  // Proyección de meta para curva en TrendChart (n=294)
  const proj = useMemo(() => weightProjection(state), [state])

  // Macros promedio de la ventana (n=292/353)
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

  // Consistencia intra-semana 7×3 (n=362)
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
        water: !!nut && nut.water >= 8,
        meal: !!nut && nut.meals.length > 0,
      }
    })
  }, [state.todayTs, state.nutrition, state.log])

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
      {/* Selector ampliado 7/14/30/60/Todo (n=350) */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {WINDOWS.map((o) => (
          <button key={o.v} className="chip" style={{
            flex: 1, justifyContent: 'center', minWidth: 36,
            background: win === o.v ? 'var(--brand-700)' : undefined,
            color: win === o.v ? '#fff' : undefined,
          }} onClick={() => setWin(o.v)}>{o.l}</button>
        ))}
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
          {/* Hidratación con línea de meta (n=354) */}
          <Row label="Hidratación" pts={waterPts} unit=" vasos" color="var(--brand-300)" animKeyPrefix="agua" refY={8} />

          {/* Barra de macros apilada (n=292/353) */}
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

          {/* Consistencia intra-semana 7×3 (n=362) */}
          <div>
            <div className="sm" style={{ color: 'var(--ink-700)', marginBottom: 6 }}>Consistencia esta semana</div>
            <ConsistencyHeatmap days={consistencyDays} />
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Señales clasificadas: tipo logro/alerta/info (n=297) ──
type InsightType = 'logro' | 'alerta' | 'info'
interface ClassifiedInsight { type: InsightType; text: string }

function classifyInsights(raw: string[]): ClassifiedInsight[] {
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

const INSIGHT_GLYPH: Record<InsightType, string> = { logro: '★', alerta: '⚠', info: 'ℹ' }
const INSIGHT_BG: Record<InsightType, string> = {
  logro: 'color-mix(in srgb, var(--brand-100) 60%, transparent)',
  alerta: 'color-mix(in srgb, var(--warning) 12%, transparent)',
  info: 'var(--surface)',
}
const INSIGHT_COL: Record<InsightType, string> = {
  logro: 'var(--brand-700)',
  alerta: 'var(--warning)',
  info: 'var(--ink-700)',
}

export function ResumenSemanal() {
  const { state, dispatch } = useApp()
  const cutoff = state.todayTs - 7 * DAY
  const anchorRef = useRef<HTMLDivElement>(null)
  const [showStickyHeader, setShowStickyHeader] = useState(false)

  let doses = 0
  for (const g of state.log) for (const it of g.items) {
    if (it.ts < cutoff) continue
    if (it.type === 'dose') doses++
  }
  const adh = adherence(state, 7)

  // ── Delta semana actual vs semana previa (n=363) ──
  const adhPrev7 = adherence(state, 14)  // 14d tiene dentro las semanas 1 y 2
  // adherencia de los días 8–14 (semana previa)
  const adhPrevOnly = useMemo(() => {
    let taken = 0, due = 0
    const now = new Date(state.todayTs)
    for (let i = 7; i < 14; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const k = isoKey(d.getTime())
      const g = state.log.find((x) => x.dateKey === k)
      const hasDose = !!g?.items.some((it) => it.type === 'dose')
      const proto = Object.values(state.protocols)[0]
      if (proto && d.getTime() >= proto.startDate) { due++; if (hasDose) taken++ }
    }
    return due > 0 ? Math.round((taken / due) * 100) : null
  }, [state.todayTs, state.log, state.protocols])

  const adhDelta = adh && adhPrevOnly != null ? adh.pct - adhPrevOnly : null

  // Promedios en lugar de totales: más honestos con semanas incompletas
  const waterDays: number[] = [], kcalDays: number[] = []
  for (let i = 0; i < 7; i++) {
    const d = state.nutrition[isoKey(state.todayTs - i * DAY)]
    if (!d) continue
    waterDays.push(d.water)
    const dayKcalVal = d.meals.reduce((s, m) => s + m.kcal, 0)
    if (d.meals.length > 0) kcalDays.push(dayKcalVal)
  }
  const waterAvg = waterDays.length ? Math.round(waterDays.reduce((a, b) => a + b, 0) / waterDays.length) : 0

  // Delta agua semana previa
  const waterPrevDays: number[] = []
  for (let i = 7; i < 14; i++) {
    const d = state.nutrition[isoKey(state.todayTs - i * DAY)]
    if (d) waterPrevDays.push(d.water)
  }
  const waterPrevAvg = waterPrevDays.length ? Math.round(waterPrevDays.reduce((a, b) => a + b, 0) / waterPrevDays.length) : null
  const waterDelta = waterPrevAvg != null ? waterAvg - waterPrevAvg : null

  const avg7 = avgKcal(state, 7)
  const streak = compositeStreak(state)
  const sd = streakDetail(state)

  // datos premium — memoizados (n=368)
  const pn = useMemo(() => protocolNumbers(state), [state.nutrition, state.history, state.protocols])
  const t = useMemo(() => tdee(state), [state.profile])
  const proj = useMemo(() => weightProjection(state), [state.history, state.profile])
  const rawInsights = useMemo(() => weeklyInsights(state), [state.nutrition, state.history, state.protocols, state.macroGoals])
  const insights = useMemo(() => classifyInsights(rawInsights), [rawInsights])

  const p = state.profile
  const profileComplete = !!(p.edad && p.sexo && p.actividad)
  const ap = anchorProduct(state)
  const multiProto = Object.keys(state.protocols).length > 1
  const ancSub = multiProto ? 'Desde el inicio de tu seguimiento' : ap ? `Desde que iniciaste ${ap}` : 'Desde tu fecha de inicio'

  // ── WellnessScore (n=291) ──
  const wellnessScore = useMemo(() => {
    const adhScore = adh ? adh.pct * 0.4 : 0
    const waterScore = (waterDays.filter((w) => w >= 8).length / 7) * 100 * 0.25
    const mealScore = (kcalDays.length / 7) * 100 * 0.20
    // variación de peso → 15%: si hay tendencia y va hacia la meta, full; sino proporcional
    let weightScore = 0
    if (proj?.slopePerDay != null && state.profile.metaPesoKg != null) {
      const good = Math.sign(proj.slopePerDay) === Math.sign(state.profile.metaPesoKg - proj.current)
      weightScore = good ? 15 : 0
    }
    return Math.round(adhScore + waterScore + mealScore + weightScore)
  }, [adh, waterDays, kcalDays, proj, state.profile])

  // ── Mini-header sticky (n=370) ──
  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      setShowStickyHeader(!entry.isIntersecting)
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── CTA dinámico de racha (n=357) ──
  const streakCta = useMemo(() => {
    const { dose, water, meal } = sd.today
    if (dose && water && meal) return 'Racha asegurada hoy'
    const pending = [!dose && 'dosis', !water && 'hidratación', !meal && 'comida'].filter(Boolean)
    if (pending.length === 0) return 'Racha asegurada hoy'
    return `Registra ${pending.join(' y ')} para mantener tu racha`
  }, [sd.today])

  // Tab destino para el CTA de racha
  const streakCtaTab = useMemo(() => {
    if (!sd.today.dose) return 'protocolo'
    if (!sd.today.meal) return 'comida'
    return 'inicio'
  }, [sd.today]) as 'protocolo' | 'comida' | 'inicio'

  // ── Compartir semana (n=372) Web Share API ──
  const handleShare = useCallback(async () => {
    const text = `🔥 ${streak} ${streak === 1 ? 'día' : 'días'} · ${adh ? adh.pct + '%' : '—'} adherencia · ${avg7 != null ? avg7 + ' kcal/día' : '—'} — via Hacktrack`
    try {
      if (navigator.share && navigator.canShare?.({ title: 'Mi semana en Hacktrack', text })) {
        await navigator.share({ title: 'Mi semana en Hacktrack', text })
      } else {
        await navigator.clipboard.writeText(text)
        dispatch({ t: 'toast', msg: 'Copiado al portapapeles' })
      }
    } catch {
      // cancelado por el usuario — ignorar
    }
  }, [streak, adh, avg7, dispatch])

  const canShare = (streak > 0 || (adh?.pct ?? 0) > 0)

  // ── Aviso déficit calórico agresivo (n=365) ──
  const caloricDeficit = avg7 != null && t != null ? avg7 - t : null
  const severeDeficit = caloricDeficit != null && caloricDeficit < -500
  const veryDeficit = caloricDeficit != null && caloricDeficit < -1000

  return (
    <div className="scroll has-nav">
      {/* ── Mini-header sticky (n=370) ── */}
      <AnimatePresence>
        {showStickyHeader && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: dur.base, ease: ease.decelerate }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
              background: 'var(--bg)', borderBottom: '1px solid var(--border)',
              padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            {streak > 0 && (
              <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 700 }}>🔥 {streak}d</span>
            )}
            {adh && (
              <span className="sm mono" style={{ color: 'var(--ink-700)' }}>{adh.pct}% adh</span>
            )}
            {pn?.weightDelta != null && (
              <span className="sm mono" style={{ color: pn.weightDelta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
                {pn.weightDelta > 0 ? '+' : ''}{pn.weightDelta} kg
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Header con WellnessRing + Compartir (n=291, n=372) ── */}
        <motion.div variants={staggerItem} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <h1 className="h1" style={{ margin: 0 }}>Tu semana</h1>
            <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 4 }}>Últimos 7 días</p>
          </div>
          <WellnessRing score={wellnessScore} />
          {canShare && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleShare}
              aria-label="Compartir resumen semanal"
            >
              Compartir
            </button>
          )}
        </motion.div>

        {/* ── Ancla para IntersectionObserver del sticky header ── */}
        <div ref={anchorRef} style={{ height: 0 }} />

        {/* ── Stats base (gratis) ── */}
        <Card title="Adherencia" subtitle={adh ? `${adh.taken} de ${adh.due} dosis cumplidas` : 'Sin protocolo activo'}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-700)', lineHeight: 1 }}>{adh ? `${adh.pct}%` : '—'}</div>
            {/* Delta vs semana previa (n=363) */}
            {adhDelta != null && Math.abs(adhDelta) >= 1 && (
              <span className="sm mono" style={{ color: adhDelta >= 0 ? 'var(--success)' : 'var(--warning)' }}>
                {adhDelta >= 0 ? '▲' : '▼'} {Math.abs(adhDelta)} pp vs sem. anterior
              </span>
            )}
          </div>
        </Card>

        {/* Rejilla 2+1: Dosis + Hidratación arriba al 50/50, Calorías full-width abajo */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Card title="Dosis"><div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>{doses}</div></Card></div>
          <div style={{ flex: 1 }}>
            <Card title="Hidratación" subtitle="Promedio/día vs meta (8)">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                  {waterAvg}<span className="sm" style={{ color: 'var(--ink-400)' }}> / 8</span>
                </div>
                {waterDelta != null && Math.abs(waterDelta) >= 1 && (
                  <span className="sm mono" style={{ color: waterDelta >= 0 ? 'var(--success)' : 'var(--warning)', fontSize: 11 }}>
                    {waterDelta >= 0 ? '▲' : '▼'} {Math.abs(waterDelta)} vasos
                  </span>
                )}
              </div>
              <div style={{ marginTop: 8 }}>
                <ProgressBar pct={(waterAvg / 8) * 100} color="var(--brand-300)" />
              </div>
            </Card>
          </div>
        </div>

        <Card title="Calorías" subtitle="Promedio de días con registro">
          {avg7 != null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800 }}>
                {avg7 >= 1000 ? `${(avg7 / 1000).toFixed(1)}k` : avg7}
                <span className="sm" style={{ color: 'var(--ink-400)', marginLeft: 4 }}>kcal/día</span>
              </div>
              {t != null && (() => {
                const delta = avg7 - t
                return <span className="mono sm" style={{ color: delta < 0 ? 'var(--brand-700)' : 'var(--warning)' }}>{delta > 0 ? '+' : ''}{delta} {delta < 0 ? 'déficit' : 'superávit'}</span>
              })()}
            </div>
          ) : (
            <div className="sm" style={{ color: 'var(--ink-400)' }}>Sin registros esta semana</div>
          )}
          {/* Aviso déficit agresivo observacional (n=365) */}
          {severeDeficit && (
            <div style={{
              marginTop: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)',
              border: `1px solid ${veryDeficit ? 'var(--error)' : 'color-mix(in srgb, var(--warning) 50%, transparent)'}`,
              background: veryDeficit
                ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                : 'color-mix(in srgb, var(--warning) 10%, transparent)',
            }}>
              <span className="sm" style={{ color: veryDeficit ? 'var(--error)' : 'var(--warning)' }}>
                {veryDeficit
                  ? `⚠ Déficit muy elevado (>${Math.abs(caloricDeficit!)} kcal) — solo como dato de registro.`
                  : `Déficit elevado (${Math.abs(caloricDeficit!)} kcal/día) — solo como dato de registro.`}
              </span>
            </div>
          )}
        </Card>

        {/* ── Señales con clasificación visual (n=297) ── */}
        <Card title="Señales de la semana">
          {insights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
                  borderRadius: 'var(--r-sm)', background: INSIGHT_BG[ins.type],
                }}>
                  <span style={{ fontSize: 14, color: INSIGHT_COL[ins.type], flexShrink: 0, lineHeight: 1.4 }}>
                    {INSIGHT_GLYPH[ins.type]}
                  </span>
                  <span className="sm" style={{ color: 'var(--ink-700)', lineHeight: 1.45 }}>{ins.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState glyph="energia" title="Aún sin señales" subtitle="Registra comidas, agua y peso durante la semana para ver observaciones personalizadas." />
          )}
        </Card>

        <TrendsCard />

        {/* ── Perspectivas Plus (premium) ── */}
        <motion.div variants={staggerItem} style={{ marginTop: 8 }}>
          <span className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)' }}>Perspectivas Plus</span>
        </motion.div>

        <PremiumGate label="Perspectivas Plus — desbloquea tu progreso real">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Perfil para perspectivas (TDEE / proyección) */}
            {!profileComplete && (
              <Card title="Completa tu perfil" subtitle="Para calcular tu gasto energético y proyección">
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {/* n=371: label visible + validación de rango */}
                  <div style={{ flex: 1 }}>
                    <label htmlFor="rs-edad" className="sm" style={{ display: 'block', color: 'var(--ink-400)', marginBottom: 3 }}>Edad</label>
                    <input
                      id="rs-edad"
                      className="field"
                      type="number"
                      inputMode="numeric"
                      placeholder="Años"
                      min={10} max={120}
                      defaultValue={p.edad ?? ''}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value)
                        if (Number.isFinite(v) && v >= 10 && v <= 120) {
                          dispatch({ t: 'setProfileFields', patch: { edad: v } })
                          e.target.setCustomValidity('')
                        } else if (e.target.value !== '') {
                          e.target.setCustomValidity('Introduce una edad entre 10 y 120')
                          e.target.reportValidity()
                        }
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'flex-end' }}>
                    {(['H', 'M'] as Sexo[]).map((sx) => (
                      <button key={sx} className={'chip' + (p.sexo === sx ? ' chip-active' : '')} style={{ flex: 1, justifyContent: 'center', background: p.sexo === sx ? 'var(--brand-700)' : undefined, color: p.sexo === sx ? '#fff' : undefined }} onClick={() => dispatch({ t: 'setProfileFields', patch: { sexo: sx } })}>{sx === 'H' ? 'Hombre' : 'Mujer'}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ACT_LABEL.map((a) => (
                    <button key={a.v} className="chip" style={{ background: p.actividad === a.v ? 'var(--brand-700)' : undefined, color: p.actividad === a.v ? '#fff' : undefined }} onClick={() => dispatch({ t: 'setProfileFields', patch: { actividad: a.v } })}>{a.l}</button>
                  ))}
                </div>
              </Card>
            )}

            {/* Tu protocolo en números — ANCLA */}
            {pn && (pn.deltaKcal != null || pn.weightDelta != null) && (
              <Card title="Tu protocolo en números" subtitle={ancSub}>
                <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
                  {pn.deltaKcal != null && (
                    <div>
                      <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: pn.deltaKcal <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>
                        {pn.deltaKcal > 0 ? '+' : ''}{pn.deltaKcal}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-400)' }}>kcal/día prom.</div>
                    </div>
                  )}
                  {pn.weightDelta != null && (
                    <div>
                      <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: pn.weightDelta <= 0 ? 'var(--success)' : 'var(--ink-900)' }}>
                        {pn.weightDelta > 0 ? '+' : ''}{pn.weightDelta}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-400)' }}>kg</div>
                    </div>
                  )}
                </div>
                {pn.weightPoints.length >= 2 ? (() => {
                  const wp = pn.weightPoints
                  const net = wp[wp.length - 1] - wp[0]
                  const goal = state.profile.metaPesoKg
                  const towardGoal = goal != null ? (goal < wp[0] ? net <= 0 : net >= 0) : net <= 0
                  const r2 = calcR2(wp)
                  // Marcadores de eventos: inicio de cada protocolo en el índice aproximado
                  const eventsMarkers = (() => {
                    if (!pn.startTs) return []
                    const base = pn.startTs
                    const protos = protocolList(state)
                    return protos
                      .filter((pr) => pr.startDate > base)
                      .map((pr) => {
                        const idx = Math.round((pr.startDate - base) / DAY)
                        return { idx: Math.min(idx, wp.length - 1), label: pr.product.slice(0, 5) }
                      })
                  })()
                  return (
                    <div style={{ marginTop: 4 }}>
                      <TrendChart
                        data={wp} w={280} h={60}
                        trendColor={towardGoal ? 'var(--success)' : 'var(--warning)'}
                        labels={[`${wp[0]} kg`, `${wp[wp.length - 1]} kg`]}
                        showBand={wp.length >= 7}
                        projectionEtaTs={proj?.etaTs}
                        events={eventsMarkers.length > 0 ? eventsMarkers : undefined}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <div className="sm" style={{ color: 'var(--ink-400)' }}>Peso · línea de tendencia</div>
                        <R2Chip r2={r2} n={wp.length} />
                      </div>
                    </div>
                  )
                })() : pn.kcalPoints.length >= 2 ? (
                  <div style={{ marginTop: 4 }}>
                    <Sparkline data={pn.kcalPoints.map((x) => x.kcal)} color="var(--brand-500)" w={280} h={36} />
                    <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>kcal/día</div>
                  </div>
                ) : null}
                {!pn.enoughData && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 8 }}>Registra ~14 días para una comparación más sólida.</div>}
              </Card>
            )}

            {/* Comparativa antes/durante protocolo */}
            <ComparativaCard />
            {/* Racha semanal con mini-timeline */}
            <StreakWeekCard />
            {/* Proyección de adherencia mensual */}
            <AdherenciaProyeccionCard />

            {/* Progreso por producto — expandible (n=296) */}
            <ProductCards />

            {/* Margen energético (TDEE) */}
            {t != null && (
              <Card title="Margen energético" subtitle="Tu consumo vs tu gasto estimado">
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div><div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{t}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal gasto est.</div></div>
                  <div><div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{avg7 ?? '—'}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal consumo 7d</div></div>
                  {avg7 != null && (() => { const m = avg7 - t; return (
                    <div><div className="mono" style={{ fontSize: 22, fontWeight: 800, color: m < 0 ? 'var(--brand-700)' : 'var(--warning)' }}>{m > 0 ? '+' : ''}{m}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>{m < 0 ? 'déficit' : 'superávit'}</div></div>
                  ) })()}
                </div>
              </Card>
            )}

            {/* Proyección de meta (n=294 + ghost cuando no hay meta) */}
            {state.profile.metaPesoKg == null ? (
              <Card title="Proyección de meta">
                <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8 }}>
                  Define tu peso objetivo para ver tu trayectoria proyectada.
                </div>
                {/* Preview fantasma (curva tenue con puntos placeholder) */}
                <div style={{ position: 'relative', opacity: 0.3, pointerEvents: 'none', marginBottom: 10 }}>
                  <TrendChart data={[80, 79.5, 79, 78.4, 77.9, 77.5, 77]} w={280} h={48} trendColor="var(--ink-200)" lineColor="var(--ink-100)" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="rs-meta" className="sm" style={{ display: 'block', color: 'var(--ink-400)', marginBottom: 3 }}>Meta (kg)</label>
                    <input
                      id="rs-meta"
                      className="field"
                      type="number"
                      inputMode="decimal"
                      placeholder="ej. 72"
                      min={30} max={300}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value)
                        if (Number.isFinite(v) && v >= 30 && v <= 300) {
                          dispatch({ t: 'setProfileFields', patch: { metaPesoKg: v } })
                          e.target.setCustomValidity('')
                        } else if (e.target.value !== '') {
                          e.target.setCustomValidity('Introduce un peso entre 30 y 300 kg')
                          e.target.reportValidity()
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </Card>
            ) : proj ? (
              <Card title="Proyección de meta" subtitle={`Meta: ${proj.goal} kg · a tu ritmo registrado`}>
                {(() => {
                  const total = Math.abs(proj.goal - proj.points[0])
                  const done = Math.abs(proj.current - proj.points[0])
                  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
                  return (
                    <>
                      <div style={{ marginBottom: 8 }}>
                        <ProgressBar pct={pct} />
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-700)' }}>
                        {proj.current} kg → {proj.goal} kg · {proj.etaTs ? `~${fmtDate(proj.etaTs)}` : 'tendencia aún no apunta a la meta'}
                      </div>
                    </>
                  )
                })()}
              </Card>
            ) : (
              <Card title="Proyección de meta"><div className="sm" style={{ color: 'var(--ink-400)' }}>Registra tu peso unos días más para construir tu tendencia.</div></Card>
            )}

            {/* Racha y hitos con CTA dinámico (n=357) */}
            <Card title="Racha y hitos" subtitle="Días seguidos con dosis, agua y comida">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand-700)' }}>{sd.streak}</span>
                <span className="sm" style={{ color: 'var(--ink-400)' }}>{sd.streak === 1 ? 'día' : 'días'} de racha</span>
              </div>
              {/* condiciones de hoy */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {([['Dosis', sd.today.dose], ['Agua', sd.today.water], ['Comida', sd.today.meal]] as const).map(([lbl, ok]) => (
                  <span key={lbl} className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: ok ? 'var(--brand-100)' : 'var(--ink-100)', color: ok ? 'var(--brand-700)' : 'var(--ink-400)', fontWeight: 600 }}>
                    {ok ? '✓' : '○'} {lbl}
                  </span>
                ))}
              </div>
              {/* CTA dinámico (n=357) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="sm" style={{
                  color: sd.today.dose && sd.today.water && sd.today.meal ? 'var(--success)' : 'var(--ink-700)',
                  flex: 1, lineHeight: 1.4,
                }}>
                  {streakCta}
                </span>
                {!(sd.today.dose && sd.today.water && sd.today.meal) && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => dispatch({ t: 'tab', tab: streakCtaTab })}
                  >
                    Ir →
                  </button>
                )}
              </div>
              {/* progreso al siguiente hito */}
              {sd.nextMilestone != null && (() => {
                const span = sd.nextMilestone - sd.prevMilestone
                const pct = span > 0 ? ((sd.streak - sd.prevMilestone) / span) * 100 : 0
                return (
                  <>
                    <div style={{ marginBottom: 6 }}>
                      <ProgressBar pct={pct} />
                    </div>
                    <div className="sm" style={{ color: 'var(--ink-700)' }}>Próximo hito: {sd.nextMilestone} días · faltan {sd.nextMilestone - sd.streak}</div>
                  </>
                )
              })()}
            </Card>

          </div>
        </PremiumGate>

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 4 }}>
          Resumen de tu registro personal. La adherencia mide tu consistencia, no la eficacia ni un resultado clínico.
        </motion.p>
      </motion.div>
    </div>
  )
}
