import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import preloaderSrc from '../../assets/rebuild/preloader.mp4'
import preloaderPoster from '../../assets/rebuild/preloader-poster.webp'

// Preloader — video WARP de Higgsfield (Veo 3.1). El gate previo ya desbloqueó el autoplay y
// bufferó el video, así que aquí reproduce de inmediato. El wordmark "Hacktrack" se compone
// crisp sobre el punto de fuga central (nunca AI). Dura 3 s y se desvanece. (Sin animación CSS.)
export function PreloaderSplash({ onDone }: { onDone?: () => void }) {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(true)
  const [playing, setPlaying] = useState(false)
  const vidRef = useRef<HTMLVideoElement>(null)

  // Cierra el preloader cuando el video TERMINA de verdad (8s completos), no por un timer fijo
  // desde el montaje (que cortaba antes porque el video arranca un instante después).
  useEffect(() => {
    if (reduce) {
      const t = window.setTimeout(() => setShow(false), 700)
      return () => window.clearTimeout(t)
    }
    const v = vidRef.current
    const onEnded = () => setShow(false)
    if (v) v.addEventListener('ended', onEnded)
    const fallback = window.setTimeout(() => setShow(false), 10000) // seguridad si 'ended' no dispara
    return () => {
      if (v) v.removeEventListener('ended', onEnded)
      window.clearTimeout(fallback)
    }
  }, [reduce])

  useEffect(() => {
    if (reduce) return
    const v = vidRef.current
    if (!v) return
    v.muted = true
    v.defaultMuted = true
    const tryPlay = () => {
      const p = v.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    const onPlaying = () => setPlaying(true)
    tryPlay()
    v.addEventListener('canplay', tryPlay)
    v.addEventListener('loadeddata', tryPlay)
    v.addEventListener('playing', onPlaying)
    document.addEventListener('pointerdown', tryPlay, { passive: true })
    document.addEventListener('touchstart', tryPlay, { passive: true })
    return () => {
      v.removeEventListener('canplay', tryPlay)
      v.removeEventListener('loadeddata', tryPlay)
      v.removeEventListener('playing', onPlaying)
      document.removeEventListener('pointerdown', tryPlay)
      document.removeEventListener('touchstart', tryPlay)
    }
  }, [reduce])

  return (
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-void"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          role="status"
          aria-label="Cargando Hacktrack"
        >
          {/* Póster instantáneo (sin flash) + video warp (fade-in al reproducir) */}
          <img src={preloaderPoster} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          {!reduce && (
            <video
              ref={vidRef}
              src={preloaderSrc}
              muted
              playsInline
              preload="auto"
              aria-hidden
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${playing ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {/* Scrim radial al centro para legibilidad del wordmark sobre el núcleo brillante */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 62% 26% at 50% 50%, rgba(7,11,18,.80), rgba(7,11,18,0) 70%)' }}
          />

          {/* Wordmark "Hacktrack" en el punto de fuga (crisp, compuesto) + barra */}
          <div className="relative flex flex-col items-center gap-5">
            <h1
              className="text-[34px] font-bold tracking-tight [text-shadow:0_2px_18px_rgba(0,0,0,.65)]"
            >
              <span className="text-foreground">Hack</span>
              <span className="text-teal">track</span>
            </h1>
            {!reduce && (
              <div className="h-1 w-32 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-teal"
                  initial={{ width: '4%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 8, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
