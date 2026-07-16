// Golden: isoKey (identidad de día local) + agrupación del diario (prependToLog vía reducer).
// Pin de la base sobre la que se hará el barrido DST (#69): isoKey en sí es local-correcto;
// la deuda vive en los consumidores que caminan días con ms fijos (ver dst.test.ts).
import { describe, expect, it } from 'vitest'
import { isoKey, mealSlot } from '../store'
import { d, dispatch, doseAction, mkState, ts } from './helpers'

describe('isoKey — clave de día local estable', () => {
  it('usa componentes locales con cero-padding', () => {
    expect(isoKey(ts(2026, 1, 5, 12, 0))).toBe('2026-01-05')
    expect(isoKey(ts(2026, 11, 30))).toBe('2026-11-30')
  })

  it('es estable alrededor de la medianoche local', () => {
    expect(isoKey(ts(2026, 6, 14, 23, 59, 59))).toBe('2026-06-14')
    expect(isoKey(ts(2026, 6, 15, 0, 0, 0))).toBe('2026-06-15')
    expect(isoKey(ts(2026, 6, 15, 0, 0, 1))).toBe('2026-06-15')
  })

  it('es correcto incluso EN el día de transición DST (la deuda #69 no está aquí)', () => {
    // 8 mar 2026: adelanto 02:00→03:00 en Tijuana. Componentes locales → día correcto.
    expect(isoKey(ts(2026, 3, 8, 1, 30))).toBe('2026-03-08') // PST, antes del salto
    expect(isoKey(ts(2026, 3, 8, 3, 30))).toBe('2026-03-08') // PDT, después del salto
  })
})

describe('agrupación del diario (prependToLog vía logDose)', () => {
  it('agrupa por día local: 23:59 y 00:01 caen en grupos distintos', () => {
    const s = dispatch(
      mkState(),
      doseAction('Ipamorelin', ts(2026, 6, 9, 23, 59)),
      doseAction('BPC-157', ts(2026, 6, 10, 0, 1)),
    )
    expect(s.log).toHaveLength(2)
    // más reciente primero
    expect(s.log[0].dateKey).toBe('2026-06-10')
    expect(s.log[1].dateKey).toBe('2026-06-09')
  })

  it('dentro del grupo ordena items por ts descendente', () => {
    const s = dispatch(
      mkState(),
      doseAction('Ipamorelin', ts(2026, 6, 10, 9, 0)),
      doseAction('BPC-157', ts(2026, 6, 10, 10, 0)),
    )
    expect(s.log).toHaveLength(1)
    expect(s.log[0].items.map((it) => it.product)).toEqual(['BPC-157', 'Ipamorelin'])
  })
})

describe('mealSlot — franja horaria es-MX', () => {
  it('mapea horas a franjas', () => {
    expect(mealSlot(ts(2026, 6, 10, 7, 30))).toBe('desayuno')
    expect(mealSlot(ts(2026, 6, 10, 14, 0))).toBe('comida')
    expect(mealSlot(ts(2026, 6, 10, 21, 0))).toBe('cena')
    expect(mealSlot(ts(2026, 6, 10, 2, 0))).toBe('antojo nocturno')
  })
})
