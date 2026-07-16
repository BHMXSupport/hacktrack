// Golden: compositeStreak (racha integral dosis+comida+agua) y kcalSeries — semántica actual.
// El agua vive en MILILITROS; meta = waterGoalLiters(peso)·1000 (peso 70 kg → 2000 ml).
import { describe, expect, it } from 'vitest'
import { compositeStreak, kcalSeries, streakDetail, waterGoalLiters } from '../nutrition'
import type { AppState } from '../store'
import { cad, d, dispatch, doseAction, mkProtocol, mkState, ts } from './helpers'

const meal = (when: number, kcal: number) => ({ id: `m${when}`, kcal, ts: when })
const fullDay = (y: number, m: number, day: number, water = 2000): AppState['nutrition'][string] => ({
  water,
  meals: [meal(ts(y, m, day, 14, 0), 600)],
})

describe('waterGoalLiters', () => {
  it('70 kg → 2 L; sin peso → 2 L (8 vasos de 250 ml)', () => {
    expect(waterGoalLiters(70)).toBe(2)
    expect(waterGoalLiters(null)).toBe(2)
  })
})

describe('compositeStreak — dosis + comida + agua≥meta', () => {
  it('3 días completos sin protocolo (la condición de dosis es trivial) = 3', () => {
    const s = mkState({
      todayTs: ts(2026, 6, 10),
      profile: { ...mkState().profile, peso: 70 },
      nutrition: {
        '2026-06-08': fullDay(2026, 6, 8),
        '2026-06-09': fullDay(2026, 6, 9),
        '2026-06-10': fullDay(2026, 6, 10),
      },
    })
    expect(compositeStreak(s)).toBe(3)
  })

  it('hoy incompleto no rompe: cuenta desde ayer', () => {
    const s = mkState({
      todayTs: ts(2026, 6, 10),
      profile: { ...mkState().profile, peso: 70 },
      nutrition: {
        '2026-06-08': fullDay(2026, 6, 8),
        '2026-06-09': fullDay(2026, 6, 9),
        '2026-06-10': fullDay(2026, 6, 10, 500), // agua bajo meta HOY
      },
    })
    expect(compositeStreak(s)).toBe(2)
  })

  it('un día pasado incompleto SÍ rompe', () => {
    const s = mkState({
      todayTs: ts(2026, 6, 10),
      profile: { ...mkState().profile, peso: 70 },
      nutrition: {
        '2026-06-07': fullDay(2026, 6, 7),
        // 8 jun sin registro
        '2026-06-09': fullDay(2026, 6, 9),
        '2026-06-10': fullDay(2026, 6, 10),
      },
    })
    expect(compositeStreak(s)).toBe(2)
  })

  it('con protocolo cadaN, el día de descanso sin dosis no rompe (dosis solo si tocaba)', () => {
    const base = mkState({
      todayTs: ts(2026, 6, 10),
      profile: { ...mkState().profile, peso: 70 },
      protocols: { 'Ipamorelin': mkProtocol('Ipamorelin', ts(2026, 6, 8), cad({ mode: 'cadaN', n: 2 })) },
      nutrition: {
        '2026-06-08': fullDay(2026, 6, 8),
        '2026-06-09': fullDay(2026, 6, 9), // descanso: sin dosis
        '2026-06-10': fullDay(2026, 6, 10),
      },
    })
    const s = dispatch(base, doseAction('Ipamorelin', ts(2026, 6, 8, 9, 0)), doseAction('Ipamorelin', ts(2026, 6, 10, 9, 0)))
    expect(compositeStreak(s)).toBe(3)
  })

  it('streakDetail expone el checklist de hoy y el siguiente hito', () => {
    const s = mkState({
      todayTs: ts(2026, 6, 10),
      profile: { ...mkState().profile, peso: 70 },
      nutrition: { '2026-06-10': fullDay(2026, 6, 10, 500) },
    })
    const det = streakDetail(s)
    expect(det.today).toEqual({ dose: true, water: false, meal: true }) // sin protocolo → dose true
    expect(det.streak).toBe(0)
    expect(det.nextMilestone).toBe(7)
    expect(det.prevMilestone).toBe(0)
  })
})

describe('kcalSeries — kcal por día calendario local', () => {
  it('devuelve `days` entradas (viejo→nuevo) con ts a medianoche local y flag has', () => {
    const s = mkState({
      todayTs: ts(2026, 6, 10),
      nutrition: {
        '2026-06-08': { water: 0, meals: [meal(ts(2026, 6, 8, 9, 0), 500), meal(ts(2026, 6, 8, 14, 0), 300)] },
        '2026-06-10': { water: 0, meals: [meal(ts(2026, 6, 10, 14, 0), 700)] },
      },
    })
    expect(kcalSeries(s, 3)).toEqual([
      { ts: ts(2026, 6, 8), kcal: 800, has: true },
      { ts: ts(2026, 6, 9), kcal: 0, has: false },
      { ts: ts(2026, 6, 10), kcal: 700, has: true },
    ])
  })

  it('un día con entrada pero sin comidas cuenta has=false', () => {
    const s = mkState({
      todayTs: ts(2026, 6, 10),
      nutrition: { '2026-06-10': { water: 1000, meals: [] } },
    })
    expect(kcalSeries(s, 1)).toEqual([{ ts: ts(2026, 6, 10), kcal: 0, has: false }])
  })
})
