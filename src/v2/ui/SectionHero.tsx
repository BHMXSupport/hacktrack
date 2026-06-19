import { useReducedMotion } from 'framer-motion'
import { AutoVideo } from './AutoVideo'
import type { ReactNode } from 'react'

// Banner hero animado para encabezar una sección. Poster ligero como base instantánea +
// video loop (solo se desactiva con reduced-motion). Título sobre gradiente opaco.
export function SectionHero({
  poster,
  video,
  title,
  subtitle,
  action,
}: {
  poster: string
  video?: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const reduce = useReducedMotion()
  const play = !reduce && !!video
  return (
    <div className="relative mb-1 h-32 overflow-hidden rounded-lg">
      <img src={poster} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      {play && video && (
        <AutoVideo src={video} poster={poster} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Gradiente para garantizar contraste del título (texto crítico nunca sobre media a secas) */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-secondary-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
