import { useEffect, useRef } from 'react'

// Video que autoreproduce de forma CONFIABLE (incl. iOS/Safari).
// Fix clave: React no refleja bien el atributo `muted` a la propiedad del DOM →
// el navegador lo trata como con audio y bloquea autoplay (muestra botón ▶).
// Aquí seteamos muted por ref + llamamos play() programáticamente.
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
    v.addEventListener('canplay', tryPlay)
    v.addEventListener('loadeddata', tryPlay)
    return () => {
      v.removeEventListener('canplay', tryPlay)
      v.removeEventListener('loadeddata', tryPlay)
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
