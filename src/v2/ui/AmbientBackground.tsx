// Fondo ambiental "Bitácora" — SOLO en oscuro (en Papel la ref canónica es papel plano:
// [data-theme="light"] .ambient-bg lo oculta). El VIDEO ambiental volvió por decisión de Jan
// (2026-07-18), re-coloreado teal→oro con .hero-media (filtro estático) y muy tenue detrás de
// la UI; bajo prefers-reduced-motion se apaga el video y queda el glow CSS estático.
import { useReducedMotion } from 'framer-motion'
import { AutoVideo } from './AutoVideo'
import bgVideo from '../../assets/rebuild/bg-ambient.mp4'
import bgPoster from '../../assets/rebuild/bg-poster.webp'

export function AmbientBackground() {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden className="ambient-bg pointer-events-none absolute inset-0 overflow-hidden">
      {!reduce && (
        <AutoVideo
          src={bgVideo}
          poster={bgPoster}
          className="hero-media absolute inset-0 h-full w-full object-cover opacity-[0.16]"
        />
      )}
      <div className="ambient-drift absolute inset-0" />
    </div>
  )
}
