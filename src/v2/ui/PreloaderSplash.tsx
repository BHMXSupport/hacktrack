import { useState, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AutoVideo } from './AutoVideo'
import loaderSrc from '../../assets/rebuild/splash-loader.mp4'
import loaderPoster from '../../assets/rebuild/splash-loader-poster.webp'

// Preloader de marca animado — se muestra en CADA arranque mientras carga, luego se desvanece.
export function PreloaderSplash() {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), reduce ? 500 : 1800)
    return () => window.clearTimeout(t)
  }, [reduce])
  const play = !reduce

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
          <img src={loaderPoster} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-70" />
          {play && (
            <AutoVideo src={loaderSrc} poster={loaderPoster} loop={false} className="absolute inset-0 h-full w-full object-cover opacity-80" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/40 via-transparent to-void/75" />
          <div className="relative flex flex-col items-center gap-5">
            <h1 className="text-[34px] font-bold tracking-tight">
              <span className="text-foreground">Hack</span>
              <span className="text-teal">track</span>
            </h1>
            {!reduce && (
              <div className="h-1 w-32 overflow-hidden rounded-full bg-white/12">
                <motion.div
                  className="h-full rounded-full bg-teal"
                  initial={{ width: '8%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.6, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
