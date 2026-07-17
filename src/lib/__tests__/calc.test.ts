// Golden: la calculadora de reconstitución SOLO CONVIERTE (aritmética U-100 sobre las
// entradas del usuario) y NUNCA devuelve una dosis recomendada. Este contrato es un
// control legal: si calc empezara a "sugerir" una dosis, cruzaría el límite de la LGS
// art. 262 (bitácora → dispositivo médico/SaMD). Los pins de abajo rompen si eso pasa.
import { describe, expect, it } from 'vitest'
import { calcRecon, doseToMg, type ReconInput } from '../calc'

const IN: ReconInput = { vial: 10, agua: 2, dosis: 250, unit: 'mcg', scale: 100 }
// vial 10 mg / agua 2 mL = 5 mg/mL ; 250 mcg = 0.25 mg ; 0.25/5 = 0.05 mL ; ×100 = 5.0 UI

describe('calcRecon — solo convierte (aritmética pura)', () => {
  it('convierte la dosis del usuario con aritmética U-100 exacta', () => {
    const r = calcRecon(IN)!
    expect(r).not.toBeNull()
    expect(r.conc).toBe(5) // vial/agua
    expect(r.mL).toBe(0.05) // doseMg/conc
    expect(r.ui).toBe(5) // mL×100
  })

  it('es una función PURA de las entradas: dos llamadas iguales → salida idéntica', () => {
    expect(calcRecon(IN)).toEqual(calcRecon(IN))
  })

  it('escala LINEALMENTE con la dosis que TECLEA el usuario (conversión, no recomendación)', () => {
    // Un motor de recomendación fijaría/limitaría la cantidad; una conversión escala 1:1.
    const base = calcRecon(IN)!
    const doble = calcRecon({ ...IN, dosis: 500 })!
    expect(doble.ui).toBe(base.ui * 2)
    expect(doble.mL).toBe(base.mL * 2)
    expect(doble.conc).toBe(base.conc) // la concentración no depende de la dosis
  })

  it('la UI depende de la concentración del vial (no es un valor fijo aconsejado)', () => {
    // Doblar el vial (más concentrado) ⇒ la mitad de volumen/UI para la MISMA dosis.
    const r = calcRecon({ ...IN, vial: 20 })!
    expect(r.conc).toBe(10)
    expect(r.ui).toBe(2.5)
  })

  it('reporta el valor LITERAL aunque exceda el barril — nunca lo recorta a un "máximo recomendado"', () => {
    const r = calcRecon({ vial: 10, agua: 2, dosis: 6, unit: 'mg', scale: 100 })!
    expect(r.ui).toBe(120) // 6 mg / 5 mg·mL⁻¹ = 1.2 mL = 120 UI
    expect(r.overCapacity).toBe(true) // solo AVISA; no sustituye la cantidad
  })

  it('reporta el valor LITERAL aunque sea de baja precisión — nunca lo sube a un "mínimo recomendado"', () => {
    const r = calcRecon({ vial: 20, agua: 2, dosis: 250, unit: 'mcg', scale: 100 })!
    expect(r.ui).toBe(2.5)
    expect(r.lowPrecision).toBe(true) // solo AVISA; deja 2.5 tal cual
  })

  it('devuelve null con entrada inválida — NUNCA inventa una dosis por defecto', () => {
    expect(calcRecon({ ...IN, dosis: 0 })).toBeNull()
    expect(calcRecon({ ...IN, dosis: -3 })).toBeNull()
    expect(calcRecon({ ...IN, vial: 0 })).toBeNull()
    expect(calcRecon({ ...IN, agua: 0 })).toBeNull()
  })

  it('la forma de la salida NO tiene ningún campo de recomendación', () => {
    const r = calcRecon(IN)!
    const keys = Object.keys(r).sort()
    // Contrato pinado: exactamente estas claves. Añadir "recommendedDose"/"dosisSugerida"
    // rompe esta prueba a propósito.
    expect(keys).toEqual(
      ['conc', 'lowPrecision', 'mL', 'mlBarril', 'overCapacity', 'scale', 'ui'].sort(),
    )
    for (const k of keys) {
      expect(k).not.toMatch(/recomend|suggest|sugerid|ideal/i)
    }
  })
})

describe('doseToMg — solo convierte unidades', () => {
  it('convierte mg/mcg/g con aritmética directa', () => {
    expect(doseToMg(2, 'mg')).toBe(2)
    expect(doseToMg(250, 'mcg')).toBe(0.25)
    expect(doseToMg(0.002, 'g')).toBeCloseTo(2)
  })

  it('convierte UI usando la reconstitución del usuario (vial+agua)', () => {
    expect(doseToMg(10, 'UI', 10, 2)).toBe(0.5) // (10/100)·(10/2)
  })

  it('devuelve null cuando NO puede convertir — nunca adivina', () => {
    expect(doseToMg(10, 'UI')).toBeNull() // UI sin reconstitución
    expect(doseToMg(0, 'mg')).toBeNull() // valor no positivo
    expect(doseToMg(5, 'unidad-desconocida')).toBeNull()
  })
})
