import { useReducedMotion } from 'framer-motion'
import { canAutoplayHeavyMedia } from '../lib/media'
import bgPoster from '../../assets/rebuild/bg-poster.webp'
import bgVideo from '../../assets/rebuild/bg-ambient.mp4'

// Fondo ambiental sutil (NO invasivo): poster casi-imperceptible siempre + video lentísimo
// gateado (Save-Data/conexión/reduced-motion), a muy baja opacidad, detrás de toda la UI.
export function AmbientBackground() {
  const reduce = useReducedMotion()
  const play = !reduce && canAutoplayHeavyMedia()
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img src={bgPoster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.32]" />
      {play && (
        <video
          src={bgVideo}
          poster={bgPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.32]"
        />
      )}
    </div>
  )
}
