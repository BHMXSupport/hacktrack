import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import preloaderSrc from '../../assets/rebuild/preloader.mp4'
import preloaderPoster from '../../assets/rebuild/preloader-poster.webp'

// Preloader HÍBRIDO — a prueba de la política de autoplay del dispositivo:
//  • Capa base: el PÓSTER con latido CSS (núcleo teal "respirando"). El CSS NO necesita
//    gesto del usuario, así que SIEMPRE anima — incluso en iOS Modo de bajo consumo / "no autoplay".
//  • Capa video: el video de Higgsfield encima, que SOLO aparece (fade-in) si de verdad
//    arranca a reproducirse (desktop / dispositivos que permiten autoplay). Si está bloqueado,
//    queda invisible y se ve el póster latiendo — sin botón ▶ nunca.
// Dura 3 s y se desvanece.
export function PreloaderSplash() {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(true)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const vidRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), reduce ? 700 : 3000)
    return () => window.clearTimeout(t)
  }, [reduce])

  // Intento de reproducción del video (best-effort). Si arranca → fade-in encima del póster.
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
    const onPlaying = () => setVideoPlaying(true)
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
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-void"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          role="status"
          aria-label="Cargando Hacktrack"
        >
          {/* Capa base GARANTIZADA: póster con latido CSS (no necesita gesto → siempre anima) */}
          <div
            aria-hidden
            className={`absolute inset-0 bg-cover bg-center ${reduce ? '' : 'preloader-pulse'}`}
            style={{ backgroundImage: `url(${preloaderPoster})` }}
          />
          {/* Capa video (best-effort): SIN poster propio; opacity 0 hasta que de verdad reproduce */}
          {!reduce && (
            <video
              ref={vidRef}
              src={preloaderSrc}
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${videoPlaying ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {/* Gradiente para contraste del wordmark */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/40 via-transparent to-void/70" />

          {/* Wordmark + barra de carga (texto crisp, nunca AI) */}
          <div className="relative flex flex-col items-center gap-5">
            <motion.h1
              className="text-[34px] font-bold tracking-tight"
              initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <span className="text-foreground">Hack</span>
              <span className="text-teal">track</span>
            </motion.h1>
            {!reduce && (
              <div className="h-1 w-32 overflow-hidden rounded-full bg-white/12">
                <motion.div
                  className="h-full rounded-full bg-teal"
                  initial={{ width: '6%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.7, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
