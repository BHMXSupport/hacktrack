// Golden: casos del reducer — logDose (backstops + vialStock + keepSheet), editLogTime
// (reagrupación + reubicación de history), saveMeasure (coalesce 60 s AS-IS) y el pin del
// overwrite de electrolitos (debt-90). Timestamps fijos siempre (jun 2026).
import { describe, expect, it } from 'vitest'
import { isoKey, reducer } from '../store'
import { cad, d, dispatch, doseAction, findItem, mkProtocol, mkState, ts } from './helpers'

const P = 'Ipamorelin'
const stateWithVial = (usedMg = 0) =>
  mkState({
    todayTs: ts(2026, 6, 10),
    protocols: { [P]: mkProtocol(P, ts(2026, 6, 1), cad({ mode: 'dia' }), { vialStock: { totalMg: 10, usedMg } }) },
  })

describe('logDose — entrada al diario + stock del vial', () => {
  it('crea el item de dosis con sus campos y descuenta el vial', () => {
    const s = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    expect(s.log).toHaveLength(1)
    const it0 = s.log[0].items[0]
    expect(it0).toMatchObject({ type: 'dose', product: P, value: 0.25, unit: 'mg', doseMg: 0.25, ts: ts(2026, 6, 10, 9, 0) })
    expect(it0.u).toBe('Ipamorelin · 0.25 mg')
    expect(s.protocols[P].vialStock?.usedMg).toBe(0.25)
    expect(s.logged).toBe(true)
    expect(s.toast).toBe('Dosis registrada')
    expect(s.toastUndoId).toBe(it0.id)
    expect(s.sheet).toBeNull()
    expect(s.productDoses[P]).toEqual({ value: 0.25, unit: 'mg' })
  })

  it('guard anti doble-tap: dosis idéntica < 5 s devuelve el MISMO estado', () => {
    const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    const s2 = reducer(s1, doseAction(P, ts(2026, 6, 10, 9, 0, 3), 0.25, 'mg', { doseMg: 0.25 }))
    expect(s2).toBe(s1) // sin cambios: mismo objeto
  })

  // Backstop del MISMO DÍA: no duplica el item Y NO descuenta el vial dos veces (fix #17)
  it('backstop anti-duplicado del mismo día: avisa y no vuelve a descontar stock', () => {
    const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    const s2 = reducer(s1, doseAction(P, ts(2026, 6, 10, 14, 0), 0.25, 'mg', { doseMg: 0.25 }))
    expect(s2.log).toBe(s1.log) // el log no cambió
    expect(s2.protocols[P].vialStock?.usedMg).toBe(0.25)
    expect(s2.toast).toBe(`Ya hay una dosis de ${P} registrada ese día`)
  })

  it('una dosis con VALOR distinto el mismo día SÍ se registra (corrección legítima)', () => {
    const s = dispatch(
      stateWithVial(),
      doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }),
      doseAction(P, ts(2026, 6, 10, 14, 0), 0.5, 'mg', { doseMg: 0.5 }),
    )
    expect(s.log[0].items).toHaveLength(2)
    expect(s.protocols[P].vialStock?.usedMg).toBe(0.75)
  })

  it('keepSheet=true no cierra la hoja; sin keepSheet la cierra', () => {
    const open = dispatch(stateWithVial(), { t: 'sheet', sheet: 'registrar' })
    const kept = reducer(open, doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { keepSheet: true }))
    expect(kept.sheet).toBe('registrar')
    const closed = reducer(open, doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg'))
    expect(closed.sheet).toBeNull()
  })

  it('la reconstitución inicializa vialStock si no había, y reconDate NO se pisotea después', () => {
    const noVial = mkState({
      todayTs: ts(2026, 6, 10),
      protocols: { [P]: mkProtocol(P, ts(2026, 6, 1), cad({ mode: 'dia' })) },
    })
    const s1 = reducer(noVial, doseAction(P, ts(2026, 6, 10, 9, 0), 10, 'UI', { doseMg: 0.5, recon: { vialMg: 10, aguaMl: 2 } }))
    expect(s1.protocols[P].vialStock).toEqual({ totalMg: 10, usedMg: 0.5 })
    expect(s1.productRecon[P]).toEqual({ vialMg: 10, aguaMl: 2, reconDate: ts(2026, 6, 10, 9, 0) })
    const s2 = reducer(s1, doseAction(P, ts(2026, 6, 11, 9, 0), 10, 'UI', { doseMg: 0.5, recon: { vialMg: 10, aguaMl: 2 } }))
    expect(s2.productRecon[P].reconDate).toBe(ts(2026, 6, 10, 9, 0)) // fecha de mezcla original
    expect(s2.protocols[P].vialStock?.usedMg).toBe(1)
  })
})

describe('editLogTime — reagrupa por dateKey y reubica el history de medidas', () => {
  it('mueve una dosis a otro día: nuevo grupo, grupo viejo eliminado, t/ts actualizados', () => {
    const s1 = dispatch(mkState(), doseAction(P, ts(2026, 6, 9, 9, 0)))
    const id = s1.log[0].items[0].id
    const s2 = reducer(s1, { t: 'editLogTime', id, ts: ts(2026, 6, 3, 15, 30) })
    expect(s2.log).toHaveLength(1)
    expect(s2.log[0].dateKey).toBe('2026-06-03')
    const moved = s2.log[0].items[0]
    expect(moved.ts).toBe(ts(2026, 6, 3, 15, 30))
    expect(moved.t).toBe('3:30 PM')
  })

  it('mueve la muestra de history de una medida al nuevo ts', () => {
    const s1 = dispatch(mkState(), { t: 'saveMeasure', name: 'Peso', value: 80, ts: ts(2026, 6, 9, 10, 0) })
    const id = findItem(s1, (it) => it.type === 'medida' && it.n === 'Peso').id
    const s2 = reducer(s1, { t: 'editLogTime', id, ts: ts(2026, 6, 3, 10, 0) })
    expect(s2.history['Peso']).toEqual([{ ts: ts(2026, 6, 3, 10, 0), value: 80 }])
    expect(s2.log[0].dateKey).toBe('2026-06-03')
  })

  it('si el movimiento cambia cuál muestra es la última, recalcula measureValues y profile', () => {
    const s1 = dispatch(
      mkState(),
      { t: 'saveMeasure', name: 'Peso', value: 80, ts: ts(2026, 6, 9, 10, 0) },
      { t: 'saveMeasure', name: 'Peso', value: 82, ts: ts(2026, 6, 10, 10, 0) },
    )
    expect(s1.measureValues['Peso']).toBe(82)
    const id82 = findItem(s1, (it) => it.type === 'medida' && it.ts === ts(2026, 6, 10, 10, 0)).id
    const s2 = reducer(s1, { t: 'editLogTime', id: id82, ts: ts(2026, 6, 1, 9, 0) })
    // ahora la muestra de 80 kg (9 jun) es la más reciente
    expect(s2.measureValues['Peso']).toBe(80)
    expect(s2.profile.peso).toBe(80)
    expect(s2.history['Peso'].map((x) => x.value)).toEqual([82, 80]) // ordenado asc por ts
  })
})

describe('saveMeasure — coalesce de 60 s (semántica actual: SOLO mismo día)', () => {
  const T0 = ts(2026, 6, 10, 10, 0, 0)

  it('< 60 s: actualiza el item existente (mismo id) y reemplaza la última muestra', () => {
    const s1 = dispatch(mkState(), { t: 'saveMeasure', name: 'Peso', value: 80, ts: T0 })
    const id = s1.log[0].items[0].id
    const s2 = reducer(s1, { t: 'saveMeasure', name: 'Peso', value: 81, ts: T0 + 30_000 })
    expect(s2.log[0].items).toHaveLength(1)
    expect(s2.log[0].items[0].id).toBe(id)
    expect(s2.log[0].items[0].ts).toBe(T0 + 30_000)
    expect(s2.history['Peso']).toEqual([{ ts: T0 + 30_000, value: 81 }])
    expect(s2.measureValues['Peso']).toBe(81)
  })

  it('≥ 60 s: crea un item y una muestra nuevos', () => {
    const s = dispatch(
      mkState(),
      { t: 'saveMeasure', name: 'Peso', value: 80, ts: T0 },
      { t: 'saveMeasure', name: 'Peso', value: 81, ts: T0 + 90_000 },
    )
    expect(s.log[0].items).toHaveLength(2)
    expect(s.history['Peso']).toHaveLength(2)
  })

  // PIN AS-IS (debt-70 / handoff #70): el coalesce solo busca en el grupo del día del guardado.
  // Un stepper que cruza la medianoche (23:59:30 → 00:00:10, 40 s después) NO coalesce:
  // crea un segundo item en el grupo del día nuevo y una segunda muestra en history.
  // Comportamiento actual documentado, no deseado necesariamente — si la siguiente ola lo
  // cambia (coalesce por proximidad de ts), este test debe actualizarse a la nueva semántica.
  it('cruce de medianoche dentro de la ventana de 60 s NO coalesce (semántica actual)', () => {
    const s = dispatch(
      mkState(),
      { t: 'saveMeasure', name: 'Peso', value: 80, ts: ts(2026, 6, 9, 23, 59, 30) },
      { t: 'saveMeasure', name: 'Peso', value: 81, ts: ts(2026, 6, 10, 0, 0, 10) },
    )
    expect(s.log).toHaveLength(2) // dos grupos: 09 y 10 jun
    expect(s.log.map((g) => g.dateKey)).toEqual(['2026-06-10', '2026-06-09'])
    expect(s.history['Peso']).toHaveLength(2)
  })

  // PIN AS-IS (debt-90): Comida.addElectro calcula `next = current + delta·step` con el valor
  // del RENDER anterior. Dos taps antes del re-render despachan el MISMO valor absoluto, y el
  // coalesce de saveMeasure convierte el segundo en un overwrite (no un duplicado): se pierde
  // un incremento. Aquí se pina la mitad reducer de ese contrato: dos saveMeasure con el mismo
  // valor "stale" < 60 s → una sola muestra con 500 (no 1000). Buggy-pero-actual.
  it('electrolitos: dos taps con base stale quedan como UN valor (500, no 1000)', () => {
    const s = dispatch(
      mkState(),
      { t: 'saveMeasure', name: 'Sodio diario', value: 500, ts: T0 },
      { t: 'saveMeasure', name: 'Sodio diario', value: 500, ts: T0 + 2_000 }, // 2º tap, base stale
    )
    expect(s.measureValues['Sodio diario']).toBe(500)
    expect(s.history['Sodio diario']).toEqual([{ ts: T0 + 2_000, value: 500 }])
    expect(s.log[0].items).toHaveLength(1)
  })
})

describe('logSkip', () => {
  it("inserta item type 'skip' con toast; late+keepSheet marca la ocurrencia sin cerrar ni toastear", () => {
    const s1 = dispatch(mkState(), { t: 'logSkip', product: P, ts: ts(2026, 6, 9, 9, 0) })
    expect(s1.log[0].items[0]).toMatchObject({ type: 'skip', product: P })
    expect(s1.log[0].items[0].late).toBeUndefined()
    expect(s1.toast).toBe('Dosis marcada como "No hoy"')

    const s2 = dispatch(mkState(), { t: 'logSkip', product: P, ts: ts(2026, 6, 9, 9, 0), late: true, keepSheet: true })
    expect(s2.log[0].items[0].late).toBe(true)
    expect(s2.toast).toBeNull() // keepSheet: sin toast (flujo mayor)
  })
})

describe('deleteLog + undoDeleteLog — el vial se reconcilia', () => {
  it('borrar una dosis devuelve los mg al vial; deshacer los vuelve a descontar', () => {
    const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    const id = s1.log[0].items[0].id
    const s2 = reducer(s1, { t: 'deleteLog', id })
    expect(s2.log).toHaveLength(0)
    expect(s2.protocols[P].vialStock?.usedMg).toBe(0)
    const s3 = reducer(s2, { t: 'undoDeleteLog' })
    expect(s3.log[0].items[0].id).toBe(id)
    expect(s3.protocols[P].vialStock?.usedMg).toBe(0.25)
  })
})
