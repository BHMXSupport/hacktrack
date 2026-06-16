// MeasurePicker — selector de métricas a seguir.
// Onboarding step 3 de 4. Navegación: atrás → s-baseline, Continuar/Saltar → s-account.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { MEASURES_BY, CATEGORY_COLOR, CATEGORY_ICON } from '../lib/catalog'
import { IcBack } from '../components/icons'
import { OnboardingProgress } from '../components/OnboardingProgress'
import { Chip } from '../components/controls'
import { Disclaimer } from '../components/controls'
import { staggerParent, staggerItem, spring } from '../lib/motion'

const MAX_CHIPS = 6

export function MeasurePicker() {
  const { state, dispatch } = useApp()
  const goal = state.curGoal ?? 'Explorar'
  const measures = (MEASURES_BY[goal] ?? MEASURES_BY['Explorar']).slice(0, MAX_CHIPS)
  const defaults = measures.slice(0, 4)

  const [selected, setSelected] = useState<Set<string>>(new Set(defaults))
  const color = CATEGORY_COLOR[goal as keyof typeof CATEGORY_COLOR] ?? 'var(--brand-700)'
  const icon = CATEGORY_ICON[goal as keyof typeof CATEGORY_ICON] ?? 'cat-explorar'

  function toggle(m: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m)) {
        next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  function handleContinuar() {
    dispatch({ t: 'setMeasures', measures: [...selected] })
    dispatch({ t: 'go', screen: 's-account' })
  }

  function handleSaltar() {
    dispatch({ t: 'setMeasures', measures: defaults })
    dispatch({ t: 'go', screen: 's-account' })
  }

  return (
    <div
      className="scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        boxSizing: 'border-box',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Header fijo */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg)',
          borderBottom: '1px solid transparent',
          padding: '12px 18px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <button
            className="iconbtn"
            aria-label="Atrás"
            onClick={() => dispatch({ t: 'go', screen: 's-baseline' })}
          >
            <IcBack size={22} />
          </button>
          <div style={{ flex: 1, padding: '0 12px' }}>
            <OnboardingProgress step={3} total={4} />
          </div>
          <div style={{ width: 36 }} />
        </div>
      </header>

      {/* Contenido */}
      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        style={{ flex: 1, padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {/* Título */}
        <motion.div variants={staggerItem}>
          <div className="h1" style={{ color: 'var(--ink-900)', marginBottom: 6 }}>
            ¿Qué quieres seguir?
          </div>
          <div className="body" style={{ color: 'var(--ink-400)' }}>
            Elige las métricas que más te interesan. Puedes cambiarlas después.
          </div>
        </motion.div>

        {/* Chips */}
        <motion.div variants={staggerItem}>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}
            role="group"
            aria-label="Métricas disponibles"
          >
            {measures.map((m) => {
              const active = selected.has(m)
              return (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.94 }}
                  transition={spring.ui}
                  className={'chip' + (active ? ' active' : '')}
                  aria-pressed={active}
                  onClick={() => toggle(m)}
                  style={
                    active
                      ? {
                          background: `color-mix(in srgb, ${color} 18%, var(--card))`,
                          border: `1.5px solid ${color}`,
                          color,
                          fontWeight: 600,
                        }
                      : undefined
                  }
                >
                  {m}
                </motion.button>
              )
            })}
          </div>

          {selected.size > 0 && (
            <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 12 }}>
              {selected.size} métrica{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
            </p>
          )}
        </motion.div>

        {/* CTAs */}
        <motion.div
          variants={staggerItem}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}
        >
          <button
            className="btn btn-brand"
            onClick={handleContinuar}
            aria-disabled={selected.size === 0}
            style={{ opacity: selected.size === 0 ? 0.4 : 1, transition: 'opacity 0.2s' }}
          >
            Continuar
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleSaltar}
            style={{ color: 'var(--ink-400)', fontSize: 15 }}
          >
            Saltar — usar recomendados
          </button>
          <Disclaimer kind="general" />
        </motion.div>
      </motion.div>
    </div>
  )
}
