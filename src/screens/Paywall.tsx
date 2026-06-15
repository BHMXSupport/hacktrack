import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (modal full-screen "Hacktrack Plus" / paywall).
export function Paywall() {
  const { dispatch } = useApp()
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 50 }}>
      <div className="scroll">
        <div className="h1" style={{ marginBottom: 12 }}>Mejorar a Plus</div>
        <button className="btn btn-ghost" onClick={() => dispatch({ t: 'sheet', sheet: null })}>Quizás después</button>
      </div>
    </motion.div>
  )
}
