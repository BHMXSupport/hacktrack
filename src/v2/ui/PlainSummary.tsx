import { type ReactNode } from 'react'
import { cn } from '../../lib/cn'

// PlainSummary "Bitácora" — Ley 1 del panel (revelación progresiva): la cabecera en lenguaje LLANO que
// encabeza Vida/Cuerpo. Ref canónica: la frase llana va en SANS 16px (los <b> cargan el énfasis); el
// serif queda para los NUMERALES/lecturas (StatNumber al lado). Siempre ANTES de cualquier figura
// científica: Rodrigo baja al detalle; Carmen/Mariana/Beto nunca son emboscados.
export function PlainSummary({
  eyebrow,
  children,
  stat,
  className,
}: {
  eyebrow?: string     // etiqueta mono UPPER opcional encima
  children: ReactNode  // la frase en lenguaje llano (usar <b> para el dato clave)
  stat?: ReactNode     // opcional: un StatNumber / lectura al lado (o debajo en móvil)
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {eyebrow && (
        <span className="font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">{eyebrow}</span>
      )}
      <div className={cn('flex flex-col gap-4', stat && 'min-[380px]:flex-row min-[380px]:items-end min-[380px]:justify-between')}>
        <p className="max-w-[34ch] text-[16px] font-normal leading-relaxed text-ink [&_b]:font-semibold">{children}</p>
        {stat && <div className="shrink-0">{stat}</div>}
      </div>
    </div>
  )
}
