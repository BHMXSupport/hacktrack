import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useModalStack } from './modalStack'
import { cn } from '../../lib/cn'

// TermInfo "Bitácora" — Ley 2 del panel: "es-MX plano primero; la jerga a la mano". Un '?' sutil en línea
// que revela UNA línea de explicación llana al tocar (t½, % del pico, AUC, adherencia…). También es una
// victoria de cumplimiento: menos encuadre clínico. Accesible: botón real (Enter/Espacio), aria-expanded +
// aria-controls, cierra con Escape vía la pila global de modales (modalStack) y tocando fuera.
// Visual 24px, ÁREA DE TOQUE 44px: un pseudo-elemento invisible extiende el hit-area (before:-inset-2.5)
// sin alterar el layout en línea — cumple el piso ≥44px de la app sin agrandar la afordancia.
export function TermInfo({
  term,
  children,
  className,
}: {
  term?: string        // el término, para el aria-label "¿Qué es …?"
  children: string     // la explicación en UNA línea, es-MX plano
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const popId = useId()
  useModalStack(open, () => setOpen(false))

  return (
    <span className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={term ? `¿Qué es ${term}?` : 'Más información'}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-6 w-6 place-items-center rounded-full border border-hairline bg-transparent text-ink-2 transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
      >
        {/* Glifo mono (el "(?)" de instrumento de la ref canónica). */}
        <span className="font-mono text-[12px] leading-none" aria-hidden>?</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* Captura de toque fuera para cerrar (sin robar foco al botón). */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[10000] cursor-default"
            />
            <motion.span
              id={popId}
              role="note"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              className="glass absolute bottom-[calc(100%+8px)] left-1/2 z-[10001] block w-[220px] max-w-[76vw] -translate-x-1/2 rounded-md p-3 text-[13px] font-normal leading-snug text-ink shadow-soft"
            >
              {children}
            </motion.span>
          </>
        )}
      </AnimatePresence>
    </span>
  )
}
