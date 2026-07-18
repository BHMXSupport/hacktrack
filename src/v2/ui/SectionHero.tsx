import type { ReactNode } from 'react'

// SectionHero "Bitácora" — masthead EDITORIAL (ref canónica docs/design-refs): fila-kicker mono
// UPPER (eyebrow + meta), titular serif Fraunces 34px y regla de tinta de 1.5px debajo (la firma
// de cabecera de revista). Ya NO renderiza media (el banner foto/video del rebuild era ajeno al
// sistema papel-y-tinta); `poster`/`video` se aceptan para no romper a los llamadores con
// HEROES.* — pueden retirarse en la limpieza de pantallas (nota de handoff).
export function SectionHero(props: {
  poster?: string      // legado (ignorado) — el masthead editorial no lleva media
  video?: string       // legado (ignorado)
  eyebrow?: string     // kicker izquierdo, p.ej. "Vida · en tu cuerpo"
  meta?: string        // kicker derecho, p.ej. "Ahora · 14:48"
  metaClear?: boolean  // true en mastheads al TOPE de pestaña: pr-14 despeja el engrane flotante de Ajustes (AppV2)
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const { eyebrow, meta, metaClear, title, subtitle, action } = props
  return (
    // .masthead-rule (globals.css): 1.5px de tinta en Papel; canto dorado en Obsidiana (jueces).
    // Antes era style inline — un style no puede cambiar por tema sin JS; la clase sí.
    <header className="masthead-rule pb-3">
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
    </header>
  )
}
