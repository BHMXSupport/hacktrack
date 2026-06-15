import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
// STUB — lo rellena el equipo multiagente (modal full-screen "Perfil y privacidad" / ARCO).
export function Perfil() {
  const { dispatch } = useApp()
  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 50 }}>
      <div className="scroll">
        <div className="h1" style={{ marginBottom: 12 }}>Perfil y privacidad</div>
        <button className="btn btn-outline" onClick={() => dispatch({ t: 'sheet', sheet: null })}>Volver</button>
      </div>
    </motion.div>
  )
}
