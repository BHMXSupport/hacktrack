// ResumenSemanal — recap de 7 días + perspectivas Plus (premium).
// Muestra los datos DEL USUARIO por protocolo (puede nombrar el producto). App Store: el copy no
// afirma causalidad/eficacia ni recomienda dosis; "desde que iniciaste <producto>" es solo el ancla temporal.
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Glyph } from '../components/glyphs'
import { useApp, adherence, isoKey } from '../lib/store'
import {
  protocolNumbers, tdee, avgKcal, weightProjection, compositeStreak, weeklyInsights, streakDetail, anchorProduct, protocolList,
  getGlassMl, glassesToLiters, waterGoalLiters,
} from '../lib/nutrition'
import { Sparkline, TrendChart, R2Chip } from '../components/charts'
import { EmptyState } from '../components/EmptyState'
import { PremiumGate } from '../components/PremiumGate'
import type { Actividad, Sexo } from '../lib/types'
import { staggerParent, staggerItem, dur, ease } from '../lib/motion'
import {
  DAY,
  calcR2,
  Accordion,
  Card,
  fmtDate,
  ProgressBar,
  WellnessRing,
  ComparativaCard,
  StreakWeekCard,
  AdherenciaProyeccionCard,
  ProductCards,
  TrendsCard,
  classifyInsights,
  INSIGHT_GLYPH,
  INSIGHT_BG,
  INSIGHT_COL,
} from './ResumenSemanalParts'

const ACT_LABEL: { v: Actividad; l: string }[] = [
  { v: 'sedentario', l: 'Sedentario' }, { v: 'ligero', l: 'Ligero' }, { v: 'moderado', l: 'Moderado' }, { v: 'activo', l: 'Activo' }, { v: 'muy-activo', l: 'Muy activo' },
]

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

  // ── Delta semana actual vs semana previa ──
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

  // Agua en LITROS (vasos no son comparables entre tamaños): consumido = vasos × ml real; meta calibrada a 250ml
  const glassMl = getGlassMl()
  const waterAvgRaw = waterDays.length ? waterDays.reduce((a, b) => a + b, 0) / waterDays.length : 0
  const waterAvgL = glassesToLiters(waterAvgRaw, glassMl)
  const waterGoalL = waterGoalLiters(state.profile.peso)
  const waterPrevAvgRaw = waterPrevDays.length ? waterPrevDays.reduce((a, b) => a + b, 0) / waterPrevDays.length : null
  const waterDeltaL = waterPrevAvgRaw != null ? Math.round((waterAvgL - glassesToLiters(waterPrevAvgRaw, glassMl)) * 10) / 10 : null

  const avg7 = avgKcal(state, 7)
  const streak = compositeStreak(state)
  const sd = streakDetail(state)

  // datos premium — memoizados
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

  // ── WellnessScore ──
  const wellnessScore = useMemo(() => {
    const adhScore = adh ? adh.pct * 0.4 : 0
    // días que alcanzaron la meta de agua EN LITROS (no en vasos, que dependen del tamaño)
    const waterScore = (waterDays.filter((g) => glassesToLiters(g, glassMl) >= waterGoalL).length / 7) * 100 * 0.25
    const mealScore = (kcalDays.length / 7) * 100 * 0.20
    // variación de peso → 15%: si hay tendencia y va hacia la meta, full; sino proporcional
    let weightScore = 0
    if (proj?.slopePerDay != null && state.profile.metaPesoKg != null) {
      const good = Math.sign(proj.slopePerDay) === Math.sign(state.profile.metaPesoKg - proj.current)
      weightScore = good ? 15 : 0
    }
    return Math.round(adhScore + waterScore + mealScore + weightScore)
  }, [adh, waterDays, kcalDays, proj, state.profile])

  // ── Mini-header sticky ──
  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      setShowStickyHeader(!entry.isIntersecting)
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── CTA dinámico de racha ──
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

  // ── Compartir semana Web Share API ──
  const handleShare = useCallback(async () => {
    const text = `Racha de ${streak} ${streak === 1 ? 'día' : 'días'} · ${adh ? adh.pct + '%' : '—'} adherencia · ${avg7 != null ? avg7 + ' kcal/día' : '—'} — via Hacktrack`
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

  // ── Aviso déficit calórico agresivo ──
  const caloricDeficit = avg7 != null && t != null ? avg7 - t : null
  const severeDeficit = caloricDeficit != null && caloricDeficit < -500
  const veryDeficit = caloricDeficit != null && caloricDeficit < -1000

  return (
    <div className="scroll has-nav">
      {/* ── Mini-header sticky ── */}
      <AnimatePresence>
        {showStickyHeader && (
          // wrapper fijo centrado al ancho del .phone (no se sale en desktop/PWA ancha).
          // El translateX(-50%) vive aquí para no chocar con la animación y de framer-motion.
          <div style={{
            position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: 'min(412px, 100%)', zIndex: 50, boxSizing: 'border-box',
          }}>
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ duration: dur.base, ease: ease.decelerate }}
              style={{
                background: 'var(--bg)', borderBottom: '1px solid var(--border)',
                padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {streak > 0 && (
                <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 700 }}><Glyph name="racha" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />{streak}d</span>
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
          </div>
        )}
      </AnimatePresence>

      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Header con WellnessRing + Compartir ── */}
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
        <Card title="Adherencia" subtitle={adh ? `${adh.taken} de ${adh.due} dosis programadas` : 'Sin protocolo activo'}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-700)', lineHeight: 1 }}>{adh ? `${adh.pct}%` : '—'}</div>
            {/* Delta vs semana previa */}
            {adhDelta != null && Math.abs(adhDelta) >= 1 && (
              <span className="sm mono" style={{ color: adhDelta >= 0 ? 'var(--success)' : 'var(--warning)' }}>
                {adhDelta >= 0 ? '▲' : '▼'} {Math.abs(adhDelta)} pp vs sem. anterior
              </span>
            )}
          </div>
        </Card>

        {/* Rejilla 2+1: Dosis + Hidratación arriba al 50/50, Calorías full-width abajo */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Card title="Dosis" subtitle="registradas esta semana"><div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>{doses}</div></Card></div>
          <div style={{ flex: 1 }}>
            <Card title="Hidratación" subtitle={`Promedio/día vs meta (${waterGoalL} L)`}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                  {waterAvgL}<span className="sm" style={{ color: 'var(--ink-400)' }}> / {waterGoalL} L</span>
                </div>
                {waterDeltaL != null && Math.abs(waterDeltaL) >= 0.1 && (
                  <span className="sm mono" style={{ color: waterDeltaL >= 0 ? 'var(--success)' : 'var(--warning)', fontSize: 11 }}>
                    {waterDeltaL >= 0 ? '▲' : '▼'} {Math.abs(waterDeltaL)} L
                  </span>
                )}
              </div>
              <div style={{ marginTop: 8 }}>
                <ProgressBar pct={waterGoalL > 0 ? (waterAvgL / waterGoalL) * 100 : 0} color="var(--brand-300)" />
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
          {/* Aviso déficit agresivo observacional */}
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
                  ? <><Glyph name="efecto" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />Déficit muy elevado ({'>'}{Math.abs(caloricDeficit!)} kcal) — solo como dato de registro.</>
                  : `Déficit elevado (${Math.abs(caloricDeficit!)} kcal/día) — solo como dato de registro.`}
              </span>
            </div>
          )}
        </Card>

        {/* ── Señales con clasificación visual ── */}
        <Card title="Señales de la semana">
          {insights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
                  borderRadius: 'var(--r-sm)', background: INSIGHT_BG[ins.type],
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', color: INSIGHT_COL[ins.type], flexShrink: 0, marginTop: 1 }}>
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
                  {/* label visible + validación de rango */}
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

            {/* ── Grupo: Adherencia y racha (abierto por defecto) ── */}
            <Accordion title="Adherencia y racha" defaultOpen>
              {/* Racha semanal con mini-timeline */}
              <StreakWeekCard />
              {/* Proyección de adherencia mensual */}
              <AdherenciaProyeccionCard />
              {/* Racha y hitos con CTA dinámico */}
              <Card title="Racha y hitos" subtitle="Días seguidos con dosis, agua y comida">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand-700)' }}>{sd.streak}</span>
                  <span className="sm" style={{ color: 'var(--ink-400)' }}>{sd.streak === 1 ? 'día' : 'días'} de racha</span>
                </div>
                {/* condiciones de hoy */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {([['Dosis', sd.today.dose], ['Agua', sd.today.water], ['Comida', sd.today.meal]] as const).map(([lbl, ok]) => (
                    <span key={lbl} className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: ok ? 'var(--brand-100)' : 'var(--ink-100)', color: ok ? 'var(--brand-700)' : 'var(--ink-400)', fontWeight: 600, maxWidth: '100%' }}>
                      <Glyph name={ok ? 'check' : 'cross'} size={13} color="currentColor" /> {lbl}
                    </span>
                  ))}
                </div>
                {/* CTA dinámico */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span className="sm" style={{
                    color: sd.today.dose && sd.today.water && sd.today.meal ? 'var(--success)' : 'var(--ink-700)',
                    flex: 1, minWidth: 0, lineHeight: 1.4,
                  }}>
                    {streakCta}
                  </span>
                  {!(sd.today.dose && sd.today.water && sd.today.meal) && (
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ flexShrink: 0 }}
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
            </Accordion>

            {/* ── Grupo: Peso y proyección ── */}
            <Accordion title="Peso y proyección" subtitle="Tu protocolo en números, comparativa y meta">

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

            {/* Proyección de meta (ghost cuando no hay meta) */}
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

            </Accordion>

            {/* ── Grupo: Por producto ── */}
            <Accordion title="Por producto" subtitle="Tus métricas por protocolo">
              {/* Progreso por producto — expandible */}
              <ProductCards />
            </Accordion>

            {/* ── Grupo: Energía / TDEE ── */}
            {t != null && (
              <Accordion title="Energía / TDEE" subtitle="Tu consumo vs tu gasto estimado">
                <Card title="Margen energético" subtitle="Tu consumo vs tu gasto estimado">
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div><div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{t}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal gasto est.</div></div>
                    <div><div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{avg7 ?? '—'}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>kcal consumo 7d</div></div>
                    {avg7 != null && (() => { const m = avg7 - t; return (
                      <div><div className="mono" style={{ fontSize: 22, fontWeight: 800, color: m < 0 ? 'var(--brand-700)' : 'var(--warning)' }}>{m > 0 ? '+' : ''}{m}</div><div className="sm" style={{ color: 'var(--ink-400)' }}>{m < 0 ? 'déficit' : 'superávit'}</div></div>
                    ) })()}
                  </div>
                </Card>
              </Accordion>
            )}

          </div>
        </PremiumGate>

        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-300)', lineHeight: 1.4, borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 4 }}>
          Resumen de tu registro personal. La adherencia mide tu consistencia, no la eficacia ni un resultado clínico.
        </motion.p>
      </motion.div>
    </div>
  )
}
