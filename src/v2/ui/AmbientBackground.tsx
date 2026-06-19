import { useReducedMotion } from 'framer-motion'
import { AutoVideo } from './AutoVideo'
import bgPoster from '../../assets/rebuild/bg-poster.webp'
import bgVideo from '../../assets/rebuild/bg-ambient.mp4'

// Fondo ambiental sutil (NO invasivo), detrás de toda la UI:
//  - poster casi-imperceptible siempre
//  - capa de movimiento CSS garantizado (drift de glow teal) — visible aunque el navegador
//    bloquee el autoplay del video (iOS/Safari/Low-Power)
//  - video lentísimo encima cuando el autoplay sí está permitido
// Solo se desactiva el movimiento con prefers-reduced-motion (accesibilidad).
export function AmbientBackground() {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden className="ambient-bg pointer-events-none absolute inset-0 overflow-hidden">
      <img src={bgPoster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.32]" />
      {!reduce && <div className="ambient-drift absolute inset-0" />}
      {!reduce && (
        <AutoVideo src={bgVideo} poster={bgPoster} className="absolute inset-0 h-full w-full object-cover opacity-[0.32]" />
      )}
    </div>
  )
}
