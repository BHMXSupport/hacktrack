import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Pantalla de entrada (gate): logo + nombre + una frase aspiracional aleatoria + botón "Entrar".
// PROPÓSITO TÉCNICO: el tap en "Entrar" es un gesto de usuario → desbloquea el autoplay de
// media para la sesión, así el video del preloader (que se monta después) SÍ reproduce, incluso
// en iOS Modo de bajo consumo / "no autoplay". Sin video aquí (es pre-gesto): solo CSS.
const PHRASES = [
  'La constancia es tu mejor protocolo.',
  'Lo que se mide, mejora.',
  'Tu mejor versión se construye un día a la vez.',
  'La disciplina de hoy es tu resultado de mañana.',
  'Optimiza con datos, no con suposiciones.',
  'Pequeños hábitos, grandes transformaciones.',
  'El progreso ama la precisión.',
  'Cada registro te acerca a tu objetivo.',
  'Tu evolución, bajo control.',
  'Convierte tu rutina en resultados.',
]

const LOGO = `${import.meta.env.BASE_URL}pwa-512.png`

export function EntryGate({ onEnter }: { onEnter: () => void }) {
  const reduce = useReducedMotion()
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])

  return (
    <motion.div
      className="absolute inset-0 z-[110] flex flex-col items-center justify-between overflow-hidden bg-void px-8 py-[max(48px,env(safe-area-inset-top))]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Glow ambiental en deriva (CSS, sin video — esto es pre-gesto) */}
      {!reduce && <div aria-hidden className="ambient-drift absolute inset-0" />}

      <div className="flex-1" />

      {/* Logo + nombre + frase */}
      <motion.div
        className="relative flex flex-col items-center text-center"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <img
          src={LOGO}
          alt="Hacktrack"
          className="h-24 w-24 rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,.5),0_0_0_1px_rgba(95,201,184,.18)]"
        />
        <h1 className="mt-6 text-[32px] font-bold tracking-tight">
          <span className="text-foreground">Hack</span>
          <span className="text-teal">track</span>
        </h1>
        <p className="mt-4 max-w-[280px] text-[15px] leading-relaxed text-secondary-foreground">
          {phrase}
        </p>
      </motion.div>

      <div className="flex-1" />

      {/* Botón Entrar — el tap desbloquea el autoplay del preloader */}
      <motion.button
        type="button"
        onClick={onEnter}
        className="relative h-14 w-full max-w-[360px] rounded-2xl bg-teal text-[16px] font-semibold text-[#04211c] shadow-[0_8px_24px_rgba(95,201,184,.28)] transition-transform active:scale-[.98]"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
      >
        Entrar
      </motion.button>
    </motion.div>
  )
}
