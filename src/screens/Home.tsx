import { motion } from 'framer-motion'

const stagger = { animate: { transition: { staggerChildren: 0.07 } } }
const item = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }

export function Home() {
  return (
    <div className="scroll">
      <motion.div variants={stagger} initial="initial" animate="animate">
        <motion.div variants={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="sm">hoy</div>
            <div className="h1">Hola, vamos por ello 👋</div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--brand-700)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>J</div>
        </motion.div>

        <motion.div variants={item} className="card" style={{ background: 'linear-gradient(135deg,#0E5A52,#1B8A7D)', border: 0, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, color: '#bfeee6' }}>EMPIEZA AQUÍ</div>
          <div className="h2" style={{ color: '#fff', margin: '6px 0 14px' }}>Registra tu primera dosis de hoy</div>
          <button className="btn btn-ember" style={{ height: 46 }}>Registrar ahora</button>
        </motion.div>

        <motion.div variants={item} className="card" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="sm">Próxima toma</div>
            <div className="h2">Hoy</div>
          </div>
          <div className="mono sm" style={{ color: 'var(--brand-700)', fontWeight: 700 }}>según tu ritmo</div>
        </motion.div>

        <motion.div variants={item} className="sm" style={{ textAlign: 'center', padding: '18px 8px', color: 'var(--ink-300)' }}>
          Hacktrack es una herramienta de auto-registro. No es consejo médico.
        </motion.div>
      </motion.div>
    </div>
  )
}
