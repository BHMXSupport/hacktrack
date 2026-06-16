// Vida — "Vida del péptido en el cuerpo" como pantalla propia (antes era el segmento "Cuerpo" de Progreso).
import { motion } from 'framer-motion'
import { PharmaDashboard } from '../components/PharmaDashboard'
import { staggerParent, staggerItem } from '../lib/motion'

export function Vida() {
  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ padding: '24px 20px 40px' }}>
        <motion.h1 variants={staggerItem} className="h1" style={{ marginBottom: 4 }}>Vida</motion.h1>
        <motion.p variants={staggerItem} className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
          Cuánto sigue activo cada péptido en tu cuerpo
        </motion.p>
        <PharmaDashboard />
      </motion.div>
    </div>
  )
}
