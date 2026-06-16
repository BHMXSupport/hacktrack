// Tab 'inicio' — dashboard de wellness premium "Quiet Signal".
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useReducedMotion, useMotionValue, animate, AnimatePresence } from 'framer-motion'
import { useApp, adherenceMonth, weekStatus, isoKey } from '../lib/store'
import { CATEGORY_COLOR, MEASURE_ICON, MEASURE_META, WDS } from '../lib/catalog'
import { AdherenceRing } from '../components/AdherenceRing'
import { Disclaimer } from '../components/controls'
import { Sparkline } from '../components/charts'
import { Glyph } from '../components/glyphs'
import { UserAvatar, TrustChip } from '../components/identity'
import { TodayDoses } from '../components/TodayDoses'
import { ActiveNowChips } from '../components/ActiveNowChips'
import { LastDoseLine } from '../components/LastDoseLine'
import { dayProducts, upcomingDoses } from '../lib/calendar'
import { startOfDay } from '../lib/cadence'
import { dur, ease, spring, staggerParent, staggerItem } from '../lib/motion'
import { weightProjection, weeklyInsights, waterGoalGlasses, protocolStartTs } from '../lib/nutrition'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Diferencia en minutos entre dos fechas (at − now). */
function diffMinutes(at: Date, now: Date): number {
  return Math.round((at.getTime() - now.getTime()) / 60000)
}

/** Formatea la cuenta regresiva en texto legible. */
function fmtCountdown(at: Date, now: Date): string {
  const mins = diffMinutes(at, now)
  if (mins <= 0) return 'es ahora'
  if (mins < 60) return `en ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `en ${h}h` : `en ${h}h ${m}m`
}

/** Número hero para KPI card. */
function kpiHero(name: string, vals: Record<string, number>): string {
  const v = vals[name]
  if (v == null) return '—'
  return String(v)
}

/** Unidad para KPI card. */
function kpiUnit(name: string, vals: Record<string, number>): string {
  const v = vals[name]
  if (v == null) return ''
  const meta = MEASURE_META[name]
  if (!meta) return ''
  if (meta.kind === 'scale') return `/ ${meta.max}`
  return meta.unit ?? ''
}

/** Calcula los minutos totales hasta `at` desde `now` como número entero. */
function countdownMinutes(at: Date | null, now: Date): number {
  if (!at) return 0
  return Math.max(0, diffMinutes(at, now))
}

/** Count-up animado para un valor numérico: hook que retorna un motion.span. */
function useCountUp(value: number, skip: boolean) {
  const mv = useMotionValue(skip ? value : 0)
  const displayRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (skip) { mv.set(value); return }
    const ctrl = animate(mv, value, { duration: dur.slow, ease: ease.decelerate })
    const unsub = mv.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = String(Math.round(v))
    })
    return () => { ctrl.stop(); unsub() }
  }, [value, skip]) // eslint-disable-line react-hooks/exhaustive-deps
  return displayRef
}

/** Delta KPI: diferencia entre los dos últimos valores de la serie. */
function kpiDelta(
  name: string,
  history: Record<string, { ts: number; value: number }[]>,
): { diff: number; positive: boolean } | null {
  const series = history[name]
  if (!series || series.length < 2) return null
  const sorted = [...series].sort((a, b) => a.ts - b.ts)
  const last = sorted[sorted.length - 1].value
  const prev = sorted[sorted.length - 2].value
  const diff = Math.round((last - prev) * 10) / 10
  if (diff === 0) return null
  const meta = MEASURE_META[name]
  const down = meta?.down ?? false
  // "positive" = buena dirección (verde); si down=true, positivo cuando diff<0
  const positive = down ? diff < 0 : diff > 0
  return { diff, positive }
}

/** Delta KPI desde inicio del protocolo. */
function kpiDeltaStart(
  name: string,
  history: Record<string, { ts: number; value: number }[]>,
  startTs: number | null,
): { diff: number; positive: boolean } | null {
  if (!startTs) return null
  const series = history[name]
  if (!series || series.length < 2) return null
  const sorted = [...series].sort((a, b) => a.ts - b.ts)
  const last = sorted[sorted.length - 1].value
  // primer valor desde el inicio del protocolo (o el más cercano antes)
  const fromStart = sorted.find((s) => s.ts >= startTs) ?? sorted[0]
  if (fromStart.ts === sorted[sorted.length - 1].ts) return null // solo una muestra
  const diff = Math.round((last - fromStart.value) * 10) / 10
  if (diff === 0) return null
  const meta = MEASURE_META[name]
  const down = meta?.down ?? false
  const positive = down ? diff < 0 : diff > 0
  return { diff, positive }
}

// ── componente ───────────────────────────────────────────────────────────────

export function Home() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion() ?? false

  // Cuenta regresiva en tiempo real (refresca cada 30 s)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // ── Loop 163: Pull-to-refresh ────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false)
  const pullY = useMotionValue(0)
  const PULL_THRESHOLD = 60
  const handlePanStart = useCallback(() => { pullY.set(0) }, [pullY])
  const handlePan = useCallback((_e: PointerEvent, info: { delta: { y: number } }) => {
    if (typeof window !== 'undefined' && window.scrollY > 0) return
    const next = Math.max(0, Math.min(PULL_THRESHOLD * 1.5, pullY.get() + info.delta.y))
    pullY.set(next)
  }, [pullY])
  const handlePanEnd = useCallback(() => {
    if (pullY.get() >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true)
      pullY.set(0)
      // recomputar todayTs para forzar re-render de derivados
      dispatch({ t: 'tick' })
      setTimeout(() => setRefreshing(false), 800)
    } else {
      animate(pullY, 0, { duration: dur.fast })
    }
  }, [pullY, refreshing, dispatch])

  const today = new Date(state.todayTs)

  // Saludo
  const name = state.profile.name
  const greeting = name ? `Hola, ${name}` : 'Hola'

  // Fecha formateada
  const todayStr = today.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Color de categoría activa
  const catColor = state.curGoal ? CATEGORY_COLOR[state.curGoal] : 'var(--brand-700)'

  // ¿hay dosis programadas hoy? → muestra el checklist "hecho hoy" en vez del countdown
  const hasDosesToday = dayProducts(state, startOfDay(now)).length > 0
  // Próxima toma con cuenta regresiva real — la MÁS CERCANA entre TODOS los productos activos
  const upNext = upcomingDoses(state, now, 1)[0]
  const at = upNext?.date ?? null
  const nextProduct = upNext?.product ?? ''
  const countdownText = at ? fmtCountdown(at, now) : null
  const isNow = at ? diffMinutes(at, now) <= 0 : false

  // ── Loop 152: count-up del countdown en minutos ──────────────────────────
  const countdownMins = countdownMinutes(at, now)
  const countdownRef = useCountUp(countdownMins, reduce || !at)

  // Adherencia real del MES (multi-producto: todas las dosis que tocarían este mes)
  const adh = adherenceMonth(state, now)

  // Tira semanal (L Ma Mi J V S D)
  const weekBits = weekStatus(state.log, today, true)
  const weekLabels = WDS.map(([l]) => l)
  // índice del día de hoy en WDS (L=0..D=6); getDay: 0=Dom → índice 6
  const todayWdsIdx = [1, 2, 3, 4, 5, 6, 0][today.getDay()]

  // KPI cards: máx 4 medidas seleccionadas
  const kpiMeasures = state.selectedMeasures.slice(0, 4)

  // Estado para decidir si hay protocolo o no
  const hasProtocol = !!state.protocol

  // ── Loop 144 + 145: deltas KPI ───────────────────────────────────────────
  const protoStartTs = protocolStartTs(state)

  // ── Loop 148: modo compacto si >2 medidas ────────────────────────────────
  const compactMode = kpiMeasures.length > 2

  // ── Loop 159: Resumen semana colapsable ──────────────────────────────────
  const [weekSummaryOpen, setWeekSummaryOpen] = useState(false)
  const insights = weeklyInsights(state)
  const weekAdh = adh ? Math.round(adh.pct) : null

  // ── Loop 160: Card proyección de peso ────────────────────────────────────
  const proj = weightProjection(state)
  const showProjection = proj !== null && proj.etaTs !== null

  // ── Loop 161: Widget hidratación ─────────────────────────────────────────
  const todayKey = isoKey(state.todayTs)
  const waterToday = state.nutrition[todayKey]?.water ?? 0
  const waterGoal = state.profile.peso ? waterGoalGlasses(state.profile.peso) : 8

  // ── Loop 153: Barra de ventana de toma ───────────────────────────────────
  // Ventana de ±30min alrededor del horario de toma
  const windowMinutes = 30
  const minsUntilDose = at ? diffMinutes(at, now) : null
  const inWindow = minsUntilDose !== null && Math.abs(minsUntilDose) <= windowMinutes
  // posición 0..1 dentro de la barra: 0=–window, 0.5=exact, 1=+window
  const barPos = minsUntilDose !== null
    ? Math.max(0, Math.min(1, (windowMinutes - minsUntilDose) / (windowMinutes * 2)))
    : 0

  return (
    <div className="scroll has-nav" style={{ position: 'relative' }}>
      {/* ── Loop 163: Pull-to-refresh spinner ─────────────────────────────── */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            key="ptr-spinner"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: dur.fast }}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--brand-500)',
                  display: 'block',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        onPanStart={handlePanStart}
        onPan={handlePan as Parameters<typeof motion.div>[0]['onPan']}
        onPanEnd={handlePanEnd as Parameters<typeof motion.div>[0]['onPanEnd']}
        style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >

        {/* ── 1. Cabecera: saludo + avatar + trust chip ────────────────── */}
        <motion.section
          variants={staggerItem}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <p
              className="sm"
              style={{ color: 'var(--ink-400)', textTransform: 'capitalize', margin: 0 }}
            >
              {todayStr}
            </p>
            <h1
              className="h1"
              style={{ margin: 0, lineHeight: 1.1, wordBreak: 'break-word' }}
            >
              {greeting}
            </h1>
            {/* Micro-chip de confianza */}
            <div style={{ marginTop: 8 }}>
              <TrustChip onClick={() => dispatch({ t: 'sheet', sheet: 'perfil' })} />
            </div>
          </div>

          {/* Avatar — desplazado a la izquierda para no chocar con el engranaje global */}
          <div style={{ marginRight: 44, flexShrink: 0 }}>
            <UserAvatar size={48} tone="filled" />
          </div>
        </motion.section>

        {/* ── 1b. Checklist "Tus dosis de hoy" (1-tap, sin escribir) ──── */}
        <motion.div variants={staggerItem}>
          <TodayDoses />
        </motion.div>

        {/* ── 1c. "Activo ahora": péptidos con presencia estimada → Cuerpo ── */}
        <motion.div variants={staggerItem}>
          <ActiveNowChips />
        </motion.div>

        {/* ── Loop 161: Widget de hidratación ───────────────────────────── */}
        <motion.div
          variants={staggerItem}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Hidratación hoy
            </p>
            <p className="sm mono" style={{ margin: 0, color: 'var(--ink-400)' }}>
              {waterToday}/{waterGoal} vasos
            </p>
          </div>
          <div
            role="group"
            aria-label={`Hidratación: ${waterToday} de ${waterGoal} vasos`}
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
          >
            {Array.from({ length: waterGoal }).map((_, i) => {
              const filled = i < waterToday
              const isNext = i === waterToday
              return (
                <motion.button
                  key={i}
                  aria-label={filled ? `Vaso ${i + 1} — completado, toca para quitar` : `Vaso ${i + 1} — toca para agregar`}
                  whileHover={!reduce ? { scale: 1.12 } : undefined}
                  whileTap={!reduce ? { scale: 0.92 } : undefined}
                  transition={spring.ui}
                  onClick={() => dispatch({ t: 'water', delta: filled ? -1 : 1 })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    background: filled
                      ? 'var(--brand-500)'
                      : 'var(--ink-100)',
                    outline: isNext ? `2px solid var(--brand-300)` : 'none',
                    outlineOffset: 1,
                    transition: `background ${dur.fast}s`,
                  }}
                />
              )
            })}
          </div>
        </motion.div>

        {/* ── 1d. "Última toma": evita la duda de doble-dosis ── */}
        <motion.div variants={staggerItem}>
          <LastDoseLine />
        </motion.div>

        {/* ── 2. HÉROE: próxima toma con cuenta regresiva real ────────── */}
        {!state.logged && !hasProtocol && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{
              background: 'linear-gradient(135deg, #0E5A52 0%, #1B8A7D 100%)',
              border: 0,
              boxShadow: 'var(--e2)',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -28,
                top: -28,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                pointerEvents: 'none',
              }}
            />
            <p
              className="sm"
              style={{
                color: '#acefe4',
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                margin: '0 0 6px',
              }}
            >
              Empieza aquí
            </p>
            <h2
              className="h2"
              style={{ color: '#fff', margin: '0 0 16px', fontWeight: 700 }}
            >
              Registra tu primer dato hoy
            </h2>
            <motion.button
              className="btn btn-ember"
              style={{ height: 48, width: '100%' }}
              whileTap={{ scale: 0.96 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
            >
              Registrar ahora
            </motion.button>
          </motion.div>
        )}

        {/* Sin protocolo pero ya tiene registros → CTA crear protocolo */}
        {!hasProtocol && state.logged && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              borderLeft: `3px solid ${catColor}`,
            }}
          >
            <p className="body" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Sin protocolo activo
            </p>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
              Crea tu protocolo para ver la cuenta regresiva y tu adherencia.
            </p>
            <motion.button
              className="btn btn-brand"
              style={{ width: '100%', height: 44 }}
              whileTap={{ scale: 0.96 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'tab', tab: 'protocolo' })}
            >
              Crear protocolo
            </motion.button>
          </motion.div>
        )}

        {/* Protocolo activo SIN dosis hoy → cuenta regresiva */}
        {hasProtocol && !hasDosesToday && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderLeft: `3px solid ${catColor}`,
            }}
          >
            {/* Decoración cuadrante */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: 100,
                height: 100,
                background: catColor,
                opacity: 0.05,
                borderBottomLeftRadius: '100%',
                pointerEvents: 'none',
              }}
            />

            {/* Etiqueta + ícono de dosis */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Glyph name="dose" color={catColor} size={20} />
              <span
                className="sm mono"
                style={{ fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: catColor }}
              >
                Próxima toma
              </span>
            </div>

            {/* Producto */}
            <h2 className="h2" style={{ margin: '0 0 4px', color: 'var(--ink-900)' }}>
              {nextProduct || state.protocol?.product}
            </h2>

            {/* ── Loop 152: cuenta regresiva con count-up animado ───────── */}
            {countdownText && (
              <motion.div
                key={countdownText}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Próxima toma de ${nextProduct || state.protocol?.product}: ${countdownText}`}
                style={{ margin: '0 0 8px' }}
              >
                {isNow ? (
                  <p
                    className="display-l mono"
                    style={{ margin: 0, letterSpacing: -0.5, lineHeight: 1, color: catColor }}
                  >
                    es ahora
                  </p>
                ) : (
                  <p
                    className="display-l mono"
                    style={{ margin: 0, letterSpacing: -0.5, lineHeight: 1, color: 'var(--ink-700)' }}
                  >
                    {/* count-up del número de minutos/horas; unidades estáticas */}
                    {countdownMins >= 60 ? (
                      <>
                        en{' '}
                        <span ref={countdownRef}>{Math.floor(countdownMins / 60)}</span>
                        h{countdownMins % 60 > 0 ? ` ${countdownMins % 60}m` : ''}
                      </>
                    ) : (
                      <>
                        en <span ref={countdownRef}>{countdownMins}</span> min
                      </>
                    )}
                  </p>
                )}
              </motion.div>
            )}
            {!countdownText && (
              <p className="sm" style={{ margin: '0 0 8px', color: 'var(--ink-400)' }}>
                Según tu cadencia
              </p>
            )}

            {/* ── Loop 153: Barra de ventana de toma ───────────────────── */}
            {at && (
              <div
                style={{ position: 'relative', height: 4, borderRadius: 999, background: 'var(--ink-100)', marginBottom: 20, overflow: 'hidden' }}
                aria-hidden="true"
              >
                {/* zona verde = ventana de toma */}
                <div
                  style={{
                    position: 'absolute',
                    left: '25%',
                    right: '25%',
                    top: 0,
                    bottom: 0,
                    background: inWindow ? catColor : 'var(--ink-300)',
                    opacity: 0.4,
                    borderRadius: 999,
                    transition: `background ${dur.base}s`,
                  }}
                />
                {/* marcador de posición actual */}
                <motion.div
                  animate={{ left: `${barPos * 100}%` }}
                  transition={{ duration: dur.base, ease: ease.decelerate }}
                  style={{
                    position: 'absolute',
                    top: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: inWindow ? catColor : 'var(--ink-400)',
                    transform: 'translateX(-50%)',
                    transition: `background ${dur.base}s`,
                  }}
                />
              </div>
            )}
            {!at && <div style={{ marginBottom: 20 }} />}

            <motion.button
              className="btn btn-brand"
              style={{ width: '100%', height: 48 }}
              whileTap={{ scale: 0.96 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
            >
              Registrar
            </motion.button>
          </motion.div>
        )}

        {/* ── 3. Adherencia real 30 días + tira semanal ───────────────── */}
        <motion.section
          variants={staggerItem}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 20px' }}
        >
          <h2
            className="body"
            style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 20, textAlign: 'center' }}
          >
            Adherencia · este mes
          </h2>

          {adh && adh.due === 0 ? (
            <div
              style={{
                width: 152, height: 152, borderRadius: '50%', border: '11px solid var(--ink-100)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center',
              }}
            >
              <span className="h2" style={{ margin: 0 }}>{adh.scheduled}</span>
              <span className="sm" style={{ color: 'var(--ink-400)', maxWidth: 110, lineHeight: 1.3 }}>
                dosis este mes · aún sin vencer
              </span>
            </div>
          ) : adh ? (
            <>
              <AdherenceRing
                value={adh.pct}
                goal={100}
                size={152}
                stroke={11}
                label="adherencia"
                unit="%"
              />
              <p className="sm" style={{ color: 'var(--ink-400)', textAlign: 'center', marginTop: 10 }}>
                {adh.taken} de {adh.due} tomadas · {adh.scheduled} este mes
              </p>
              {(adh.missed > 0 || adh.upcoming > 0) && (
                <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {adh.missed > 0 && (
                    <span className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--error)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--error)' }} />
                      {adh.missed} perdida{adh.missed === 1 ? '' : 's'}
                    </span>
                  )}
                  {adh.upcoming > 0 && (
                    <span className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-400)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ink-300)' }} />
                      {adh.upcoming} próxima{adh.upcoming === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                width: 152, height: 152, borderRadius: '50%', border: '11px solid var(--ink-100)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <span className="sm" style={{ color: 'var(--ink-300)', textAlign: 'center', maxWidth: 100, lineHeight: 1.3 }}>
                Sin protocolo aún
              </span>
            </div>
          )}

          {/* ── Tira semanal — Loop 156: micro-spring dot al completarse ── */}
          <div
            style={{ display: 'flex', gap: 6, marginTop: 24, justifyContent: 'center', width: '100%' }}
          >
            {weekLabels.map((label, idx) => {
              const filled = weekBits[idx]
              const isToday = idx === todayWdsIdx
              const dayOffset = idx - todayWdsIdx
              const dayDate = new Date(today)
              dayDate.setDate(today.getDate() + dayOffset)
              const dayStr = dayDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
              const estado = filled ? 'completado' : isToday ? 'hoy, sin completar' : 'sin completar'
              const dotBg = filled
                ? catColor
                : isToday
                ? `color-mix(in srgb, ${catColor} 30%, transparent)`
                : 'var(--ink-100)'
              return (
                <div
                  key={label}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}
                >
                  <span
                    className="sm"
                    style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? catColor : 'var(--ink-400)', letterSpacing: 0.2 }}
                  >
                    {label}
                  </span>
                  <div
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                    aria-label={`${dayStr} — ${estado}`}
                  >
                    {/* Loop 156: spring celebrate cuando el día actual se completa; stagger fade-in días pasados */}
                    <motion.div
                      animate={{
                        backgroundColor: dotBg,
                        scale: (isToday && filled && !reduce) ? [0.6, 1.12, 1] : (idx < todayWdsIdx && filled && !reduce) ? [0.8, 1] : 1,
                      }}
                      transition={isToday && filled ? spring.celebrate : { duration: dur.fast }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: isToday ? `2px solid ${catColor}` : '2px solid transparent',
                      }}
                    />
                    {isToday && filled && (
                      <div
                        aria-hidden="true"
                        style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', position: 'absolute', bottom: -6 }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        {/* ── 4. KPI cards (máx 4, datos reales) ─────────────────────── */}
        {kpiMeasures.length > 0 && (
          <>
            {/* ── Loop 148: modo compacto (>2 medidas) vs grid 2×2 ─────── */}
            {compactMode ? (
              /* Scroll horizontal de chips compactos */
              <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    paddingBottom: 4,
                    scrollbarWidth: 'none',
                  }}
                  role="list"
                  aria-label="Métricas"
                >
                  {kpiMeasures.map((m) => {
                    const hasValue = state.measureValues[m] != null
                    const hero = kpiHero(m, state.measureValues)
                    const unit = kpiUnit(m, state.measureValues)
                    const iconMeta = MEASURE_ICON[m]
                    const accentColor = iconMeta?.cat ?? catColor
                    const delta = hasValue ? kpiDelta(m, state.history) : null

                    return (
                      <motion.button
                        key={m}
                        role="listitem"
                        whileHover={!reduce ? { scale: 1.02 } : undefined}
                        whileTap={!reduce ? { scale: 0.97 } : undefined}
                        transition={spring.ui}
                        onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
                        aria-label={`${m}: ${hero}${unit ? ' ' + unit : ''}`}
                        style={{
                          scrollSnapAlign: 'start',
                          flexShrink: 0,
                          minWidth: 120,
                          height: 72,
                          borderRadius: 'var(--r-md)',
                          background: 'var(--surface)',
                          border: '1px solid var(--ink-100)',
                          boxShadow: 'var(--e1)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          padding: '0 14px',
                          gap: 3,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {iconMeta && <Glyph name={iconMeta.icon} color={accentColor} size={13} />}
                          <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 500, fontSize: 11 }}>{m}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span className="mono" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: hasValue ? 'var(--ink-900)' : 'var(--ink-300)' }}>
                            {hero}
                          </span>
                          {unit && hasValue && <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>{unit}</span>}
                          {delta && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: delta.positive ? 'var(--success)' : 'var(--error)', marginLeft: 2 }}>
                              {delta.diff > 0 ? '+' : ''}{delta.diff}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
                {/* pip-indicator de puntos */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }} aria-hidden="true">
                  {kpiMeasures.map((_, i) => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === 0 ? 'var(--brand-500)' : 'var(--ink-100)' }} />
                  ))}
                </div>
              </motion.div>
            ) : (
              /* Grid 2×2 original — Loop 147: whileHover/whileTap + deltas 144/145 */
              <motion.section
                variants={staggerParent}
                initial="initial"
                animate="animate"
                style={{
                  display: 'grid',
                  gridTemplateColumns: kpiMeasures.length === 1 ? '1fr' : '1fr 1fr',
                  gap: 12,
                }}
              >
                {kpiMeasures.map((m) => {
                  const hasValue = state.measureValues[m] != null
                  const hero = kpiHero(m, state.measureValues)
                  const unit = kpiUnit(m, state.measureValues)
                  const realSeries = (state.history[m] ?? []).map((s) => s.value)
                  const sparkData = realSeries.length >= 2 ? realSeries : null
                  const iconMeta = MEASURE_ICON[m]
                  const accentColor = iconMeta?.cat ?? catColor
                  // Loop 144: delta vs anterior
                  const delta = hasValue ? kpiDelta(m, state.history) : null
                  // Loop 145: delta desde inicio del protocolo
                  const deltaStart = hasValue ? kpiDeltaStart(m, state.history, protoStartTs) : null
                  const firstSample = (state.history[m] ?? []).length === 1

                  return (
                    <motion.div
                      key={m}
                      variants={staggerItem}
                      className="card"
                      role="button"
                      tabIndex={0}
                      whileHover={!reduce ? { scale: 1.02 } : undefined}
                      whileTap={!reduce ? { scale: 0.97 } : undefined}
                      transition={spring.ui}
                      onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') ? dispatch({ t: 'sheet', sheet: 'registrar' }) : undefined}
                      aria-label={`${m}: ${hero}${unit ? ' ' + unit : ''}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '16px 14px',
                        minHeight: 120,
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Etiqueta + ícono */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        {iconMeta && <Glyph name={iconMeta.icon} color={accentColor} size={16} />}
                        <p
                          className="sm"
                          style={{ color: 'var(--ink-400)', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {m}
                        </p>
                      </div>

                      {/* Número hero con color semántico (Loop 144) */}
                      <AnimatePresence mode="wait">
                        {hasValue ? (
                          <motion.div
                            key="has-value"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: dur.fast }}
                            style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 'auto' }}
                          >
                            <span
                              className="mono"
                              style={{
                                fontSize: 30,
                                fontWeight: 700,
                                lineHeight: 1,
                                color: delta
                                  ? delta.positive ? 'var(--success)' : 'var(--error)'
                                  : 'var(--ink-900)',
                                transition: `color ${dur.base}s`,
                              }}
                            >
                              {hero}
                            </span>
                            {unit && (
                              <span className="sm" style={{ color: 'var(--ink-400)' }}>{unit}</span>
                            )}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="no-value"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: dur.fast }}
                            style={{ marginBottom: 'auto' }}
                          >
                            <span className="mono" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: 'var(--ink-300)' }}>—</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Loop 144: delta vs medición anterior */}
                      {delta && (
                        <p className="sm" style={{ margin: '4px 0 0', color: delta.positive ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                          {delta.diff > 0 ? '↑' : '↓'}{Math.abs(delta.diff)} vs. anterior
                        </p>
                      )}
                      {!delta && hasValue && !firstSample && (
                        <p className="sm" style={{ margin: '4px 0 0', color: 'var(--ink-300)' }}>sin cambio</p>
                      )}
                      {firstSample && (
                        <p className="sm" style={{ margin: '4px 0 0', color: 'var(--ink-300)' }}>— primera medición</p>
                      )}

                      {/* Loop 145: delta desde inicio del protocolo */}
                      {deltaStart && (
                        <p className="sm" style={{ margin: '2px 0 0', color: deltaStart.positive ? 'var(--success)' : 'var(--ink-300)', fontSize: 11 }}>
                          desde inicio: {deltaStart.diff > 0 ? '+' : ''}{deltaStart.diff}{unit ? ` ${unit}` : ''}
                        </p>
                      )}

                      {/* Mini sparkline */}
                      {sparkData && (
                        <div style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                          <Sparkline data={sparkData} color={accentColor} w={72} h={26} />
                        </div>
                      )}

                      {/* Estado inicial si no hay dato */}
                      {!hasValue && (
                        <p className="sm" style={{ color: 'var(--ink-300)', margin: '6px 0 0', fontSize: 11 }}>
                          Toca para registrar
                        </p>
                      )}
                    </motion.div>
                  )
                })}
              </motion.section>
            )}
          </>
        )}

        {/* ── Loop 160: Proyección de peso ──────────────────────────────── */}
        {showProjection && proj && (
          <motion.div
            variants={staggerItem}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '3px solid var(--brand-300)' }}
          >
            <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)' }}>
              Proyección de peso
            </p>
            <p className="body" style={{ margin: 0, color: 'var(--ink-900)' }}>
              A este ritmo llegarías a{' '}
              <span style={{ fontWeight: 700 }}>{proj.goal} kg</span>{' '}
              en{' '}
              <span style={{ fontWeight: 700 }}>
                {Math.ceil((proj.etaTs! - state.todayTs) / (1000 * 60 * 60 * 24 * 7))} semanas
              </span>
            </p>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
              Proyección lineal de tus propios datos — no es consejo médico.
            </p>
            <motion.button
              className="btn"
              style={{ width: '100%', height: 40, marginTop: 4, background: 'var(--ink-100)', color: 'var(--ink-700)' }}
              whileTap={{ scale: 0.97 }}
              transition={spring.ui}
              onClick={() => dispatch({ t: 'tab', tab: 'semana' })}
            >
              Ver proyección completa
            </motion.button>
          </motion.div>
        )}

        {/* ── Loop 159: Resumen semana colapsable ──────────────────────── */}
        {(insights.length > 0 || weekAdh !== null) && (
          <motion.div variants={staggerItem}>
            <motion.button
              onClick={() => setWeekSummaryOpen((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                border: '1px solid var(--ink-100)',
                borderRadius: 'var(--r-md)',
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: 'var(--e1)',
              }}
              whileTap={{ scale: 0.99 }}
              transition={spring.ui}
              aria-expanded={weekSummaryOpen}
            >
              <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>
                Esta semana
              </span>
              <motion.span
                animate={{ rotate: weekSummaryOpen ? 180 : 0 }}
                transition={{ duration: dur.fast }}
                style={{ display: 'block', color: 'var(--ink-400)', fontSize: 16, lineHeight: 1 }}
                aria-hidden="true"
              >
                ▾
              </motion.span>
            </motion.button>

            <AnimatePresence>
              {weekSummaryOpen && (
                <motion.div
                  key="week-summary"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: dur.base, ease: ease.decelerate }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className="card"
                    style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {weekAdh !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="sm" style={{ color: 'var(--ink-400)', minWidth: 90 }}>Adherencia</span>
                        <span className="sm mono" style={{ fontWeight: 700, color: weekAdh >= 80 ? 'var(--success)' : weekAdh >= 50 ? 'var(--warning)' : 'var(--error)' }}>
                          {weekAdh}%
                        </span>
                      </div>
                    )}
                    {insights.map((txt, i) => (
                      <p key={i} className="sm" style={{ margin: 0, color: 'var(--ink-700)', lineHeight: 1.5 }}>
                        {txt}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── 5. Disclaimer ────────────────────────────────────────────── */}
        <motion.div variants={staggerItem}>
          <Disclaimer kind="general" />
        </motion.div>
      </motion.div>
    </div>
  )
}
