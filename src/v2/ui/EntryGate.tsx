import { useState, useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import preloaderSrc from '../../assets/rebuild/preloader.mp4'

// Pantalla de entrada (gate): logo + nombre + frase aspiracional aleatoria + botón "Entrar".
// PROPÓSITO TÉCNICO:
//  1. El tap en "Entrar" es un gesto de usuario → desbloquea el autoplay de la sesión.
//  2. Al tocar, entra en estado de CARGA (spinner) y bufferea el video del preloader; solo
//     avanza cuando el video está listo (o tras un tope). Así el gate sigue cubriendo la app
//     mientras el video carga → sin parpadeo, y el preloader arranca con el video ya cacheado.
// Sin video visible aquí (es pre-gesto): solo CSS + un <video> oculto que precarga.
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
  const [loading, setLoading] = useState(false)
  const vidRef = useRef<HTMLVideoElement>(null)

  const handleEnter = () => {
    if (loading) return
    setLoading(true)
    // Desbloquear autoplay + empezar a bufferear el video del preloader dentro del gesto.
    const v = vidRef.current
    if (v) {
      v.muted = true
      v.defaultMuted = true
      const p = v.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
  }

  // Mientras carga: esperar a que el video esté LISTO (canplaythrough / readyState 4) y, en cuanto
  // lo esté, pasar directo al preloader. Mínimo corto (anti-flicker) + tope duro de seguridad.
  useEffect(() => {
    if (!loading) return
    const v = vidRef.current
    let done = false
    const MIN = 350
    const t0 = Date.now()
    const advance = () => {
      if (done) return
      done = true
      const wait = Math.max(0, MIN - (Date.now() - t0))
      window.setTimeout(onEnter, wait)
    }
    const onReady = () => advance()
    let hardCap = 0
    if (v && v.readyState >= 4) {
      advance() // ya bufferado (cache)
    } else if (v) {
      v.addEventListener('canplaythrough', onReady)
      v.addEventListener('error', onReady) // si el video falla, no atrapar al usuario
      hardCap = window.setTimeout(advance, 12000) // último recurso si nunca queda listo
    } else {
      advance()
    }
    return () => {
      if (hardCap) window.clearTimeout(hardCap)
      if (v) {
        v.removeEventListener('canplaythrough', onReady)
        v.removeEventListener('error', onReady)
      }
    }
  }, [loading, onEnter])

  return (
    <motion.div
      className="absolute inset-0 z-[110] flex flex-col items-center justify-between overflow-hidden bg-void px-8 py-[max(48px,env(safe-area-inset-top))]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Glow ambiental en deriva (CSS, sin video) */}
      {!reduce && <div aria-hidden className="ambient-drift absolute inset-0" />}

      {/* <video> oculto que precarga/buffer del preloader durante la carga */}
      <video
        ref={vidRef}
        src={preloaderSrc}
        muted
        playsInline
        preload="auto"
        aria-hidden
        className="pointer-events-none absolute h-px w-px opacity-0"
      />

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

      {/* Botón Entrar → estado de carga (spinner) mientras bufferea el video */}
      <motion.button
        type="button"
        onClick={handleEnter}
        disabled={loading}
        aria-busy={loading}
        className="relative flex h-14 w-full max-w-[360px] items-center justify-center rounded-2xl bg-teal text-[16px] font-semibold text-[#04211c] shadow-[0_8px_24px_rgba(95,201,184,.28)] transition-transform active:scale-[.98] disabled:active:scale-100"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
      >
        {loading ? <Loader2 size={22} className="animate-spin" aria-label="Cargando" /> : 'Entrar'}
      </motion.button>
    </motion.div>
  )
}
