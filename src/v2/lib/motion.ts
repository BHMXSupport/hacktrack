// Hacktrack — Design System "Bitácora": sistema de "number motion".
// Regla dura: animar SOLO transform / opacity / pathLength (GPU). Bajo prefers-reduced-motion
// los consumidores cortan a estado asentado (usan useReducedMotion de framer o prefersReducedMotion()).
// Easing firma editorial: cubic-bezier(0.16, 1, 0.3, 1) (ease-out expresivo).
import type { Variants } from 'framer-motion'

// Firma de easing compartida. Framer acepta el arreglo directo en `ease`.
export const EASE = [0.16, 1, 0.3, 1] as const
export const EASE_CSS = 'cubic-bezier(0.16,1,0.3,1)'

// Duraciones (segundos). count = numerales hero; draw = anillo/curvas de plasma.
export const DUR = { fast: 0.12, base: 0.22, slow: 0.36, count: 0.7, draw: 0.9 } as const

// Escalonado de tarjetas/listas.
export const STAGGER = 0.06

// Lectura guardada de la preferencia de movimiento (segura en SSR/entorno sin DOM).
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// fadeUp — entrada de cualquier bloque: opacidad + translateY (GPU).
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
}

// staggerContainer + staggerItem — escalonado de hijos (cards/filas).
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER, delayChildren: 0.02 } },
}
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
}
// Alias corto (compat con quien pida `stagger`).
export const stagger = staggerContainer

// ringDraw — el anillo de adherencia dibuja su arco (pathLength 0→1, ~0.9s).
// El glow se intensifica al llegar a meta en el componente (opacidad del filtro/sombra).
export const ringDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0.9 },
  show: { pathLength: 1, opacity: 1, transition: { pathLength: { duration: DUR.draw, ease: EASE } } },
}

// pathDraw — curvas de plasma / sparklines: pathLength 0→1 escalonado por índice `custom`.
// El relleno de área hace fade-in por detrás (opacidad).
export const pathDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: DUR.draw, ease: EASE, delay: i * 0.08 },
      opacity: { duration: 0.2, delay: i * 0.08 },
    },
  }),
}
