import { useEffect, useRef } from 'react'

// Video que autoreproduce de forma BULLETPROOF (incl. iOS/Safari y políticas estrictas):
// - muted/defaultMuted por ref (React no lo refleja bien → bloquearía autoplay y mostraría ▶).
// - play() inmediato + reintentos en canplay/loadeddata.
// - DESBLOQUEO en la primera interacción del usuario (pointerdown/touchstart) y al volver a foco/visible,
//   por si el navegador bloqueó el autoplay inicial.
export function AutoVideo({
  src,
  poster,
  loop = true,
  className,
}: {
  src: string
  poster?: string
  loop?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.defaultMuted = true
    const tryPlay = () => {
      const p = v.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    tryPlay()
    const onVis = () => {
      if (document.visibilityState === 'visible') tryPlay()
    }
    v.addEventListener('canplay', tryPlay)
    v.addEventListener('loadeddata', tryPlay)
    document.addEventListener('pointerdown', tryPlay, { passive: true })
    document.addEventListener('touchstart', tryPlay, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      v.removeEventListener('canplay', tryPlay)
      v.removeEventListener('loadeddata', tryPlay)
      document.removeEventListener('pointerdown', tryPlay)
      document.removeEventListener('touchstart', tryPlay)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [src])

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop={loop}
      playsInline
      preload="auto"
      aria-hidden
      className={className}
    />
  )
}
