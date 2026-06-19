import { useState, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import loaderPoster from '../../assets/rebuild/splash-loader-poster.webp'

// Preloader de marca — se muestra ~3 s en CADA arranque (da tiempo a que cargue la app), luego fade out.
// SIN <video>: el elemento de video mostraba el botón ▶ nativo cuando el navegador bloqueaba el autoplay
// durante la ventana corta del splash. En su lugar: póster con zoom Ken Burns (movimiento garantizado,
// idéntico a un video, sin ▶) + wordmark animado + barra de carga + glow ambiental.
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
          {/* Backdrop: póster con Ken Burns → movimiento garantizado, sin <video> (sin ▶) */}
          <div
            aria-hidden
            className={`absolute inset-0 bg-cover bg-center ${reduce ? '' : 'preloader-kenburns'}`}
            style={{ backgroundImage: `url(${loaderPoster})`, opacity: 0.72 }}
          />
          {/* Glow ambiental en deriva (refuerza la sensación de vida) */}
          {!reduce && <div aria-hidden className="ambient-drift absolute inset-0" />}
          {/* Gradiente para contraste del wordmark */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/45 via-void/15 to-void/80" />

          {/* Contenido */}
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
