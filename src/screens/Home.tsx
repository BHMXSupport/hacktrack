// Tab 'inicio' — tablero de control. Único archivo de salida para este agente.
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { computeStreak, nextDose, STREAK_GOAL } from '../lib/store'
import { CATEGORY_COLOR, CATEGORY_ICON, MEASURE_ICON, MEASURE_META } from '../lib/catalog'
import { fmtDate } from '../lib/cadence'
import { AdherenceRing } from '../components/AdherenceRing'
import { Disclaimer } from '../components/controls'
import { Sparkline, LineChart } from '../components/charts'
import { Glyph } from '../components/glyphs'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

// ── helpers ──────────────────────────────────────────────────────────────────

/** Formatea el valor de una KPI card: "4 / 5" (escala) o "82.4 kg" (num). "—" si no hay dato. */
function kpiDisplay(name: string, measureValues: Record<string, number>): string {
  const v = measureValues[name]
  if (v == null) return '—'
  const meta = MEASURE_META[name]
  if (!meta) return String(v)
  return meta.kind === 'scale'
    ? `${v} / ${meta.max}`
    : `${v}${meta.unit ? ' ' + meta.unit : ''}`
}

/** Extrae la parte numérica hero (antes del espacio o barra) para el número grande. */
function kpiHero(name: string, measureValues: Record<string, number>): string {
  const v = measureValues[name]
  if (v == null) return '—'
  return String(v)
}

/** Unidad para el hero (parte después del espacio). */
function kpiUnit(name: string, measureValues: Record<string, number>): string {
  const v = measureValues[name]
  if (v == null) return ''
  const meta = MEASURE_META[name]
  if (!meta) return ''
  if (meta.kind === 'scale') return `/ ${meta.max}`
  return meta.unit ?? ''
}

// ── componente ───────────────────────────────────────────────────────────────

export function Home() {
  const { state, dispatch } = useApp()

  const today = new Date(state.todayTs)
  const streak = computeStreak(state.log, today)
  const next = nextDose(state)

  // Color de categoría activa (o brand por defecto)
  const catColor = state.curGoal ? CATEGORY_COLOR[state.curGoal] : 'var(--brand-700)'
  const catIconId = state.curGoal ? CATEGORY_ICON[state.curGoal] : null
  const catLabel = state.curGoal ?? null

  // Fecha formateada hoy
  const todayStr = today.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // KPI: máximo 2 medidas seleccionadas
  const kpiMeasures = state.selectedMeasures.slice(0, 2)

  // ¿Hay datos numéricos suficientes para el LineChart?
  // Solo se muestra si alguna medida num tiene un valor registrado.
  const numMeasure = kpiMeasures.find((m) => {
    const meta = MEASURE_META[m]
    return meta?.kind === 'num' && state.measureValues[m] != null
  })

  return (
    <div className="scroll has-nav">
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* ── 1. Cabecera ─────────────────────────────────────────────── */}
        <motion.section
          variants={item}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p className="sm" style={{ color: 'var(--ink-400)', textTransform: 'capitalize' }}>
              {todayStr}
            </p>
            <h1 className="h1" style={{ margin: 0 }}>
              Hola, tu progreso hoy
            </h1>
            {catLabel && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                  background: catColor + '18',
                  borderRadius: 999,
                  padding: '4px 12px',
                  width: 'max-content',
                }}
              >
                {catIconId && (
                  <Glyph name={catIconId} color={catColor} size={16} />
                )}
                <span
                  className="sm"
                  style={{ color: catColor, fontWeight: 600 }}
                >
                  {catLabel}
                </span>
              </div>
            )}
          </div>

          {/* Avatar */}
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--brand-700)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            A
          </div>
        </motion.section>

        {/* ── 2. Aha-card (solo cuando !logged) ──────────────────────── */}
        {!state.logged && (
          <motion.div
            variants={item}
            className="card"
            style={{
              background: 'linear-gradient(135deg, #0E5A52 0%, #1B8A7D 100%)',
              border: 0,
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decoración de fondo */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -24,
                top: -24,
                width: 110,
                height: 110,
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
              }}
            >
              Empieza aquí
            </p>
            <h2
              className="h2"
              style={{ color: '#fff', margin: '0 0 16px', fontWeight: 700 }}
            >
              Registra tu primer registro de hoy
            </h2>
            <button
              className="btn btn-ember"
              style={{ height: 48, width: '100%' }}
              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
            >
              Registrar ahora
            </button>
          </motion.div>
        )}

        {/* ── 3. Próxima toma (oculta si nextDose es null, P1-2) ────── */}
        {next !== null && (
          <motion.section
            variants={item}
            className="card"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* Decoración cuadrante */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: 90,
                height: 90,
                background: 'var(--brand-700)',
                opacity: 0.05,
                borderBottomLeftRadius: '100%',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--brand-700)',
                }}
              >
                {/* Ícono de reloj — Material Symbol inline svg path */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                </svg>
                <span
                  className="sm mono"
                  style={{
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: 'var(--brand-700)',
                  }}
                >
                  Próxima toma
                </span>
              </div>
              <span
                className="sm mono"
                style={{ color: 'var(--ink-400)' }}
              >
                {fmtDate(next, today)}
              </span>
            </div>

            {state.protocol && (
              <h3 className="h2" style={{ margin: '0 0 4px' }}>
                {state.protocol.product}
              </h3>
            )}
            <p className="sm" style={{ color: 'var(--ink-400)', margin: '0 0 16px' }}>
              Según tu protocolo
            </p>

            <button
              className="btn btn-brand"
              style={{ width: '100%', height: 48 }}
              onClick={() => dispatch({ t: 'sheet', sheet: 'registrar' })}
            >
              Registrar
            </button>
          </motion.section>
        )}

        {/* ── 4. Anillo de racha ──────────────────────────────────────── */}
        <motion.section
          variants={item}
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 20px',
            opacity: state.logged ? 1 : 0.45,
          }}
        >
          <h2
            className="body"
            style={{
              textAlign: 'center',
              fontWeight: 600,
              marginBottom: 20,
              color: 'var(--ink-700)',
            }}
          >
            Racha de adherencia
          </h2>
          <AdherenceRing
            value={streak}
            goal={STREAK_GOAL}
            size={160}
            stroke={12}
            label="racha"
            unit=""
          />
          {streak === 0 && !state.logged && (
            <p
              className="sm"
              style={{
                color: 'var(--ink-300)',
                textAlign: 'center',
                marginTop: 12,
                maxWidth: 200,
              }}
            >
              Haz tu primer registro para empezar tu racha.
            </p>
          )}
          {streak > 0 && (
            <p
              className="sm"
              style={{
                color: 'var(--ink-400)',
                textAlign: 'center',
                marginTop: 12,
                maxWidth: 200,
              }}
            >
              Vas por buen camino, mantén el ritmo hoy.
            </p>
          )}
        </motion.section>

        {/* ── 5. KPI cards (máx 2) ────────────────────────────────────── */}
        {kpiMeasures.length > 0 && (
          <motion.section
            variants={item}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              opacity: state.logged ? 1 : 0.45,
            }}
          >
            {kpiMeasures.map((m) => {
              const hasValue = state.measureValues[m] != null
              const hero = kpiHero(m, state.measureValues)
              const unit = kpiUnit(m, state.measureValues)
              const realSeries = (state.history[m] ?? []).map((s) => s.value)
              const sparkData = realSeries.length >= 2 ? realSeries : null
              const measureIcon = MEASURE_ICON[m]

              return (
                <div
                  key={m}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px 14px',
                    minHeight: 130,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    {measureIcon && (
                      <Glyph
                        name={measureIcon.icon}
                        color={measureIcon.cat}
                        size={18}
                      />
                    )}
                    <p
                      className="sm"
                      style={{
                        color: 'var(--ink-400)',
                        fontWeight: 500,
                        margin: 0,
                      }}
                    >
                      {m}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 'auto' }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        lineHeight: 1,
                        color: 'var(--ink-900)',
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
                  {sparkData && (
                    <div style={{ marginTop: 10 }}>
                      <Sparkline data={sparkData} color={catColor} w={76} h={28} />
                    </div>
                  )}
                </div>
              )
            })}
          </motion.section>
        )}

        {/* ── 6. LineChart "tus datos" (SOLO datos reales, ≥2 muestras) ───── */}
        {numMeasure && (state.history[numMeasure]?.length ?? 0) >= 2 && (
          <motion.section variants={item} className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {MEASURE_ICON[numMeasure] && (
                  <Glyph
                    name={MEASURE_ICON[numMeasure].icon}
                    color={MEASURE_ICON[numMeasure].cat}
                    size={18}
                  />
                )}
                <h3 className="body" style={{ fontWeight: 600, margin: 0, color: 'var(--ink-700)' }}>
                  {numMeasure}
                </h3>
              </div>
              <span className="sm" style={{ color: 'var(--ink-400)' }}>
                Tus datos
              </span>
            </div>
            <LineChart
              data={(state.history[numMeasure] ?? []).map((s) => s.value)}
              color={catColor}
              h={120}
            />
          </motion.section>
        )}

        {/* ── 7. Disclaimer ───────────────────────────────────────────── */}
        <motion.div variants={item}>
          <Disclaimer kind="general" />
        </motion.div>
      </motion.div>
    </div>
  )
}
