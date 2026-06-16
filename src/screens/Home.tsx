// Tab 'inicio' — dashboard de wellness premium "Quiet Signal".
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp, adherenceMonth, weekStatus, computeStreak, STREAK_GOAL } from '../lib/store'
import { CATEGORY_COLOR, CATEGORY_ICON, MEASURE_ICON, MEASURE_META, WDS } from '../lib/catalog'
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

// ── componente ───────────────────────────────────────────────────────────────

export function Home() {
  const { state, dispatch } = useApp()

  // Cuenta regresiva en tiempo real (refresca cada 30 s)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

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

  return (
    <div className="scroll has-nav">
      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
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
                marginBottom: 6,
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

        {/* Protocolo activo SIN dosis hoy → cuenta regresiva (si hay dosis hoy, manda el checklist) */}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Glyph name="dose" color={catColor} size={20} />
              <span
                className="sm mono"
                style={{
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: catColor,
                }}
              >
                Próxima toma
              </span>
            </div>

            {/* Producto */}
            <h2
              className="h2"
              style={{ margin: '0 0 4px', color: 'var(--ink-900)' }}
            >
              {nextProduct || state.protocol?.product}
            </h2>

            {/* Cuenta regresiva hero */}
            {countdownText && (
              <motion.div
                key={countdownText}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Próxima toma de ${nextProduct || state.protocol?.product}: ${countdownText}`}
                style={{ margin: '0 0 20px' }}
              >
                <p
                  className="display-l mono"
                  style={{
                    margin: 0,
                    letterSpacing: -0.5,
                    lineHeight: 1,
                    color: isNow ? catColor : 'var(--ink-700)',
                  }}
                >
                  {countdownText}
                </p>
              </motion.div>
            )}
            {!countdownText && (
              <p className="sm" style={{ margin: '0 0 20px', color: 'var(--ink-400)' }}>
                Según tu cadencia
              </p>
            )}

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
            // Todavía no vence ninguna dosis este mes → estado neutral (no es 100%)
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
              <p
                className="sm"
                style={{ color: 'var(--ink-400)', textAlign: 'center', marginTop: 10 }}
              >
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
                width: 152,
                height: 152,
                borderRadius: '50%',
                border: '11px solid var(--ink-100)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span className="sm" style={{ color: 'var(--ink-300)', textAlign: 'center', maxWidth: 100, lineHeight: 1.3 }}>
                Sin protocolo aún
              </span>
            </div>
          )}

          {/* Tira semanal */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 24,
              justifyContent: 'center',
              width: '100%',
            }}
          >
            {weekLabels.map((label, idx) => {
              const filled = weekBits[idx]
              const isToday = idx === todayWdsIdx
              // Fecha del día en la tira (L=lunes de esta semana…)
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
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    className="sm"
                    style={{
                      fontSize: 10,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? catColor : 'var(--ink-400)',
                      letterSpacing: 0.2,
                    }}
                  >
                    {label}
                  </span>
                  <div
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                    aria-label={`${dayStr} — ${estado}`}
                  >
                    <motion.div
                      animate={{ backgroundColor: dotBg }}
                      transition={{ duration: dur.fast }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: isToday ? `2px solid ${catColor}` : '2px solid transparent',
                      }}
                    />
                    {/* Punto blanco bajo el dot cuando es hoy y ya está completado */}
                    {isToday && filled && (
                      <div
                        aria-hidden="true"
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          bottom: -6,
                        }}
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

              return (
                <motion.div
                  key={m}
                  variants={staggerItem}
                  className="card"
                  role="button"
                  tabIndex={0}
                  onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
                  onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? dispatch({ t: 'sheet', sheet: 'registrar' }) : undefined}
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    {iconMeta && (
                      <Glyph name={iconMeta.icon} color={accentColor} size={16} />
                    )}
                    <p
                      className="sm"
                      style={{
                        color: 'var(--ink-400)',
                        fontWeight: 500,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m}
                    </p>
                  </div>

                  {/* Número hero */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 4,
                      marginBottom: 'auto',
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 30,
                        fontWeight: 700,
                        lineHeight: 1,
                        color: hasValue ? 'var(--ink-900)' : 'var(--ink-300)',
                      }}
                    >
                      {hero}
                    </span>
                    {unit && hasValue && (
                      <span className="sm" style={{ color: 'var(--ink-400)' }}>
                        {unit}
                      </span>
                    )}
                  </div>

                  {/* Mini sparkline solo si hay ≥2 muestras reales */}
                  {sparkData && (
                    <div style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <Sparkline data={sparkData} color={accentColor} w={72} h={26} />
                    </div>
                  )}

                  {/* Estado inicial si no hay dato */}
                  {!hasValue && (
                    <p
                      className="sm"
                      style={{
                        color: 'var(--ink-300)',
                        margin: '6px 0 0',
                        fontSize: 11,
                      }}
                    >
                      Toca para registrar
                    </p>
                  )}
                </motion.div>
              )
            })}
          </motion.section>
        )}

        {/* ── 5. Disclaimer ────────────────────────────────────────────── */}
        <motion.div variants={staggerItem}>
          <Disclaimer kind="general" />
        </motion.div>
      </motion.div>
    </div>
  )
}
