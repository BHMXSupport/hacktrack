import { describe, it, expect } from 'vitest'
import {
  easeSignature,
  countUpValue,
  resolveCountUp,
  roundTo,
  DEFAULT_DURATION,
} from '../../v2/lib/useCountUp'

// La suite corre en entorno Node (sin DOM/render): se fija el NÚCLEO PURO del hook.
// El contrato: (1) cuenta hasta el valor final; (2) reduced-motion / camino instantáneo
// devuelve el final de inmediato; (3) figuras tabular-seguras (redondeo estable).

describe('easeSignature — firma cubic-bezier(0.16,1,0.3,1)', () => {
  it('tiene endpoints exactos 0→0 y 1→1', () => {
    expect(easeSignature(0)).toBe(0)
    expect(easeSignature(1)).toBe(1)
  })

  it('clampa fuera de [0,1]', () => {
    expect(easeSignature(-0.5)).toBe(0)
    expect(easeSignature(2)).toBe(1)
  })

  it('es monótona creciente y acotada en [0,1] (nunca sobrepasa → no hay overshoot)', () => {
    let prev = -Infinity
    for (let x = 0; x <= 1.0001; x += 0.05) {
      const y = easeSignature(Math.min(1, x))
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = y
    }
  })

  it('ease-out: adelanta al progreso lineal al inicio', () => {
    expect(easeSignature(0.25)).toBeGreaterThan(0.25)
  })
})

describe('countUpValue — cuenta hasta el valor final', () => {
  it('en p=1 devuelve EXACTAMENTE el valor final', () => {
    expect(countUpValue(0, 100, 1)).toBe(100)
    expect(countUpValue(20, 80, 1)).toBe(80)
    expect(countUpValue(0, 92, 1)).toBe(92)
  })

  it('en p=0 devuelve el valor inicial', () => {
    expect(countUpValue(0, 100, 0)).toBe(0)
    expect(countUpValue(12, 80, 0)).toBe(12)
  })

  it('clampa progreso fuera de rango al final/inicio', () => {
    expect(countUpValue(0, 100, 1.7)).toBe(100)
    expect(countUpValue(0, 100, -3)).toBe(0)
  })

  it('a media cuenta queda estrictamente entre inicio y fin, sin pasarse', () => {
    const mid = countUpValue(0, 100, 0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(100)
  })

  it('funciona con conteo descendente (fin < inicio)', () => {
    expect(countUpValue(100, 40, 1)).toBe(40)
    const mid = countUpValue(100, 40, 0.5)
    expect(mid).toBeLessThan(100)
    expect(mid).toBeGreaterThan(40)
  })
})

describe('resolveCountUp — camino reduced-motion / instantáneo devuelve el final YA', () => {
  it('reduced-motion → valor final inmediato', () => {
    expect(resolveCountUp(78.4, { reduced: true })).toBe(78.4)
    expect(resolveCountUp(92, { reduced: true, from: 0 })).toBe(92)
  })

  it('duración ≤ 0 → valor final inmediato (sin animar)', () => {
    expect(resolveCountUp(92, { duration: 0 })).toBe(92)
    expect(resolveCountUp(92, { duration: -1 })).toBe(92)
  })

  it('camino animado (no reduced, duración > 0) arranca desde `from`', () => {
    expect(resolveCountUp(92, { reduced: false, duration: 0.7, from: 0 })).toBe(0)
    expect(resolveCountUp(92, { reduced: false, duration: DEFAULT_DURATION })).toBe(0)
    expect(resolveCountUp(92, { reduced: false, from: 20 })).toBe(20)
  })
})

describe('roundTo — figuras tabular-seguras (ancho estable)', () => {
  it('fija los decimales al redondear', () => {
    expect(roundTo(78.44, 1)).toBe(78.4)
    expect(roundTo(7.199, 1)).toBe(7.2)
    expect(roundTo(99.996, 2)).toBe(100)
    expect(roundTo(92.5, 0)).toBe(93)
  })
})
