import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { EASE } from '../lib/motion'

// FolioLabel "Bitácora" — el graft de §-folios (VEREDICTO v2): cabecera de sección numerada
//   § 01 ■ ADHERENCIA · JULIO ─────────────
// mono UPPER 12px (piso de label) + tick ÁMBAR de 6px + hairline que se "imprime" (rule-wipe,
// scaleX 0→1 origen izquierda — la firma editorial). Bajo reduced-motion la regla aparece asentada.
// Uso: encabezar secciones de las pantallas principales (Inicio, Vida, Diario, Cuerpo).
export function FolioLabel({
  n,
  children,
  className,
}: {
  n?: number           // número de folio (§ 01, § 02…); omitir para una cabecera sin folio
  children: ReactNode  // el label de sección (se muestra en mayúsculas)
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2',
        className,
      )}
    >
      {n != null && (
        <span className="tabular-nums" aria-hidden>
          § {String(n).padStart(2, '0')}
        </span>
      )}
      {/* Tick ámbar de 6px — energía/atención, solo-gráfico (nunca texto). */}
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-amber" />
      <span className="min-w-0">{children}</span>
      {/* Regla que se imprime (rule-wipe). color-mix porque el alfa sobre var() no se emite en utilidades. */}
      <motion.span
        aria-hidden
        className="h-[1.5px] min-w-4 flex-1 origin-left"
        style={{ background: 'color-mix(in srgb, var(--ink-3) 45%, transparent)' }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
      />
    </div>
  )
}
