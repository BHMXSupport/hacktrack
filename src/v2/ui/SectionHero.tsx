import type { ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { AutoVideo } from './AutoVideo'

// SectionHero "Bitácora" — masthead EDITORIAL (ref canónica docs/design-refs): fila-kicker mono
// UPPER (eyebrow + meta), titular serif Fraunces 34px y regla de tinta de 1.5px debajo (la firma
// de cabecera de revista). Los heroes de video VOLVIERON por decisión de Jan (2026-07-18):
// se renderizan como PLACA editorial (marco hairline + radio, como figura impresa) debajo de la
// regla, re-coloreados teal→oro con .hero-media (filtro estático — la regla del sistema prohíbe
// ANIMAR filtros, no filtros fijos). Reduced-motion → solo el poster.
export function SectionHero(props: {
  poster?: string      // placa: imagen base / fallback reduced-motion
  video?: string       // placa: loop de video (HEROES.*)
  eyebrow?: string     // kicker izquierdo, p.ej. "Vida · en tu cuerpo"
  meta?: string        // kicker derecho, p.ej. "Ahora · 14:48"
  metaClear?: boolean  // true en mastheads al TOPE de pestaña: pr-14 despeja el engrane flotante de Ajustes (AppV2)
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const { poster, video, eyebrow, meta, metaClear, title, subtitle, action } = props
  const reduce = useReducedMotion()
  return (
    // .masthead-rule (globals.css): 1.5px de tinta en Papel; canto dorado en Obsidiana (jueces).
    <header className="pb-3">
      <div className="masthead-rule pb-3">
        {(eyebrow || meta) && (
          <div className={`flex items-center justify-between gap-3 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2${metaClear ? ' pr-14' : ''}`}>
            <span className="truncate">{eyebrow}</span>
            {meta && <span className="shrink-0 tabular-nums">{meta}</span>}
          </div>
        )}
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="font-serif text-[34px] font-normal leading-none tracking-[-0.01em] text-ink">{title}</h1>
          {action && <div className="shrink-0 pb-0.5">{action}</div>}
        </div>
        {subtitle && <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{subtitle}</p>}
      </div>
      {(poster || video) && (
        <figure className="mt-3 overflow-hidden rounded-sm border border-hairline" aria-hidden>
          {video && !reduce ? (
            <AutoVideo src={video} poster={poster} className="hero-media block h-auto w-full" />
          ) : poster ? (
            <img src={poster} alt="" loading="lazy" decoding="async" className="hero-media block h-auto w-full" />
          ) : null}
        </figure>
      )}
    </header>
  )
}
