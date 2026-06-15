// Hacktrack — tokens de motion (fuente de verdad). Ver [[Hacktrack - Motion Spec]].
// Regla dura: animar SOLO transform + opacity. Degradar bajo prefers-reduced-motion.
import type { Transition, Variants } from 'framer-motion'

export const dur = { fast: 0.12, base: 0.22, slow: 0.36, draw: 0.6, splash: 0.8 } as const

export const ease = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  decelerate: [0, 0, 0, 1] as [number, number, number, number],
  accelerate: [0.3, 0, 1, 1] as [number, number, number, number],
}

export const spring: Record<'ui' | 'celebrate' | 'sheet', Transition> = {
  ui: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  celebrate: { type: 'spring', stiffness: 260, damping: 18, mass: 1 },
  sheet: { type: 'spring', stiffness: 280, damping: 32, mass: 1 },
}

export const stagger = { card: 0.04, list: 0.03 }

// shared-axis X (gramática Material para nav/páginas)
export const sharedAxisX: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: dur.base, ease: ease.decelerate } },
  exit: { opacity: 0, x: -24, transition: { duration: dur.base, ease: ease.accelerate } },
}

// stagger de tarjetas/listas (fade + translateY 8–12)
export const staggerParent: Variants = {
  animate: { transition: { staggerChildren: stagger.card } },
}
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.decelerate } },
}

// chip/selección: scale 1→1.04→1 (spring ui)
export const popSelect = { scale: [1, 1.04, 1] }
