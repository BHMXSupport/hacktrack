// Intro de primera vez por pantalla — overlay breve que aparece UNA sola vez (como el coach de Diario).
// Se marca como visto en localStorage con una clave por pantalla, así cada tab muestra su guía una vez.
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function ScreenIntro({ storageKey, title, tips }: { storageKey: string; title: string; tips: string[] }) {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem(storageKey) } catch { return false }
  })
  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1') } catch { /* storage no disponible */ }
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="screen-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          role="dialog"
          aria-label={`Guía de ${title}`}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
            padding: 24, paddingBottom: 'max(48px, calc(env(safe-area-inset-bottom, 0px) + 24px))',
          }}
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: 24, maxWidth: 340, width: '100%', boxShadow: 'var(--e3)' }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>{title}</h2>
            <p className="sm" style={{ color: 'var(--ink-400)', margin: '2px 0 14px' }}>Guía rápida · aparece solo esta vez</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tips.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-100)',
                    color: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 14, color: 'var(--ink-700)', lineHeight: 1.45 }}>{t}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={dismiss}
              style={{ marginTop: 20, width: '100%', background: 'var(--brand-500)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', padding: '12px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Entendido
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
