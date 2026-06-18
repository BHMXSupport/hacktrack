import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useApp, computeStreak } from '../lib/store'
import { IcClose, IcCheck } from '../components/icons'
import { Segmented } from '../components/controls'
import { Sparkline } from '../components/charts'
import { dur, ease } from '../lib/motion'
import { Glyph } from '../components/glyphs'

type Plan = 'mensual' | 'anual'

// ── Tabla comparativa honesta (N=452) — dos grupos claros ─────────────────────
const ROWS_FREE: { label: string }[] = [
  { label: 'Registro de dosis diario' },
  { label: 'Protocolo activo (1 producto)' },
  { label: 'Historial 30 días' },
  { label: 'Racha y adherencia básica' },
]

const ROWS_PLUS: { label: string }[] = [
  { label: 'Multi-protocolo (varios productos)' },
  { label: 'Historial ilimitado (90 días+)' },
  { label: 'Exportación de datos JSON + CSV médico' },
  { label: 'Resumen semanal avanzado' },
  { label: 'Proyección de peso con ETA' },
  { label: 'Perspectivas de nutrición y macros' },
]

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual',   label: 'Anual' },
]

// Precios (fuente única) — el ahorro anual se DERIVA, no se hardcodea
const PRICE_MXN = { mensual: 99, anual: 799 } as const
const SAVE_PCT   = Math.round((1 - PRICE_MXN.anual / (PRICE_MXN.mensual * 12)) * 100) // ≈ 33

const SOCIAL_PROOF_N = 1_200

// ── Bullet chips del hero (N=399) ──────────────────────────────────────────────
const HERO_BULLETS = [
  { icon: <Glyph name="candado" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />, label: 'Sin límite de historial' },
  { icon: <Glyph name="cat-crecimiento" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} />, label: 'Perspectivas avanzadas' },
  { icon: '↓', label: 'Exporta tus datos' },
]

// ── Datos sintéticos para la sparkline del hero (N=399) ────────────────────────
const HERO_DATA = [52, 61, 58, 70, 67, 80, 76, 88]

// Variantes para la entrada escalonada de filas (N=399)
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.2,
    },
  },
}
const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' as const } },
}

export function Paywall() {
  const { state, dispatch } = useApp()
  const [plan, setPlan] = useState<Plan>('mensual')
  const reduce = useReducedMotion()

  const streak = computeStreak(state.log, new Date(state.todayTs))
  const trialEndsAt = state.settings.trialEndsAt as number | null | undefined
  const hadTrial    = trialEndsAt != null
  const trialActive = hadTrial && trialEndsAt! > Date.now()
  const trialDaysLeft = trialActive ? Math.ceil((trialEndsAt! - Date.now()) / 86400000) : 0

  // personalizar primera fila Plus con el producto activo (N=396)
  const activeProduct = state.activeProduct
  const activeAlias   = activeProduct ? (state.productAliases?.[activeProduct] ?? activeProduct) : null
  const dynamicPlusRows: { label: string }[] = activeAlias
    ? [{ label: `Seguimiento avanzado de ${activeAlias}` }, ...ROWS_PLUS.slice(1)]
    : ROWS_PLUS

  function close() {
    dispatch({ t: 'sheet', sheet: null })
  }

  function startTrial() {
    const trialEnd = Date.now() + 7 * 86400000
    dispatch({ t: 'setSetting', key: 'trialEndsAt', value: trialEnd })
    dispatch({ t: 'setSetting', key: 'premium', value: true })
    dispatch({ t: 'toast', msg: '¡Prueba gratuita de 7 días iniciada!' })
    close()
  }

  function subscribe() {
    // placeholder hasta integrar pagos reales
    dispatch({ t: 'setSetting', key: 'premium', value: true })
    dispatch({ t: 'toast', msg: `Plus ${plan} activado` })
    close()
  }

  const price     = `$${PRICE_MXN[plan]}`
  const period    = plan === 'mensual' ? '/mes' : '/año'
  const dailyEq   = plan === 'anual' ? (PRICE_MXN.anual / 365).toFixed(2) : null

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 50, overflowY: 'auto' }}
    >
      {/* Cabecera — safe-area arriba para que la X no quede bajo la barra de estado/notch en full-screen */}
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', minHeight: 64, position: 'sticky', top: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'var(--bg)', zIndex: 10,
        }}
      >
        <button
          className="iconbtn"
          aria-label="Cerrar"
          onClick={close}
          style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IcClose size={22} />
        </button>
        <div style={{ width: 40 }} />
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '0 20px', paddingBottom: 'max(48px, calc(48px + env(safe-area-inset-bottom, 0px)))' }}>

        {/* ── Social proof anónima (N=397) ──────────────────────────────────── */}
        <div style={{ textAlign: 'center' }}>
          <span
            className="sm"
            style={{ color: 'var(--ink-400)', background: 'var(--surface)', padding: '4px 14px', borderRadius: 99, display: 'inline-block' }}
          >
            Más de {SOCIAL_PROOF_N.toLocaleString('es-MX')} personas ya optimizan su rutina con Plus
          </span>
        </div>

        {/* ── Headline ─────────────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <motion.h1
            className="display-l"
            style={{ textAlign: 'center', color: 'var(--brand-700)', margin: 0 }}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.base, ease: ease.decelerate }}
          >
            Eleva tu seguimiento con Plus
          </motion.h1>

          {/* Hero con sparkline real + chips (N=399) */}
          <div
            style={{
              width: '100%', borderRadius: 20, overflow: 'hidden',
              background: 'linear-gradient(135deg, #0a2e28 0%, var(--brand-700) 100%)',
              padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            {/* Sparkline animada */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkline
                data={HERO_DATA}
                color="#5eead4"
                w={200}
                h={56}
                animKey="paywall-hero"
              />
            </div>

            {/* Bullet chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {HERO_BULLETS.map((b, i) => (
                <motion.span
                  key={b.label}
                  initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : 0.3 + i * 0.07 }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(255,255,255,0.12)', borderRadius: 99,
                    padding: '4px 12px',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{b.icon}</span>
                  <span className="sm" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>{b.label}</span>
                </motion.span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Toggle de plan + precio ───────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Segmented<Plan>
              options={PLAN_OPTIONS}
              value={plan}
              onChange={setPlan}
            />
            <span
              className="badge badge-mint"
              style={{
                position: 'absolute', top: -10, right: 0,
                fontSize: 10, fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap',
              }}
            >
              Ahorra {SAVE_PCT}%
            </span>
          </div>

          {/* Precio dinámico */}
          <div style={{ textAlign: 'center' }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={plan}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="mono"
                style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink-900)', letterSpacing: '-0.01em', display: 'inline' }}
              >
                {price}
              </motion.span>
            </AnimatePresence>
            <span className="body" style={{ color: 'var(--ink-400)', marginLeft: 2 }}>{period}</span>

            {/* Precio diario equivalente (N=398) */}
            <AnimatePresence>
              {dailyEq && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginTop: 2 }}>
                    equivale a <strong style={{ color: 'var(--brand-700)' }}>${dailyEq}</strong> / día
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ── Tabla comparativa honesta (N=452) ─────────────────────────────── */}
        <section className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {/* Gratis */}
          <div style={{ padding: '12px 20px 6px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <span className="sm" style={{ color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
              Lo que ya tienes
            </span>
          </div>
          <motion.div
            variants={reduce ? undefined : containerVariants}
            initial="hidden"
            animate="show"
          >
            {ROWS_FREE.map((row, i) => (
              <motion.div
                key={row.label}
                variants={reduce ? undefined : itemVariants}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 20px',
                  borderBottom: i < ROWS_FREE.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <IcCheck size={16} style={{ color: 'var(--ink-300)', flexShrink: 0 }} />
                <span className="body" style={{ color: 'var(--ink-700)', lineHeight: 1.35 }}>{row.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Plus */}
          <div style={{ padding: '12px 20px 6px', background: 'rgba(14,90,82,0.06)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <span className="sm" style={{ color: 'var(--brand-700)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
              Plus desbloquea
            </span>
          </div>
          <motion.div
            variants={reduce ? undefined : containerVariants}
            initial="hidden"
            animate="show"
          >
            {dynamicPlusRows.map((row, i) => (
              <motion.div
                key={row.label}
                variants={reduce ? undefined : itemVariants}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 20px',
                  borderBottom: i < dynamicPlusRows.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'rgba(14,90,82,0.02)',
                }}
              >
                <IcCheck size={16} style={{ color: 'var(--brand-700)', strokeWidth: 2.5, flexShrink: 0 }} />
                <span className="body" style={{ color: 'var(--ink-700)', lineHeight: 1.35 }}>{row.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Prueba social de racha (N=397) ──────────────────────────────────── */}
        {streak >= 3 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            style={{
              textAlign: 'center',
              background: 'linear-gradient(135deg, var(--brand-900,#0a2e28) 0%, var(--brand-700) 100%)',
              borderRadius: 16, padding: '14px 20px',
            }}
          >
            <span className="body" style={{ color: '#fff', fontWeight: 600 }}>
              <Glyph name="racha" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> Ya llevas {streak} día{streak !== 1 ? 's' : ''} de racha — no la pierdas
            </span>
          </motion.div>
        )}

        {/* ── CTA cluster ──────────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {trialActive ? (
            /* Ya en trial */
            <div
              style={{
                textAlign: 'center', padding: '12px 16px', background: 'var(--surface)',
                borderRadius: 14, border: '1px solid var(--border)',
              }}
            >
              <span className="body" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
                Prueba activa — {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <button
              className="btn btn-ember"
              style={{ width: '100%', height: 52, fontSize: 17, fontWeight: 600 }}
              onClick={hadTrial ? subscribe : startTrial}
            >
              {hadTrial ? `Suscribirse (${price}${period})` : 'Iniciar prueba gratuita de 7 días'}
            </button>
          )}

          <button
            className="btn btn-ghost"
            style={{ width: '100%', height: 52, fontSize: 17 }}
            onClick={close}
          >
            Quizás después
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button
              className="sm"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-700)',
                textDecoration: 'underline', textUnderlineOffset: 3, padding: '4px 0',
              }}
              onClick={() => dispatch({ t: 'toast', msg: 'Restaurar compra (próximamente)' })}
            >
              Restaurar compra
            </button>

            {!hadTrial && (
              <p className="sm" style={{ color: 'var(--ink-300)', textAlign: 'center', maxWidth: 280, margin: 0, lineHeight: 1.5 }}>
                Sin tarjeta requerida para la prueba. La suscripción se renueva automáticamente al término del período elegido.
              </p>
            )}
            {hadTrial && (
              <p className="sm" style={{ color: 'var(--ink-400)', textAlign: 'center', maxWidth: 280, margin: 0, lineHeight: 1.5 }}>
                La suscripción se renovará automáticamente.
              </p>
            )}
          </div>
        </section>

      </main>
    </motion.div>
  )
}
