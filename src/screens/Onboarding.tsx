import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion'
import { useApp } from '../lib/store'
import { Glyph } from '../components/glyphs'
import { dur, ease, spring, staggerParent, staggerItem } from '../lib/motion'
import { CATEGORY_COLOR, CATEGORY_ICON, MEASURES_BY, MEASURE_ICON } from '../lib/catalog'
import type { Category } from '../lib/types'
import { TrustBadge } from '../components/identity'

// ─── Persistencia de posición (módulo-level, sobrevive navegación Goal→Onboarding) ──────────────
let _savedSlide = 0

// ─── Ilustración slide 1: mini-card de UI real (anillo + tira semanal + dosis de hoy) ──────────

function IllustrationRitmo({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotion()
  const shouldAnimate = active && !reducedMotion

  // Adherencia simulada: 5 de 7 días activos
  const weekDots = [true, true, false, true, true, true, false]

  // pathLength del seismograma: 0→1 al entrar
  const pathVariants = {
    hidden: { pathLength: 0, opacity: 0.4 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: dur.draw, ease: 'easeInOut' as const },
    },
  }

  // dots/glows del seismograma en cascada
  const dotVariants = {
    hidden: { opacity: 0, scale: 0.4 },
    visible: (i: number) => ({
      opacity: i === 2 ? 0.7 : 0.55,
      scale: 1,
      transition: { delay: dur.draw * 0.55 + i * 0.1, duration: dur.base, ease: ease.decelerate },
    }),
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      {/* Mini-card estilo .card */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-md)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          padding: '16px 18px 14px',
          width: '100%',
          maxWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Fila superior: anillo de adherencia + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Anillo SVG (simula 74% adherencia) */}
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="21" fill="none" stroke="var(--ink-100)" strokeWidth="4" />
            <motion.circle
              cx="26" cy="26" r="21"
              fill="none"
              stroke="var(--brand-500)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 21}`}
              initial={{ pathLength: 0 }}
              animate={shouldAnimate ? { pathLength: 0.74 } : { pathLength: 0.74 }}
              transition={shouldAnimate ? { duration: dur.draw, ease: 'easeInOut' } : { duration: 0 }}
              style={{ transformOrigin: '26px 26px', rotate: -90 }}
            />
            <text x="26" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--brand-500)">74%</text>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.2 }}>
              Adherencia
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 2 }}>
              Este mes · 22/30 días
            </div>
          </div>
        </div>

        {/* Tira semanal */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: 9, color: 'var(--ink-400)', fontWeight: 600 }}>{d}</div>
              <div style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 4,
                background: weekDots[i] ? 'var(--brand-500)' : 'var(--ink-100)',
                opacity: weekDots[i] ? 1 : 0.5,
              }} />
            </div>
          ))}
        </div>

        {/* Seismograma */}
        <svg viewBox="0 0 244 40" fill="none" style={{ width: '100%', height: 40, display: 'block' }}>
          <motion.path
            d="M4 20 H40 L52 6 L64 34 L76 14 L88 26 L100 20 H244"
            stroke="var(--brand-500)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            variants={pathVariants}
            initial="hidden"
            animate={shouldAnimate ? 'visible' : 'visible'}
          />
          {[
            { cx: 52, cy: 6, r: 4, i: 0 },
            { cx: 64, cy: 34, r: 4, i: 1 },
            { cx: 76, cy: 14, r: 3, i: 2 },
          ].map(({ cx, cy, r, i }) => (
            <motion.circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="var(--brand-300)"
              custom={i}
              variants={dotVariants}
              initial={shouldAnimate ? 'hidden' : 'visible'}
              animate="visible"
            />
          ))}
        </svg>

        {/* Dosis de hoy (simulada) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'color-mix(in srgb, var(--brand-500) 8%, transparent)',
          borderRadius: 8,
          padding: '6px 10px',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--brand-500)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 500 }}>
            Dosis de hoy: <strong>08:00</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Slide 2 — mini-card con barras de progreso de KPIs (datos) */
function IllustrationDatos() {
  const kpiRows = [
    { label: 'Energía', pct: 78, color: '#FF7A59' },
    { label: 'Sueño',   pct: 65, color: '#5FC9B8' },
    { label: 'Foco',    pct: 88, color: '#6B7BE8' },
  ]
  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-md)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          padding: '16px 18px',
          width: '100%',
          maxWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>Tu progreso</div>
        {kpiRows.map(({ label, pct, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-700)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: color, width: `${pct}%` }} />
            </div>
          </div>
        ))}
        {/* Dot trend */}
        <svg viewBox="0 0 244 40" fill="none" style={{ width: '100%', height: 36, display: 'block', marginTop: 4 }}>
          <path d="M4 34 C40 28 80 18 120 12 C160 6 200 18 240 10" stroke="#6B7BE8" strokeWidth="2" strokeLinecap="round" opacity="0.6" strokeDasharray="4 4" />
          <circle cx="120" cy="12" r="4" fill="#6B7BE8" opacity="0.8" />
        </svg>
      </div>
    </div>
  )
}

/** Slide 3 — escudo abstracto / contorno de protección */
function IllustrationPrivacidad() {
  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <ellipse cx="160" cy="115" rx="110" ry="82" fill="#D6F2EC" opacity="0.45" />
      <ellipse cx="230" cy="80" rx="58" ry="42" fill="#B6F09C" opacity="0.12" />
      <path
        d="M160 62 L204 80 L204 118 C204 140 160 158 160 158 C160 158 116 140 116 118 L116 80 Z"
        stroke="#1B8A7D"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="#D6F2EC"
        fillOpacity="0.45"
      />
      <path
        d="M146 110 l10 10 18-20"
        stroke="#0E5A52"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="88" cy="72" r="5" fill="#5FC9B8" opacity="0.4" />
      <circle cx="248" cy="148" r="7" fill="#D6F2EC" opacity="0.7" />
      <circle cx="72" cy="148" r="4" fill="#B6F09C" opacity="0.5" />
    </svg>
  )
}

// ─── Config de slides ─────────────────────────────────────────────────────────

const CATEGORY_LIST: Category[] = [
  'Metabolismo',
  'Recuperación',
  'Cognitivo',
  'Piel',
  'Anti-Aging',
  'Crecimiento',
]

const SLIDE_TITLES = ['Ritmo', 'Progreso', 'Privacidad']

// ─── Componente principal ─────────────────────────────────────────────────────

export function Onboarding() {
  const { state, dispatch } = useApp()
  const reducedMotion = useReducedMotion()

  // Restaura posición si el usuario regresa de Goal
  const [slide, setSlide] = useState(_savedSlide)
  const [dir, setDir] = useState(1) // 1 = avanzar, -1 = retroceder

  // Persiste el índice en módulo-level al cambiar
  useEffect(() => { _savedSlide = slide }, [slide])

  const goTo = (idx: number) => {
    setDir(idx > slide ? 1 : -1)
    setSlide(idx)
  }

  const advance = () => {
    if (slide < 2) goTo(slide + 1)
  }

  const onSwipe = (_e: unknown, info: PanInfo) => {
    if (info.offset.x < -50) advance()
    else if (info.offset.x > 50 && slide > 0) goTo(slide - 1)
  }

  const skipToGoal = () => dispatch({ t: 'go', screen: 's-goal' })

  // KPIs del objetivo actual (primeras 4 medidas) — para chips del slide 1
  const goalKpis = state.curGoal
    ? (MEASURES_BY[state.curGoal] ?? []).slice(0, 4)
    : []

  const slideVariants = {
    initial: (d: number) => ({ opacity: 0, x: reducedMotion ? 0 : d * 24 }),
    animate: { opacity: 1, x: 0, transition: { duration: reducedMotion ? 0 : dur.slow, ease: ease.decelerate } },
    exit: (d: number) => ({ opacity: 0, x: reducedMotion ? 0 : d * -24, transition: { duration: reducedMotion ? 0 : dur.base, ease: ease.accelerate } }),
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Anuncio a11y del slide activo */}
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {`Paso ${slide + 1} de 3: ${SLIDE_TITLES[slide]}`}
      </div>

      {/* Barra superior: saltar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: 'max(18px, env(safe-area-inset-top)) 20px 0',
          flexShrink: 0,
          minHeight: 52,
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={skipToGoal}
          style={{
            width: 'auto',
            height: 36,
            padding: '0 12px',
            fontSize: 14,
            color: 'var(--ink-400)',
          }}
        >
          Saltar
        </button>
      </div>

      {/* Área de ilustración — arrastrable (swipe) para navegar */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.14}
        onDragEnd={onSwipe}
        style={{
          flex: '0 0 auto',
          height: 220,
          position: 'relative',
          overflow: 'hidden',
          margin: '8px 0 0',
          touchAction: 'pan-y',
        }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          {slide === 0 && (
            <motion.div
              key="ill-0"
              custom={dir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: 'absolute', inset: 0 }}
            >
              <IllustrationRitmo active />
            </motion.div>
          )}
          {slide === 1 && (
            <motion.div
              key="ill-1"
              custom={dir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: 'absolute', inset: 0 }}
            >
              <IllustrationDatos />
            </motion.div>
          )}
          {slide === 2 && (
            <motion.div
              key="ill-2"
              custom={dir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: 'absolute', inset: 0 }}
            >
              <IllustrationPrivacidad />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Indicador de puntos */}
      <nav
        aria-label="Pasos del recorrido"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          margin: '16px 0 0',
          flexShrink: 0,
        }}
      >
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`${SLIDE_TITLES[i]} — paso ${i + 1} de 3`}
            aria-current={i === slide ? 'step' : undefined}
            style={{
              border: 0,
              cursor: 'pointer',
              padding: 0,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <motion.div
              animate={{
                width: i === slide ? 24 : 8,
                background: i === slide ? 'var(--brand-500)' : 'var(--ink-200)',
              }}
              transition={spring.ui}
              style={{
                height: 8,
                borderRadius: 999,
              }}
            />
          </button>
        ))}
      </nav>

      {/* Copy del slide */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          marginTop: 24,
          padding: '0 24px',
        }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          {slide === 0 && (
            <motion.div
              key="copy-0"
              custom={dir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: 'absolute', inset: '0 24px' }}
            >
              <h1 className="display-l" style={{ margin: '0 0 12px', color: 'var(--ink-900)' }}>
                Nunca pierdas el ritmo
              </h1>
              <p className="body" style={{ margin: '0 0 16px' }}>
                Recordatorios inteligentes y registro en un toque.
              </p>

              {/* KPI chips del objetivo actual (si ya hay objetivo) */}
              {goalKpis.length > 0 && (
                <motion.div
                  variants={staggerParent}
                  initial="initial"
                  animate="animate"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                >
                  {goalKpis.map((kpi) => {
                    const icon = MEASURE_ICON[kpi]
                    const color = icon?.cat ?? 'var(--brand-500)'
                    return (
                      <motion.div
                        key={kpi}
                        variants={staggerItem}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 10px',
                          borderRadius: 999,
                          background: `color-mix(in srgb, ${color} 12%, var(--bg))`,
                          border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
                        }}
                      >
                        {icon && (
                          <Glyph name={icon.icon} size={14} color={color} />
                        )}
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>
                          {kpi}
                        </span>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </motion.div>
          )}
          {slide === 1 && (
            <motion.div
              key="copy-1"
              custom={dir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: 'absolute', inset: '0 24px' }}
            >
              <h1 className="display-l" style={{ margin: '0 0 12px', color: 'var(--ink-900)' }}>
                Mira tu progreso hacia tu meta
              </h1>
              <p className="body" style={{ margin: '0 0 20px' }}>
                Tus datos, claros y tuyos.
              </p>
              {/* Fila de glyphs de categoría — entran en cascada */}
              <motion.div
                variants={staggerParent}
                initial="initial"
                animate="animate"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {CATEGORY_LIST.map((cat) => (
                  <motion.div
                    key={cat}
                    variants={staggerItem}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `color-mix(in srgb, ${CATEGORY_COLOR[cat]} 13%, var(--bg))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Glyph name={CATEGORY_ICON[cat]} size={20} color={CATEGORY_COLOR[cat]} />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
          {slide === 2 && (
            <motion.div
              key="copy-2"
              custom={dir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: 'absolute', inset: '0 24px' }}
            >
              <h1 className="display-l" style={{ margin: '0 0 12px', color: 'var(--ink-900)' }}>
                Tus datos son tuyos. Tú los controlas.
              </h1>
              <p className="body" style={{ margin: '0 0 20px' }}>
                Sin servidores externos, sin venta de información.
              </p>
              {/* Badge de confianza */}
              <TrustBadge />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botones de acción */}
      <div
        style={{
          flexShrink: 0,
          padding: '0 24px calc(28px + env(safe-area-inset-bottom))',
        }}
      >
        <AnimatePresence mode="wait">
          {slide < 2 ? (
            <motion.div
              key="btn-continue"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.decelerate } }}
              exit={{ opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.accelerate } }}
            >
              <button className="btn btn-brand" onClick={advance}>
                Continuar
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="btn-start"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.decelerate } }}
              exit={{ opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.accelerate } }}
            >
              <button
                className="btn btn-ember"
                onClick={() => dispatch({ t: 'go', screen: 's-goal' })}
              >
                Comenzar
              </button>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 4 }}
                onClick={() => dispatch({ t: 'go', screen: 's-login' })}
              >
                Ya tengo cuenta
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
