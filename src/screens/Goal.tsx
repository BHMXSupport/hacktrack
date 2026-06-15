import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { GOALS, CATEGORY_COLOR, CATEGORY_EMOJI } from '../lib/catalog'
import { IcBack } from '../components/icons'

const stagger = { animate: { transition: { staggerChildren: 0.07 } } }
const item = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }

export function Goal() {
  const { dispatch } = useApp()
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = (cat: string) => {
    setSelected(cat)
  }

  const handleContinue = () => {
    if (!selected) return
    dispatch({ t: 'pickGoal', cat: selected as import('../lib/types').Category })
    dispatch({ t: 'go', screen: 's-account' })
  }

  return (
    <div className="scroll">
      {/* Top app bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg)', borderBottom: '1px solid transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px',
      }}>
        <button
          className="iconbtn"
          aria-label="Atrás"
          onClick={() => dispatch({ t: 'go', screen: 's-onboarding' })}
        >
          <IcBack size={22} />
        </button>
        <span className="h2" style={{ color: 'var(--brand-700)', fontWeight: 700 }}>
          Hacktrack
        </span>
        {/* balancing spacer */}
        <div style={{ width: 36 }} />
      </header>

      {/* Page heading */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', padding: '28px 18px 20px' }}
      >
        <div className="h1" style={{ color: 'var(--brand-700)', marginBottom: 8 }}>
          ¿Que quieres lograr?
        </div>
        <div className="body" style={{ color: 'var(--ink-400)', maxWidth: 340, margin: '0 auto' }}>
          Elige tu enfoque principal para personalizar tu experiencia.
        </div>
      </motion.div>

      {/* Goal cards */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {GOALS.map((g) => {
          const color = CATEGORY_COLOR[g.cat]
          const emoji = CATEGORY_EMOJI[g.cat]
          const isActive = selected === g.cat
          return (
            <motion.button
              key={g.cat}
              variants={item}
              className="card"
              onClick={() => handleSelect(g.cat)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '18px 20px',
                textAlign: 'left',
                cursor: 'pointer',
                border: isActive
                  ? `2px solid ${color}`
                  : '2px solid var(--border)',
                background: isActive
                  ? `color-mix(in srgb, ${color} 8%, var(--card))`
                  : 'var(--card)',
                borderRadius: 20,
                transition: 'border-color 0.18s, background 0.18s',
                boxShadow: isActive ? `0 0 0 3px color-mix(in srgb, ${color} 18%, transparent)` : undefined,
              }}
              aria-pressed={isActive}
            >
              {/* Icon circle */}
              <div style={{
                width: 48, height: 48,
                borderRadius: '50%',
                background: `color-mix(in srgb, ${color} 15%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontSize: 22,
              }}>
                {emoji}
              </div>
              {/* Text */}
              <div style={{ flex: 1 }}>
                <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', marginBottom: 2 }}>
                  {g.label}
                </div>
                <div className="sm" style={{ color: 'var(--ink-400)' }}>
                  {g.sub}
                </div>
              </div>
              {/* Selection indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    style={{
                      width: 22, height: 22,
                      borderRadius: '50%',
                      background: color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5L20 6" />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </motion.div>

      {/* CTA + disclaimer */}
      <div style={{ padding: '28px 16px 40px', textAlign: 'center' }}>
        <button
          className="btn btn-brand"
          disabled={!selected}
          onClick={handleContinue}
          style={{ opacity: selected ? 1 : 0.4, transition: 'opacity 0.2s' }}
        >
          Continuar
        </button>
        <p className="sm" style={{ marginTop: 14, color: 'var(--ink-400)' }}>
          Podras ajustar esto mas adelante.
        </p>
      </div>
    </div>
  )
}
