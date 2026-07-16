// Golden: collectDosesByProduct + presenceNow — las dosis PK se derivan EN VIVO del ts del log
// (no hay muestras PK almacenadas). Por eso editar la hora de un registro mueve la curva
// automáticamente (debt-88: verificado no-bug en la arquitectura actual; aquí queda pinneado).
import { describe, expect, it } from 'vitest'
import { collectDosesByProduct, presenceNow } from '../pharma'
import { isoKey, reducer } from '../store'
import { H_MS, cad, d, dispatch, doseAction, mkDoseItem, mkProtocol, mkState, ts } from './helpers'

// Ipamorelin: t½ 2 h, modelo instantáneo (no bifásico) → mitades exactas por vida media
const P = 'Ipamorelin'
const T = ts(2026, 6, 10, 8, 0)

const dosed = () =>
  dispatch(
    mkState({ todayTs: ts(2026, 6, 10), protocols: { [P]: mkProtocol(P, ts(2026, 6, 1), cad({ mode: 'dia' })) } }),
    doseAction(P, T, 2, 'mg', { doseMg: 2 }),
  )

describe('collectDosesByProduct — deriva del log', () => {
  it('usa doseMg canónico y el ts del item', () => {
    const map = collectDosesByProduct(dosed())
    expect(map.get(P)).toEqual([{ product: P, value: 2, ts: T, approx: false }])
  })

  it("sin doseMg parsea `u`: mcg→mg, g→mg", () => {
    const s = mkState({
      log: [{
        dateKey: isoKey(T),
        items: [
          mkDoseItem('BPC-157', 'BPC-157 · 250 mcg', T),
          mkDoseItem('TB-500', 'TB-500 · 0.002 g', T + 1000),
        ],
      }],
    })
    const map = collectDosesByProduct(s)
    expect(map.get('BPC-157')?.[0].value).toBeCloseTo(0.25)
    expect(map.get('TB-500')?.[0].value).toBeCloseTo(2)
  })

  it('UI con reconstitución convierte a mg; sin reconstitución usa el crudo marcado approx', () => {
    const s = mkState({
      productRecon: { 'BPC-157': { vialMg: 10, aguaMl: 2 } },
      log: [{
        dateKey: isoKey(T),
        items: [
          mkDoseItem('BPC-157', 'BPC-157 · 10 UI', T), // (10/100)·(10/2) = 0.5 mg
          mkDoseItem('TB-500', 'TB-500 · 10 UI', T + 1000), // sin recon → proxy crudo
        ],
      }],
    })
    const map = collectDosesByProduct(s)
    expect(map.get('BPC-157')?.[0]).toMatchObject({ value: 0.5, approx: false })
    expect(map.get('TB-500')?.[0]).toMatchObject({ value: 10, approx: true })
  })
})

describe('presenceNow — presencia estimada ahora', () => {
  it('decae por vida media: 100% al inyectar, 50% a t½, 25% a 2·t½', () => {
    const s = dosed()
    expect(presenceNow(s, T)[0]).toMatchObject({ product: P, currentMg: 2, pct: 100 })
    expect(presenceNow(s, T + 2 * H_MS)[0].currentMg).toBeCloseTo(1)
    expect(presenceNow(s, T + 2 * H_MS)[0].pct).toBeCloseTo(50)
    expect(presenceNow(s, T + 4 * H_MS)[0].currentMg).toBeCloseTo(0.5)
  })

  it('excluye productos sin vida media conocida (NAD+) y dosis futuras', () => {
    const s = mkState({
      log: [{ dateKey: isoKey(T), items: [mkDoseItem('NAD+', 'NAD+ · 100 mg', T)] }],
    })
    expect(presenceNow(s, T + H_MS)).toEqual([])
    // dosis con ts futuro: aún no contribuye
    expect(presenceNow(dosed(), T - H_MS)).toEqual([])
  })

  // Esto es la razón arquitectónica por la que debt-88 resultó no-bug: no hay muestra PK
  // almacenada que reubicar; la curva se recalcula del ts editado.
  it('editLogTime mueve la curva PK: retrasar la dosis 2 h duplica la presencia observada', () => {
    const s1 = dosed()
    const at = T + 2 * H_MS
    expect(presenceNow(s1, at)[0].currentMg).toBeCloseTo(1) // dosis a las 08:00, medida a las 10:00
    const id = s1.log[0].items[0].id
    const s2 = reducer(s1, { t: 'editLogTime', id, ts: T - 2 * H_MS }) // la dosis "fue" a las 06:00
    expect(presenceNow(s2, at)[0].currentMg).toBeCloseTo(0.5) // ahora han pasado 2 vidas medias
  })

  it('superpone dosis: dos dosis de 2 mg con 2 h de separación', () => {
    const s = dispatch(dosed(), doseAction(P, T + 2 * H_MS, 2.5, 'mg', { doseMg: 2.5 }))
    // en T+2h: 1 mg residual + 2.5 mg recién inyectados
    expect(presenceNow(s, T + 2 * H_MS)[0].currentMg).toBeCloseTo(3.5)
  })
})
