import { motion, useReducedMotion } from 'framer-motion'
import { dur, staggerItem } from '../lib/motion'

export function Splash() {
  const reducedMotion = useReducedMotion()

  // Bajo prefers-reduced-motion: todo visible al instante, sin trazo ni stagger
  if (reducedMotion) {
    return (
      <div
        role="status"
        aria-label="Cargando Hacktrack"
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0B1220,var(--brand-900))' }}
      >
        <svg aria-hidden width="74" height="74" viewBox="0 0 76 76">
          <circle cx="38" cy="38" r="34" fill="none" stroke="var(--brand-500)" strokeWidth="2" opacity="0.4" />
          <path d="M14 38 H28 L33 24 L41 52 L46 38 H62" fill="none" stroke="var(--brand-300)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: 33, color: '#fff', letterSpacing: -0.5, marginTop: 16 }}>
            Hack<span style={{ color: 'var(--brand-300)' }}>track</span>
          </div>
          <div className="sm" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>tu progreso, en una sola pantalla</div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label="Cargando Hacktrack"
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0B1220,var(--brand-900))' }}
    >
      <motion.svg aria-hidden width="74" height="74" viewBox="0 0 76 76" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <circle cx="38" cy="38" r="34" fill="none" stroke="var(--brand-500)" strokeWidth="2" opacity="0.4" />
        <motion.path d="M14 38 H28 L33 24 L41 52 L46 38 H62" fill="none" stroke="var(--brand-300)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeInOut' }} />
      </motion.svg>
      {/* wordmark + subtítulo entran en cascada DESPUÉS del trazo del SVG */}
      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.08, delayChildren: dur.draw } } }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <motion.div variants={staggerItem} style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: 33, color: '#fff', letterSpacing: -0.5, marginTop: 16 }}>
          Hack<span style={{ color: 'var(--brand-300)' }}>track</span>
        </motion.div>
        <motion.div variants={staggerItem} className="sm" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>tu progreso, en una sola pantalla</motion.div>
      </motion.div>
    </div>
  )
}
