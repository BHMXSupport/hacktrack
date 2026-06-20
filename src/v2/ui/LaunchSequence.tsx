import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import preloaderSrc from '../../assets/rebuild/preloader.mp4'
import preloaderPoster from '../../assets/rebuild/preloader-poster.webp'

// Secuencia de arranque UNIFICADA con UN solo <video> continuo (clave para que no haya frame
// estático): gate (logo + frase + Entrar) → al tocar, bufferea; cuando el video está LISTO
// EMPIEZA A CORRER detrás del gate y se mantiene +1s; luego el gate se desvanece revelando el
// warp YA EN MOVIMIENTO → reproduce su duración completa (cierra por 'ended') → app.
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
const READY_HOLD = 1000 // mantener el gate +1s tras estar listo (el video ya corre detrás)

type Phase = 'gate' | 'loading' | 'playing' | 'done'

export function LaunchSequence() {
  const reduce = useReducedMotion()
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])
  const [phase, setPhase] = useState<Phase>('gate')
  const [videoVisible, setVideoVisible] = useState(false)
  const [slowHint, setSlowHint] = useState(false)
  const vidRef = useRef<HTMLVideoElement>(null)
  const enteredRef = useRef(false) // #64: guard síncrono contra doble-tap (el estado es async)

  const handleEnter = () => {
    if (enteredRef.current || phase !== 'gate') return
    enteredRef.current = true
    setPhase('loading')
    const v = vidRef.current
    if (v) {
      v.muted = true
      v.defaultMuted = true
      const p = v.play() // intento dentro del gesto (desbloquea autoplay + empieza a bufferear)
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
  }

  // 'loading': espera a que el video esté LISTO → arráncalo → mantén +1s detrás del gate → revela.
  useEffect(() => {
    if (phase !== 'loading') return
    if (reduce) {
      const t = window.setTimeout(() => setPhase('playing'), 350)
      return () => window.clearTimeout(t)
    }
    const v = vidRef.current
    let done = false
    const reveal = () => {
      if (done) return
      done = true
      window.setTimeout(() => setPhase('playing'), READY_HOLD)
    }
    const onReady = () => {
      const p = v?.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
      reveal()
    }
    let cap = 0
    if (v && v.readyState >= 4) onReady()
    else if (v) {
      v.addEventListener('canplaythrough', onReady)
      v.addEventListener('error', onReady)
      // #6: rescate a 5s (antes 12s). En iOS Bajo Consumo el video se congela en silencio;
      // no dejamos al usuario ante un spinner mudo más de unos segundos.
      cap = window.setTimeout(reveal, 5000)
    } else {
      reveal()
    }
    return () => {
      if (cap) window.clearTimeout(cap)
      if (v) {
        v.removeEventListener('canplaythrough', onReady)
        v.removeEventListener('error', onReady)
      }
    }
  }, [phase, reduce])

  // Fade-in del video al estar realmente en marcha + cierre al terminar (8s completos).
  useEffect(() => {
    if (reduce) return
    const v = vidRef.current
    if (!v) return
    const onPlaying = () => setVideoVisible(true)
    const onEnded = () => setPhase('done')
    v.addEventListener('playing', onPlaying)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('ended', onEnded)
    }
  }, [reduce])

  // reduce-motion: sin video → cierra rápido tras revelar.
  useEffect(() => {
    if (!reduce || phase !== 'playing') return
    const t = window.setTimeout(() => setPhase('done'), 700)
    return () => window.clearTimeout(t)
  }, [reduce, phase])

  // #6: si tarda en bufferear, mostrar "Preparando…" bajo el spinner para que no parezca colgado.
  useEffect(() => {
    if (phase !== 'loading') { setSlowHint(false); return }
    const t = window.setTimeout(() => setSlowHint(true), 2200)
    return () => window.clearTimeout(t)
  }, [phase])

  if (phase === 'done') return null

  const showGate = phase === 'gate' || phase === 'loading'

  return (
    <div className="absolute inset-0 z-[100] overflow-hidden bg-void">
      {/* Video warp — montado desde el inicio (bufferea); corre detrás del gate y se revela en movimiento */}
      {!reduce && (
        <>
          <img src={preloaderPoster} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <video
            ref={vidRef}
            src={preloaderSrc}
            muted
            playsInline
            preload="auto"
            aria-hidden
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${videoVisible ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* Scrim radial para legibilidad del wordmark sobre el núcleo brillante */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 62% 26% at 50% 50%, rgba(7,11,18,.80), rgba(7,11,18,0) 70%)' }}
          />
        </>
      )}

      {/* Chrome del preloader: wordmark + barra (visible al irse el gate) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="status" aria-label="Cargando Hacktrack">
        <div className="relative flex flex-col items-center gap-5">
          <h1 className="text-[34px] font-bold tracking-tight [text-shadow:0_2px_18px_rgba(0,0,0,.65)]">
            <span className="text-foreground">Hack</span>
            <span className="text-teal">track</span>
          </h1>
          {phase === 'playing' && !reduce && (
            <div className="h-1 w-32 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full bg-teal"
                initial={{ width: '6%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 4.5, ease: 'easeInOut' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Gate overlay (z-110) — logo + frase + Entrar/spinner. Cubre el video mientras carga. */}
      <AnimatePresence>
        {showGate && (
          <motion.div
            key="gate"
            className="absolute inset-0 z-[110] flex flex-col items-center justify-between overflow-hidden bg-void px-8 py-[max(48px,env(safe-area-inset-top))]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {!reduce && <div aria-hidden className="ambient-drift absolute inset-0" />}
            <div className="flex-1" />
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
              <p className="mt-4 max-w-[280px] text-[15px] leading-relaxed text-secondary-foreground">{phrase}</p>
            </motion.div>
            <div className="flex-1" />
            <motion.button
              type="button"
              onClick={handleEnter}
              disabled={phase === 'loading'}
              aria-busy={phase === 'loading'}
              className="relative flex h-14 w-full max-w-[360px] items-center justify-center rounded-2xl bg-teal text-[16px] font-semibold text-[#04211c] shadow-[0_8px_24px_rgba(95,201,184,.28)] transition-transform active:scale-[.98] disabled:active:scale-100"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
            >
              {phase === 'loading' ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={22} className="animate-spin" aria-label="Cargando" />
                  {slowHint && <span className="text-[15px]">Preparando…</span>}
                </span>
              ) : (
                'Entrar'
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
