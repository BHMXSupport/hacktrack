// Golden: dayModel — la fuente única del estado del día. Pin del INVARIANTE CRÍTICO
// (torneo + Codex Lote 13): los ejes van SEPARADOS — scheduleStatus/adherencia dependen SOLO
// de la cadencia; events/hasVisibleEvent son la señal de "hubo un evento real" para la UI.
import { describe, expect, it } from 'vitest'
import { dayStatusEx } from '../calendar'
import { dayModel } from '../dayModel'
import { adherence } from '../store'
import { TUESDAY_ONLY, cad, d, dispatch, doseAction, mkProtocol, mkState, ts } from './helpers'

const P = 'Ipamorelin'
const base = () =>
  mkState({
    todayTs: ts(2026, 6, 10),
    protocols: { [P]: mkProtocol(P, ts(2026, 6, 2), cad({ mode: 'sem', semDays: TUESDAY_ONLY })) },
  })
const withDoses = () => dispatch(base(), doseAction(P, ts(2026, 6, 2, 9, 0)), doseAction(P, ts(2026, 6, 9, 9, 0)))

describe('dayModel — scheduleStatus idéntico a dayStatusEx', () => {
  it('coincide con dayStatusEx en un barrido de 16 días (incl. off-cadencia y skip)', () => {
    const s = dispatch(
      withDoses(),
      doseAction(P, ts(2026, 6, 4, 10, 0)), // jueves off-cadencia
      { t: 'logSkip', product: P, ts: ts(2026, 6, 16, 9, 0) }, // martes 16 saltado
    )
    const now = d(2026, 6, 17, 12, 0)
    for (let day = 1; day <= 16; day++) {
      const date = d(2026, 6, day)
      expect(dayModel(s, date, now).scheduleStatus).toBe(dayStatusEx(s, date, now))
    }
  })
})

describe('dayModel — evento visible separado de la métrica', () => {
  const now = d(2026, 6, 10, 12, 0)

  it('dosis off-cadencia: scheduleStatus rest + hasVisibleEvent true + flags del evento', () => {
    const s = dispatch(withDoses(), doseAction(P, ts(2026, 6, 4, 10, 0)))
    const m = dayModel(s, d(2026, 6, 4), now)
    expect(m.scheduleStatus).toBe('rest') // la métrica NO ve la dosis
    expect(m.hasVisibleEvent).toBe(true) // la UI SÍ la ve
    expect(m.scheduledProducts).toEqual([])
    expect(m.offCadenceProducts).toEqual([P])
    expect(m.visibleProducts).toEqual([P])
    expect(m.events).toHaveLength(1)
    expect(m.events[0]).toMatchObject({ product: P, scheduled: false, taken: true, offCadence: true, takenTs: ts(2026, 6, 4, 10, 0) })
  })

  it('martes tomado: takenTs = ts REAL del log y due = reminderTime del protocolo', () => {
    const m = dayModel(withDoses(), d(2026, 6, 9), now)
    expect(m.scheduleStatus).toBe('taken')
    expect(m.events[0].takenTs).toBe(ts(2026, 6, 9, 9, 0))
    expect(m.events[0].due.getTime()).toBe(ts(2026, 6, 9, 8, 0))
    expect(m.dateKey).toBe('2026-06-09')
  })

  it('día de descanso sin eventos: hasVisibleEvent false', () => {
    const m = dayModel(withDoses(), d(2026, 6, 5), now)
    expect(m.scheduleStatus).toBe('rest')
    expect(m.hasVisibleEvent).toBe(false)
    expect(m.events).toEqual([])
  })
})

describe("dayModel — 'Tomada tarde' (skip late) neutral para la adherencia", () => {
  it('marca hasLateResolved/lateResolved y excluye el día del denominador', () => {
    const s = dispatch(
      { ...withDoses(), todayTs: ts(2026, 6, 17) },
      { t: 'logSkip', product: P, ts: ts(2026, 6, 16, 9, 0), late: true, keepSheet: true },
    )
    const now = d(2026, 6, 17, 12, 0)
    const m = dayModel(s, d(2026, 6, 16), now)
    expect(m.scheduleStatus).toBe('skipped')
    expect(m.hasLateResolved).toBe(true)
    expect(m.events[0].lateResolved).toBe(true)
    expect(m.events[0].skipped).toBe(true)
    // adherencia de 14 días (4–17 jun): martes 9 tomado, martes 16 excluido por el late-skip
    const a = adherence(s, 14, now)
    expect(a?.due).toBe(1)
    expect(a?.pct).toBe(100)
  })
})
