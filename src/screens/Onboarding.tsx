import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { Glyph } from '../components/glyphs'
import { IcShield } from '../components/icons'
import { dur, ease, sharedAxisX } from '../lib/motion'

// ─── Ilustraciones abstractas SVG ────────────────────────────────────────────

/** Slide 1 — blob orgánico + trazo seismograma (ritmo / adherencia) */
function IllustrationRitmo() {
  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* blob brand/100 fondo */}
      <ellipse cx="160" cy="118" rx="118" ry="88" fill="#D6F2EC" opacity="0.55" />
      {/* blob lime baja opacidad */}
      <ellipse cx="220" cy="80" rx="64" ry="48" fill="#B6F09C" opacity="0.18" />
      {/* círculo de refuerzo brand-500 */}
      <circle cx="160" cy="110" r="72" stroke="#1B8A7D" strokeWidth="1.5" opacity="0.18" />
      {/* señal / seismograma */}
      <path
        d="M40 118 H80 L94 78 L108 158 L122 98 L136 138 L150 118 H280"
        stroke="#1B8A7D"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* glows sutiles en picos */}
      <circle cx="94" cy="78" r="5" fill="#5FC9B8" opacity="0.55" />
      <circle cx="108" cy="158" r="5" fill="#5FC9B8" opacity="0.35" />
      <circle cx="122" cy="98" r="3.5" fill="#B6F09C" opacity="0.7" />
      {/* partícula flotante */}
      <circle cx="260" cy="72" r="4" fill="#D6F2EC" />
      <circle cx="52" cy="158" r="6" fill="#D6F2EC" opacity="0.7" />
    </svg>
  )
}

/** Slide 2 — blobs + grid de puntos (datos / progreso) */
function IllustrationDatos() {
  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* blob principal */}
      <ellipse cx="155" cy="115" rx="108" ry="80" fill="#D6F2EC" opacity="0.5" />
      <ellipse cx="80" cy="85" rx="52" ry="38" fill="#B6F09C" opacity="0.14" />
      {/* barras abstractas de progreso */}
      <rect x="88" y="148" width="16" height="28" rx="4" fill="#1B8A7D" opacity="0.22" />
      <rect x="112" y="128" width="16" height="48" rx="4" fill="#1B8A7D" opacity="0.38" />
      <rect x="136" y="108" width="16" height="68" rx="4" fill="#1B8A7D" opacity="0.55" />
      <rect x="160" y="88" width="16" height="88" rx="4" fill="#1B8A7D" opacity="0.72" />
      <rect x="184" y="108" width="16" height="68" rx="4" fill="#5FC9B8" opacity="0.5" />
      <rect x="208" y="128" width="16" height="48" rx="4" fill="#5FC9B8" opacity="0.32" />
      {/* línea de tendencia */}
      <path
        d="M96 148 C112 130 132 110 168 90 C192 78 208 120 224 140"
        stroke="#0E5A52"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      <circle cx="168" cy="90" r="5" fill="#5FC9B8" opacity="0.8" />
    </svg>
  )
}

/** Slide 3 — blob + escudo abstracto / contorno de protección */
function IllustrationPrivacidad() {
  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* blobs */}
      <ellipse cx="160" cy="115" rx="110" ry="82" fill="#D6F2EC" opacity="0.45" />
      <ellipse cx="230" cy="80" rx="58" ry="42" fill="#B6F09C" opacity="0.12" />
      {/* escudo orgánico — contorno */}
      <path
        d="M160 62 L204 80 L204 118 C204 140 160 158 160 158 C160 158 116 140 116 118 L116 80 Z"
        stroke="#1B8A7D"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="#D6F2EC"
        fillOpacity="0.45"
      />
      {/* check interior */}
      <path
        d="M146 110 l10 10 18-20"
        stroke="#0E5A52"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* partículas */}
      <circle cx="88" cy="72" r="5" fill="#5FC9B8" opacity="0.4" />
      <circle cx="248" cy="148" r="7" fill="#D6F2EC" opacity="0.7" />
      <circle cx="72" cy="148" r="4" fill="#B6F09C" opacity="0.5" />
    </svg>
  )
}

// ─── Config de slides ─────────────────────────────────────────────────────────

const CATEGORY_GLYPHS = [
  'cat-metabolismo',
  'cat-recuperacion',
  'cat-cognitivo',
  'cat-piel',
  'cat-antiaging',
  'cat-crecimiento',
] as const

const CATEGORY_COLORS: Record<string, string> = {
  'cat-metabolismo': '#E85D3A',
  'cat-recuperacion': '#2FB57C',
  'cat-cognitivo': '#6B7BE8',
  'cat-piel': '#D17FA0',
  'cat-antiaging': '#A8842F',
  'cat-crecimiento': '#1B8A7D',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function Onboarding() {
  const { dispatch } = useApp()
  const [slide, setSlide] = useState(0)
  const [dir, setDir] = useState(1) // 1 = avanzar, -1 = retroceder

  const goTo = (idx: number) => {
    setDir(idx > slide ? 1 : -1)
    setSlide(idx)
  }

  const advance = () => {
    if (slide < 2) goTo(slide + 1)
  }

  const skipToGoal = () => dispatch({ t: 'go', screen: 's-goal' })

  // Variantes shared-axis con dirección dinámica
  const slideVariants = {
    initial: (d: number) => ({ opacity: 0, x: d * 32 }),
    animate: { opacity: 1, x: 0, transition: { duration: dur.slow, ease: ease.decelerate } },
    exit: (d: number) => ({ opacity: 0, x: d * -32, transition: { duration: dur.base, ease: ease.accelerate } }),
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

      {/* Área de ilustración */}
      <div
        style={{
          flex: '0 0 auto',
          height: 220,
          position: 'relative',
          overflow: 'hidden',
          margin: '8px 0 0',
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
              <IllustrationRitmo />
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
      </div>

      {/* Indicador de puntos */}
      <div
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
            aria-label={`Ir al slide ${i + 1}`}
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
              transition={{ duration: dur.base, ease: ease.standard }}
              style={{
                height: 8,
                borderRadius: 999,
              }}
            />
          </button>
        ))}
      </div>

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
                No vuelvas a fallar tu dosis
              </h1>
              <p className="body" style={{ margin: 0 }}>
                Recordatorios a tu ritmo y un registro de un toque.
              </p>
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
              {/* Fila de glyphs de categoría */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {CATEGORY_GLYPHS.map((name) => (
                  <div
                    key={name}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `color-mix(in srgb, ${CATEGORY_COLORS[name]} 13%, var(--bg))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Glyph name={name} size={20} color={CATEGORY_COLORS[name]} />
                  </div>
                ))}
              </div>
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
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'var(--brand-100)',
                  color: 'var(--brand-900)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <IcShield size={16} style={{ color: 'var(--brand-700)', flexShrink: 0 }} />
                Hecho en México · Cumple LFPDPPP
              </div>
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
