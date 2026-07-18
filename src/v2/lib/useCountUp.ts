// Hacktrack — Design System "Bitácora": useCountUp.
// TODO numeral hero cuenta hacia arriba (adherencia %, mg, kg, racha días, sueño h).
// Figuras tabulares (el ancho no salta) + prefers-reduced-motion → valor final al instante.
// Núcleo PURO y exportado (easeSignature / countUpValue / resolveCountUp / roundTo) para
// poder fijarlo en tests de Node sin render (la suite es lógica pura, sin DOM).
import { useEffect, useRef, useState } from 'react'
import { EASE, prefersReducedMotion } from './motion'

export const DEFAULT_DURATION = 0.7 // segundos

export interface CountUpOptions {
  duration?: number   // segundos (default 0.7)
  from?: number       // valor inicial de la cuenta (default 0)
  decimals?: number   // dígitos tras el punto (default: 0 si entero, 1 si no)
  reduced?: boolean   // forzar reduced-motion (default: lee la preferencia del SO)
}

// Evaluador cubic-bezier(x1,y1,x2,y2) estilo CSS: dado x∈[0,1] (progreso de tiempo) devuelve
// y (progreso eased). Sin dependencias → seguro en Node. Newton-Raphson + bisección de respaldo.
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  const solveT = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x
      if (Math.abs(dx) < 1e-6) return t
      const d = sampleDX(t)
      if (Math.abs(d) < 1e-6) break
      t -= dx / d
    }
    let lo = 0
    let hi = 1
    let tt = x
    for (let i = 0; i < 20; i++) {
      const dx = sampleX(tt) - x
      if (Math.abs(dx) < 1e-6) return tt
      if (dx > 0) hi = tt
      else lo = tt
      tt = (lo + hi) / 2
    }
    return tt
  }
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    return sampleY(solveT(x))
  }
}

// Firma de easing "Bitácora": cubic-bezier(0.16, 1, 0.3, 1). Endpoints exactos (0→0, 1→1),
// monótona y acotada en [0,1] → la cuenta nunca sobrepasa el valor final.
const [X1, Y1, X2, Y2] = EASE
export const easeSignature = cubicBezier(X1, Y1, X2, Y2)

// Valor mostrado a un progreso temporal LINEAL p∈[0,1] (fuera de rango se clampa).
// En p=1 devuelve EXACTAMENTE `to` (cuenta hasta el valor final).
export function countUpValue(from: number, to: number, p: number): number {
  const clamped = p <= 0 ? 0 : p >= 1 ? 1 : p
  return from + (to - from) * easeSignature(clamped)
}

// Redondeo tabular-seguro (ancho estable): fija los decimales del readout.
export function roundTo(n: number, decimals: number): number {
  const f = 10 ** Math.max(0, Math.floor(decimals))
  return Math.round(n * f) / f
}

function inferDecimals(v: number): number {
  return Number.isInteger(v) ? 0 : 1
}

// Valor a mostrar de INMEDIATO al montar: si reduced-motion o duración≤0 → FINAL al instante;
// si no, arranca desde `from` (default 0). Es el contrato que fija el test.
export function resolveCountUp(value: number, opts: CountUpOptions = {}): number {
  const duration = opts.duration ?? DEFAULT_DURATION
  const reduced = opts.reduced ?? prefersReducedMotion()
  if (reduced || duration <= 0) return value
  return opts.from ?? 0
}

// Hook: cuenta con requestAnimationFrame desde el valor mostrado hasta `value`.
// Al cambiar `value` reanima desde el valor actual (no salta). Honra reduced-motion.
export function useCountUp(value: number, opts: CountUpOptions = {}): number {
  const duration = opts.duration ?? DEFAULT_DURATION
  const decimals = opts.decimals ?? inferDecimals(value)
  const reduced = opts.reduced ?? prefersReducedMotion()

  const [display, setDisplay] = useState<number>(() =>
    resolveCountUp(value, { ...opts, duration, reduced }),
  )
  // Arranca la próxima animación desde el valor mostrado (no salta al reanimar en cambios de `value`).
  const fromRef = useRef<number>(display)

  useEffect(() => {
    if (reduced || duration <= 0) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const start = fromRef.current
    const startTs = performance.now()
    const ms = duration * 1000
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - startTs) / ms)
      setDisplay(roundTo(countUpValue(start, value, p), decimals))
      if (p < 1) raf = requestAnimationFrame(step)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduced, decimals])

  return roundTo(display, decimals)
}

export default useCountUp
