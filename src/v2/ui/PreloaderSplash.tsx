import { useState, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AutoVideo } from './AutoVideo'
import preloaderSrc from '../../assets/rebuild/preloader.mp4'
import preloaderPoster from '../../assets/rebuild/preloader-poster.webp'

// Preloader de marca — video generado en Higgsfield (núcleo de energía teal pulsante),
// reproducido con AutoVideo: el MISMO motor de autoplay muted que el fondo ambiental,
// que el usuario confirmó que funciona en su dispositivo. Dura 3 s y se desvanece.
export function PreloaderSplash() {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), reduce ? 700 : 3000)
    return () => window.clearTimeout(t)
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
          {/* Póster instantáneo (sin flash) + video con AutoVideo (autoplay muted a prueba de balas) */}
          <img src={preloaderPoster} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          {!reduce && (
            <AutoVideo src={preloaderSrc} poster={preloaderPoster} className="absolute inset-0 h-full w-full object-cover" />
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
