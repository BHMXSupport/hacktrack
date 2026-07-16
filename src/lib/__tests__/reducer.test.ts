// Golden: casos del reducer — logDose (backstops + vialStock + keepSheet), editLogTime
// (reagrupación + reubicación de history), saveMeasure (coalesce 60 s + cruce de medianoche +
// modo delta atómico), editLog (severidad de efecto adverso), buckets de nutrición por instante
// estampado, nextDose DST-seguro y loadRemoteState saneado. Timestamps fijos siempre (jun 2026).
import { describe, expect, it, vi } from 'vitest'
import { isoKey, nextDose, nextDoseAt, reducer, type AppState } from '../store'
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
    // sync Opción C (merge por registro): las muestras editadas ahora estampan `m` (mtime real de la edición)
    expect(s2.history['Peso']).toEqual([{ ts: ts(2026, 6, 3, 10, 0), value: 80, m: expect.any(Number) }])
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

describe('saveMeasure — coalesce de 60 s (incluye cruce de medianoche) + modo delta atómico', () => {
  const T0 = ts(2026, 6, 10, 10, 0, 0)

  it('< 60 s: actualiza el item existente (mismo id) y reemplaza la última muestra', () => {
    const s1 = dispatch(mkState(), { t: 'saveMeasure', name: 'Peso', value: 80, ts: T0 })
    const id = s1.log[0].items[0].id
    const s2 = reducer(s1, { t: 'saveMeasure', name: 'Peso', value: 81, ts: T0 + 30_000 })
    expect(s2.log[0].items).toHaveLength(1)
    expect(s2.log[0].items[0].id).toBe(id)
    expect(s2.log[0].items[0].ts).toBe(T0 + 30_000)
    // sync Opción C: las muestras creadas/actualizadas por el reducer estampan `m` (mtime de sync)
    expect(s2.history['Peso']).toEqual([{ ts: T0 + 30_000, value: 81, m: expect.any(Number) }])
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

  // debt-70 (RESUELTO): el coalesce ahora también encuentra el item previo en el grupo de AYER.
  // Un stepper que cruza la medianoche (23:59:30 → 00:00:10, 40 s después) actualiza el registro
  // y lo REAGRUPA al día nuevo — un solo item, una sola muestra en history.
  it('cruce de medianoche dentro de la ventana de 60 s SÍ coalesce y reagrupa al día nuevo', () => {
    const s1 = dispatch(mkState(), { t: 'saveMeasure', name: 'Peso', value: 80, ts: ts(2026, 6, 9, 23, 59, 30) })
    const id = s1.log[0].items[0].id
    const s2 = reducer(s1, { t: 'saveMeasure', name: 'Peso', value: 81, ts: ts(2026, 6, 10, 0, 0, 10) })
    expect(s2.log).toHaveLength(1) // el grupo del 09 quedó vacío y se eliminó
    expect(s2.log[0].dateKey).toBe('2026-06-10')
    expect(s2.log[0].items).toHaveLength(1)
    expect(s2.log[0].items[0].id).toBe(id) // mismo registro, movido de día
    // sync Opción C: la muestra coalescida estampa `m`
    expect(s2.history['Peso']).toEqual([{ ts: ts(2026, 6, 10, 0, 0, 10), value: 81, m: expect.any(Number) }])
    expect(s2.measureValues['Peso']).toBe(81)
  })

  // debt-90 (RESUELTO): el stepper manda SOLO el delta; la base la lee el reducer (última muestra
  // del día del ts) — dos taps antes del re-render ya no se pisan: acumulan.
  it('electrolitos: dos taps rápidos con delta ACUMULAN (200 + 200 = 400) y coalescen en un registro', () => {
    const s = dispatch(
      mkState(),
      { t: 'saveMeasure', name: 'Sodio diario', delta: 200, ts: T0 },
      { t: 'saveMeasure', name: 'Sodio diario', delta: 200, ts: T0 + 2_000 }, // 2º tap, sin re-render
    )
    expect(s.measureValues['Sodio diario']).toBe(400)
    // sync Opción C: la muestra acumulada estampa `m`
    expect(s.history['Sodio diario']).toEqual([{ ts: T0 + 2_000, value: 400, m: expect.any(Number) }])
    expect(s.log[0].items).toHaveLength(1)
  })

  it('delta negativo no baja de 0 (clamp)', () => {
    const s = dispatch(mkState(), { t: 'saveMeasure', name: 'Sodio diario', delta: -200, ts: T0 })
    expect(s.measureValues['Sodio diario']).toBe(0)
  })

  // Los acumulados diarios se reinician cada día: en modo delta NO se coalesce a través de la
  // medianoche — el total de ayer sobrevive como registro propio y el día nuevo arranca de cero.
  it('delta: el día nuevo arranca de cero y el total de ayer sobrevive (sin coalesce cruzando medianoche)', () => {
    const s = dispatch(
      mkState(),
      { t: 'saveMeasure', name: 'Sodio diario', delta: 2200, ts: ts(2026, 6, 9, 23, 59, 30) },
      { t: 'saveMeasure', name: 'Sodio diario', delta: 200, ts: ts(2026, 6, 10, 0, 0, 10) },
    )
    expect(s.log).toHaveLength(2)
    expect(s.log.map((g) => g.dateKey)).toEqual(['2026-06-10', '2026-06-09'])
    // sync Opción C: cada muestra estampa `m` (mtime de sync)
    expect(s.history['Sodio diario']).toEqual([
      { ts: ts(2026, 6, 9, 23, 59, 30), value: 2200, m: expect.any(Number) },
      { ts: ts(2026, 6, 10, 0, 0, 10), value: 200, m: expect.any(Number) },
    ])
  })

  it('acción malformada (ni value ni delta) devuelve el mismo estado', () => {
    const s1 = mkState()
    expect(reducer(s1, { t: 'saveMeasure', name: 'Peso', ts: T0 })).toBe(s1)
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

describe('editLog — parche de severidad de efecto adverso (debt-122)', () => {
  const adverseState = () =>
    dispatch(stateWithVial(), {
      t: 'logAdverseEffect', product: P, severity: 'leve', description: 'Enrojecimiento en el sitio', ts: ts(2026, 6, 10, 9, 30),
    })

  it('corrige la severidad de un efecto adverso ya registrado (y null la elimina)', () => {
    const s1 = adverseState()
    const id = s1.log[0].items[0].id
    const s2 = reducer(s1, { t: 'editLog', id, patch: { severity: 'severo' } })
    expect(findItem(s2, (it) => it.id === id).severity).toBe('severo')
    // sin acoplamiento: ni history ni protocolos cambian
    expect(s2.history).toBe(s1.history)
    expect(s2.protocols).toBe(s1.protocols)
    const s3 = reducer(s2, { t: 'editLog', id, patch: { severity: null } })
    expect(findItem(s3, (it) => it.id === id).severity).toBeUndefined()
  })

  it('la severidad NO se aplica a items que no son efecto adverso; la rama exclusiva de doseMg sigue intacta', () => {
    const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    const id = s1.log[0].items[0].id
    // parche combinado: doseMg ajusta el vial por delta (guard Lote 6), severity se ignora en 'dose'
    const s2 = reducer(s1, { t: 'editLog', id, patch: { doseMg: 0.5, severity: 'severo' } })
    const edited = findItem(s2, (it) => it.id === id)
    expect(edited.doseMg).toBe(0.5)
    expect(edited.severity).toBeUndefined()
    expect(s2.protocols[P].vialStock?.usedMg).toBe(0.5) // 0.25 + (0.5 − 0.25)
  })
})

describe('debt-clock — la clave del bucket de nutrición deriva del MISMO instante que el ts estampado', () => {
  it('addMeal con ts post-medianoche cae en el bucket del día del ts, no en el todayTs rezagado', () => {
    // todayTs sigue anclado al 10 jun (el tick aún no corre); la comida es del 11 jun 00:00:30
    const s = dispatch(mkState(), { t: 'addMeal', kcal: 300, ts: ts(2026, 6, 11, 0, 0, 30) })
    expect(s.nutrition['2026-06-11']?.meals[0]).toMatchObject({ kcal: 300, ts: ts(2026, 6, 11, 0, 0, 30) })
    expect(s.nutrition['2026-06-10']).toBeUndefined()
  })

  it('addFavMeal respeta la misma invariante (bucket = día del ts)', () => {
    const base = mkState({
      foodLibrary: [{ id: 'fav1', label: 'Avena', kcal: 200, protein: 8, carbs: 30, fat: 4, usoCount: 1, defaultMultiplier: 1, hourBucket: {} }],
    })
    const s = reducer(base, { t: 'addFavMeal', id: 'fav1', ts: ts(2026, 6, 11, 0, 0, 30) })
    expect(s.nutrition['2026-06-11']?.meals[0]).toMatchObject({ kcal: 200, favId: 'fav1' })
    expect(s.nutrition['2026-06-10']).toBeUndefined()
  })

  it("'water' usa el día del RELOJ, no todayTs (tap post-medianoche antes del tick)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(d(2026, 6, 11, 0, 0, 30))
    try {
      const s = dispatch(mkState(), { t: 'water', delta: 250 }) // todayTs rezagado en el 10 jun
      expect(s.nutrition['2026-06-11']?.water).toBe(250)
      expect(s.nutrition['2026-06-10']).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it("'copyYesterday' ancla 'hoy' y 'ayer' al reloj: copia las comidas del día local anterior", () => {
    vi.useFakeTimers()
    vi.setSystemTime(d(2026, 6, 11, 0, 0, 30))
    try {
      const base = mkState({
        nutrition: { '2026-06-10': { water: 0, meals: [{ id: 'm1', kcal: 500, ts: ts(2026, 6, 10, 14, 0), protein: null, carbs: null, fat: null, label: 'Comida', portion: 1 }] } },
      })
      const s = reducer(base, { t: 'copyYesterday' })
      const copied = s.nutrition['2026-06-11']?.meals ?? []
      expect(copied).toHaveLength(1)
      expect(copied[0].kcal).toBe(500)
      expect(isoKey(copied[0].ts)).toBe('2026-06-11') // misma franja horaria, trasladada al día del reloj
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('nextDose / nextDoseAt — caminata por día local, DST-segura (debt-69, sitios del store)', () => {
  // Cadencia cadaN=5 desde el 4 mar → toca el 9 mar; la caminata cruza el adelanto de Tijuana
  // (dom 8 mar 02:00). Antes (+86 400 000 ms fijos) la fecha derivaba a la 01:00 del 9 mar.
  const dstState = () => mkState({
    todayTs: ts(2026, 3, 7),
    protocols: { [P]: mkProtocol(P, ts(2026, 3, 4), cad({ mode: 'cadaN', n: 5 })) },
  })

  it('nextDose devuelve la medianoche EXACTA del 9 de marzo al cruzar el adelanto', () => {
    expect(nextDose(dstState())?.getTime()).toBe(ts(2026, 3, 9))
  })

  it('nextDoseAt devuelve el 9 de marzo a la hora del recordatorio (08:00) al cruzar el adelanto', () => {
    expect(nextDoseAt(dstState(), d(2026, 3, 7, 10, 0))?.getTime()).toBe(ts(2026, 3, 9, 8, 0))
  })
})

describe('loadRemoteState — mismas defensas que el import de archivo (debt-remote-nosanitize)', () => {
  it('un blob vacío NO borra el estado local (guard de respaldo hueco)', () => {
    const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    const s2 = reducer(s1, { t: 'loadRemoteState', state: {} })
    expect(s2.log).toBe(s1.log) // datos intactos
    expect(s2.protocols).toBe(s1.protocols)
    expect(s2.toast).toBe('El respaldo en la nube está vacío — no se aplicó')
  })

  it('sanea el blob remoto: descarta log items inválidos antes de hidratar y conserva todayTs local', () => {
    const s1 = mkState()
    const remote: Partial<AppState> = {
      protocols: { [P]: mkProtocol(P, ts(2026, 6, 1), cad({ mode: 'dia' })) },
      log: [{
        dateKey: '2026-06-09',
        items: [
          { id: 'ok1', t: '9:00 AM', n: 'Dosis registrada', u: `${P} · 1 mg`, cat: '#1B8A7D', ic: 'dose', type: 'dose', ts: ts(2026, 6, 9, 9, 0), product: P },
          { id: 'bad1', t: '9:05 AM', n: 'X', u: 'x', cat: '#000', ic: 'x', type: 'invalido' as never, ts: ts(2026, 6, 9, 9, 5) },
        ],
      }],
    }
    const s2 = reducer(s1, { t: 'loadRemoteState', state: remote })
    expect(s2.log).toHaveLength(1)
    expect(s2.log[0].items).toHaveLength(1) // el item con type inválido se descartó
    expect(s2.log[0].items[0].id).toBe('ok1')
    expect(s2.protocols[P]).toBeTruthy()
    expect(s2.todayTs).toBe(s1.todayTs) // 'hoy' es local, no del blob
    expect(s2.toast).toBe('Restaurado · 1 entrada(s) inválida(s) omitida(s)')
  })

  // El reducer es DUEÑO del toast de resultado: éxito limpio → confirmación (Ajustes ya no toastea).
  it('éxito limpio (sin descartes) → toast «Restaurado desde la nube»', () => {
    const remote: Partial<AppState> = {
      protocols: { [P]: mkProtocol(P, ts(2026, 6, 1), cad({ mode: 'dia' })) },
    }
    const s2 = reducer(mkState(), { t: 'loadRemoteState', state: remote })
    expect(s2.protocols[P]).toBeTruthy()
    expect(s2.toast).toBe('Restaurado desde la nube')
  })

  // Amplitud de importHasData: un respaldo SOLO de nutrición (comidas/agua, sin log ni protocolos)
  // es válido — antes el guard lo rechazaba como "vacío" y era irrestaurable para siempre.
  it('un respaldo solo-nutrición (agua + comidas, sin log/protocolos) SÍ se restaura', () => {
    const remote: Partial<AppState> = {
      nutrition: {
        '2026-06-09': {
          water: 750,
          meals: [{ id: 'm1', kcal: 480, ts: ts(2026, 6, 9, 14, 0), protein: 32, carbs: 40, fat: 18, label: 'Pollo con arroz', portion: 1 }],
        },
      },
    }
    const s2 = reducer(mkState(), { t: 'loadRemoteState', state: remote })
    expect(s2.nutrition['2026-06-09']?.water).toBe(750)
    expect(s2.nutrition['2026-06-09']?.meals).toHaveLength(1)
    expect(s2.toast).toBe('Restaurado desde la nube')
  })

  it('un respaldo solo-historial (medidas) y uno solo-biblioteca también cuentan como datos', () => {
    const sHist = reducer(mkState(), {
      t: 'loadRemoteState',
      state: { history: { Peso: [{ value: 82.5, ts: ts(2026, 6, 9, 8, 0) }] } } as Partial<AppState>,
    })
    expect(sHist.history['Peso']).toHaveLength(1)
    expect(sHist.toast).toBe('Restaurado desde la nube')
    const sLib = reducer(mkState(), {
      t: 'loadRemoteState',
      state: { foodLibrary: [{ id: 'f1', label: 'Avena', kcal: 300, protein: 10, carbs: 50, fat: 6, usoCount: 3, hourBucket: {}, defaultMultiplier: 1 }] } as Partial<AppState>,
    })
    expect(sLib.foodLibrary).toHaveLength(1)
    expect(sLib.toast).toBe('Restaurado desde la nube')
  })

  // La fila hueca sigue rechazada aunque traiga las SECCIONES presentes pero vacías.
  it('secciones presentes pero vacías ({log:[], nutrition:{}, …}) siguen contando como respaldo hueco', () => {
    const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    const s2 = reducer(s1, {
      t: 'loadRemoteState',
      state: { log: [], protocols: {}, importedProducts: [], nutrition: {}, history: {}, foodLibrary: [] } as Partial<AppState>,
    })
    expect(s2.log).toBe(s1.log)
    expect(s2.toast).toBe('El respaldo en la nube está vacío — no se aplicó')
  })
})

describe('arcoDelete — Cancelación: reset total con mensaje honesto', () => {
  it('borra estado, revoca consentimiento y fija el toast de confirmación', () => {
    const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
    const s2 = reducer(s1, { t: 'arcoDelete' })
    expect(s2.log).toHaveLength(0)
    expect(s2.protocols).toEqual({})
    expect(s2.settings.consentActive).toBe(false)
    expect(s2.screen).toBe('s-onboarding')
    expect(s2.toast).toBe('Tus datos fueron borrados.')
  })
})

// ── sync Opción C: estampado de mtimes (m) + lápidas de borrado (merge por registro) ──────────
describe('sync — estampado de m y lápidas en el reducer', () => {
  const M0 = ts(2026, 6, 10, 12, 0)

  it('logDose estampa m con el RELOJ real (no el ts backfilleado), re-estampa el protocolo (vialStock) y marca las unidades de mapa', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(d(2026, 6, 10, 12, 0))
      const s = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 8, 9, 0), 0.25, 'mg', { doseMg: 0.25, recon: { vialMg: 10, aguaMl: 2 }, site: 'abdomen-izq' }))
      const it0 = findItem(s, (x) => x.type === 'dose')
      expect(it0.ts).toBe(ts(2026, 6, 8, 9, 0)) // la hora elegida (backfill)…
      expect(it0.m).toBe(M0)                    // …pero el mtime de sync es el momento real del registro
      expect(s.protocols[P].m).toBe(M0)         // el vial cambió → el protocolo es una edición nueva
      expect(s.syncMeta?.units).toMatchObject({ productDoses: M0, productRecon: M0, lastInjectionSite: M0 })
    } finally { vi.useRealTimers() }
  })

  it('deleteLog escribe lápida; undoDeleteLog la LIMPIA y re-estampa m (revivir > lápida, aunque ya se haya sincronizado)', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(d(2026, 6, 10, 12, 0))
      const s1 = dispatch(stateWithVial(), doseAction(P, ts(2026, 6, 10, 9, 0), 0.25, 'mg', { doseMg: 0.25 }))
      const id = s1.log[0].items[0].id
      vi.setSystemTime(d(2026, 6, 10, 12, 5))
      const s2 = reducer(s1, { t: 'deleteLog', id })
      expect(s2.tombstones?.logItems[id]).toBe(ts(2026, 6, 10, 12, 5))
      vi.setSystemTime(d(2026, 6, 10, 12, 10))
      const s3 = reducer(s2, { t: 'undoDeleteLog' })
      expect(s3.tombstones?.logItems[id]).toBeUndefined()
      expect(findItem(s3, (x) => x.id === id).m).toBe(ts(2026, 6, 10, 12, 10))
    } finally { vi.useRealTimers() }
  })

  it('archivar un protocolo es EDICIÓN (m nuevo, sin lápida); deleteProduct sí deja lápida + estampa los mapas limpiados', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(d(2026, 6, 10, 12, 0))
      const s1 = reducer(stateWithVial(), { t: 'archiveProtocol', product: P })
      expect(s1.protocols[P].archived).toBe(true)
      expect(s1.protocols[P].m).toBe(M0)
      expect(s1.tombstones?.protocols[P]).toBeUndefined()
      const s2 = reducer(stateWithVial(), { t: 'deleteProduct', product: P })
      expect(s2.protocols[P]).toBeUndefined()
      expect(s2.tombstones?.protocols[P]).toBe(M0)
      expect(s2.syncMeta?.units).toMatchObject({ productDoses: M0, productRecon: M0, lastInjectionSite: M0, productAliases: M0 })
      // lápidas mapKeys de las claves por-producto limpiadas: sin ellas, el residuo resucita al fusionar
      expect(s2.tombstones?.mapKeys).toMatchObject({
        [`productDoses:${P}`]: M0, [`productRecon:${P}`]: M0, [`lastInjectionSite:${P}`]: M0, [`productAliases:${P}`]: M0,
      })
    } finally { vi.useRealTimers() }
  })

  it('addMeal/addFavMeal/editMeal/copyYesterday estampan m POR COMIDA; delMeal deja lápida de comida', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(d(2026, 6, 10, 12, 0))
      const base = mkState({
        nutrition: { '2026-06-09': { water: 0, meals: [{ id: 'm0', kcal: 400, ts: ts(2026, 6, 9, 14, 0), portion: 1, label: 'Pollo' }] } },
        foodLibrary: [{ id: 'fav1', label: 'Avena', kcal: 200, usoCount: 1, defaultMultiplier: 1, hourBucket: {} }],
      })
      const s1 = dispatch(base, { t: 'addMeal', kcal: 300, ts: ts(2026, 6, 10, 9, 0) })
      expect(s1.nutrition['2026-06-10'].meals[0].m).toBe(M0)
      const s2 = reducer(s1, { t: 'addFavMeal', id: 'fav1', ts: ts(2026, 6, 10, 10, 0) })
      expect(s2.nutrition['2026-06-10'].meals[0].m).toBe(M0)
      // copyYesterday: cada copia es comida NUEVA (id propio) con m estampado
      const s3 = reducer(s2, { t: 'copyYesterday' })
      const copied = s3.nutrition['2026-06-10'].meals[0]
      expect(copied.label).toBe('Pollo')
      expect(copied.id).not.toBe('m0')
      expect(copied.m).toBe(M0)
      // editMeal re-estampa el m de la comida editada (así la edición gana el merge por id)
      const s4 = reducer(s3, { t: 'editMeal', id: 'm0', patch: { label: 'Pollo asado' } })
      expect(s4.nutrition['2026-06-09'].meals[0]).toMatchObject({ id: 'm0', label: 'Pollo asado', m: M0 })
      // delMeal: la comida muere CON lápida (sin ella, el merge por id la resucitaría)
      const s5 = reducer(s4, { t: 'delMeal', id: 'm0' })
      expect(s5.nutrition['2026-06-09'].meals).toHaveLength(0)
      expect(s5.tombstones?.meals['m0']).toBe(M0)
    } finally { vi.useRealTimers() }
  })

  it('setMeasureGoal/setMeasureReminder/setProductAlias con null dejan lápida mapKeys; el re-set la limpia', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(d(2026, 6, 10, 12, 0))
      const s1 = dispatch(
        mkState(),
        { t: 'setMeasureGoal', name: 'Peso', value: 75 },
        { t: 'setMeasureReminder', name: 'Peso', intervalDays: 7 },
        { t: 'setProductAlias', product: P, alias: 'Ipa' },
      )
      expect(s1.tombstones?.mapKeys ?? {}).toEqual({}) // set inicial: sin lápidas
      const s2 = dispatch(
        s1,
        { t: 'setMeasureGoal', name: 'Peso', value: null },
        { t: 'setMeasureReminder', name: 'Peso', intervalDays: null },
        { t: 'setProductAlias', product: P, alias: null },
      )
      expect(s2.measureGoals['Peso']).toBeUndefined()
      expect(s2.tombstones?.mapKeys).toMatchObject({
        'measureGoals:Peso': M0, 'measureReminders:Peso': M0, [`productAliases:${P}`]: M0,
      })
      const s3 = reducer(s2, { t: 'setMeasureGoal', name: 'Peso', value: 80 })
      expect(s3.measureGoals['Peso']).toBe(80)
      expect(s3.tombstones?.mapKeys['measureGoals:Peso']).toBeUndefined() // revivida: lápida limpia
      expect(s3.tombstones?.mapKeys[`productAliases:${P}`]).toBe(M0)      // las demás siguen
    } finally { vi.useRealTimers() }
  })

  it('delFav/deleteRecon dejan lápida; setters de mapas y settings estampan su unidad', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(d(2026, 6, 10, 12, 0))
      const base = mkState({
        foodLibrary: [{ id: 'f1', label: 'Avena', kcal: 200, usoCount: 1 }],
        savedRecons: [{ id: 'r1', label: '10mg/2ml', vialMg: 10, aguaMl: 2, createdAt: ts(2026, 6, 1) }],
      })
      const s1 = dispatch(base, { t: 'delFav', id: 'f1' }, { t: 'deleteRecon', id: 'r1' })
      expect(s1.tombstones?.foodLibrary['f1']).toBe(M0)
      expect(s1.tombstones?.savedRecons['r1']).toBe(M0)
      const s2 = dispatch(
        mkState(),
        { t: 'setMeasureGoal', name: 'Peso', value: 75 },
        { t: 'setDayNote', dateKey: '2026-06-10', text: 'nota' },
        { t: 'setSetting', key: 'premium', value: true },
        { t: 'setName', name: 'Jan' },
        { t: 'setKcalGoal', value: 2200 },
      )
      expect(s2.syncMeta?.units).toMatchObject({ measureGoals: M0, dayNotes: M0, settings: M0, profile: M0, goals: M0 })
    } finally { vi.useRealTimers() }
  })

  it("tocar campos SOLO-de-dispositivo (pin/consent/cloudSync) NO vuelve 'más nueva' la unidad settings", () => {
    const s = dispatch(
      mkState(),
      { t: 'setSetting', key: 'pinEnabled', value: true },
      { t: 'setSetting', key: 'cloudSync', value: true },
      { t: 'setSetting', key: 'consentActive', value: true },
    )
    expect(s.syncMeta?.units?.['settings']).toBeUndefined()
  })

  it('los buckets de nutrición estampan m de DÍA (solo el bucket tocado) al agregar/borrar comidas y agua', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(d(2026, 6, 10, 12, 0))
      const base = mkState({
        nutrition: { '2026-06-09': { water: 500, meals: [{ id: 'm0', kcal: 400, ts: ts(2026, 6, 9, 14, 0), portion: 1 }] } },
      })
      const s1 = dispatch(base, { t: 'addMeal', kcal: 300, ts: ts(2026, 6, 10, 9, 0) }, { t: 'water', delta: 250 })
      expect(s1.nutrition['2026-06-10'].m).toBe(M0)
      expect(s1.nutrition['2026-06-09'].m).toBeUndefined() // el día de ayer no se tocó
      const s2 = reducer(s1, { t: 'delMeal', id: 'm0' })
      expect(s2.nutrition['2026-06-09'].m).toBe(M0) // ahora sí: perdió una comida
    } finally { vi.useRealTimers() }
  })
})

describe('modo solo local ↔ respaldo en la nube — excluyentes (sec-F4)', () => {
  it('activar modo solo local APAGA cloudSync (el switch no puede mentir)', () => {
    const s1 = mkState({ settings: { ...mkState().settings, cloudSync: true } })
    const s2 = reducer(s1, { t: 'setLocalOnly', value: true })
    expect(s2.localOnly).toBe(true)
    expect(s2.settings.cloudSync).toBe(false)
  })

  it('desactivar modo solo local NO re-enciende el respaldo (opt-in explícito aparte)', () => {
    const s1 = reducer(mkState({ settings: { ...mkState().settings, cloudSync: true } }), { t: 'setLocalOnly', value: true })
    const s2 = reducer(s1, { t: 'setLocalOnly', value: false })
    expect(s2.localOnly).toBe(false)
    expect(s2.settings.cloudSync).toBe(false)
  })

  it('optar por el respaldo en la nube desactiva el modo solo local (simetría)', () => {
    const s1 = mkState({ localOnly: true })
    const s2 = reducer(s1, { t: 'setSetting', key: 'cloudSync', value: true })
    expect(s2.settings.cloudSync).toBe(true)
    expect(s2.localOnly).toBe(false)
  })
})
