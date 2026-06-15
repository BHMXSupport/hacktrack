import { motion } from 'framer-motion'

export function Splash() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0B1220,#063B36)' }}>
      <motion.svg width="74" height="74" viewBox="0 0 76 76" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <circle cx="38" cy="38" r="34" fill="none" stroke="#1B8A7D" strokeWidth="2" opacity="0.4" />
        <motion.path d="M14 38 H28 L33 24 L41 52 L46 38 H62" fill="none" stroke="#5FC9B8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeInOut' }} />
      </motion.svg>
      <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: 33, color: '#fff', letterSpacing: -0.5, marginTop: 16 }}>
        Hack<span style={{ color: '#5FC9B8' }}>track</span>
      </div>
      <div className="sm" style={{ color: '#9AA6BF', marginTop: 8 }}>tu progreso, en una sola pantalla</div>
    </div>
  )
}
