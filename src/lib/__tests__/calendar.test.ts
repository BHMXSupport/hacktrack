// Golden: dayStatusEx, rachas (protocolStreak/productStreak/protocolStreakStart) y adherencia
// (tallyDoses/adherence/weekAdherencePct/dayAdherencePct/pendingDoses) sobre fechas fijas.
// Referencia: jun 2026 (lun 1, mar 2 …). Protocolo semanal-martes salvo indicación.
import { describe, expect, it } from 'vitest'
import {
  dayAdherencePct,
  dayStatusEx,
  pendingDoses,
  productStreak,
  protocolStreak,
  protocolStreakStart,
  weekAdherencePct,
} from '../calendar'
import { adherence, isoKey, tallyDoses } from '../store'
import { TUESDAY_ONLY, cad, d, dispatch, doseAction, mkProtocol, mkState, ts } from './helpers'

const P = 'Ipamorelin'
// protocolo semanal-martes: inicia el martes 2 jun 2026
const semState = () =>
  mkState({
    todayTs: ts(2026, 6, 10),
    protocols: { [P]: mkProtocol(P, ts(2026, 6, 2), cad({ mode: 'sem', semDays: TUESDAY_ONLY })) },
  })
// dosis tomadas los dos primeros martes
const semTaken = () =>
  dispatch(semState(), doseAction(P, ts(2026, 6, 2, 9, 0)), doseAction(P, ts(2026, 6, 9, 9, 0)))

describe('dayStatusEx — estado del día (solo cadencia)', () => {
  const now = d(2026, 6, 10, 12, 0)

  it("día sin toma programada = 'rest' (no 'none') cuando hay protocolo", () => {
    expect(dayStatusEx(semTaken(), d(2026, 6, 8), now)).toBe('rest')
  })

  it("'none' solo sin ningún protocolo", () => {
    expect(dayStatusEx(mkState(), d(2026, 6, 8), now)).toBe('none')
  })

  it("martes con dosis registrada = 'taken'", () => {
    expect(dayStatusEx(semTaken(), d(2026, 6, 9), now)).toBe('taken')
  })

  it("martes vencido sin dosis = 'missed'; aún no vencido = 'scheduled'", () => {
    const s = semState()
    expect(dayStatusEx(s, d(2026, 6, 9), now)).toBe('missed')
    // el martes 9 a las 07:00 (antes del due 08:00) aún no vence
    expect(dayStatusEx(s, d(2026, 6, 9), d(2026, 6, 9, 7, 0))).toBe('scheduled')
  })

  it("skip intencional = 'skipped' (ni tomado ni perdido)", () => {
    const s = dispatch(semState(), { t: 'logSkip', product: P, ts: ts(2026, 6, 9, 9, 0) })
    expect(dayStatusEx(s, d(2026, 6, 9), now)).toBe('skipped')
  })

  // INVARIANTE (Codex Lote 13 / dayModel.ts): una dosis off-cadencia es un EVENTO visible,
  // jamás cambia el estado programado del día → no infla racha ni adherencia.
  it("dosis off-cadencia NO cambia el estado del día: sigue 'rest'", () => {
    const s = dispatch(semTaken(), doseAction(P, ts(2026, 6, 4, 10, 0))) // jueves, no programado
    expect(dayStatusEx(s, d(2026, 6, 4), now)).toBe('rest')
  })
})

describe('protocolStreak — racha global honesta con días de descanso', () => {
  const today = d(2026, 6, 10)
  const now = d(2026, 6, 10, 12, 0)

  it('2 martes cumplidos = racha 2 (los descansos no rompen ni suman)', () => {
    expect(protocolStreak(semTaken(), today, now)).toBe(2)
  })

  // INVARIANTE (Codex Lote 13): dosis off-cadencia no infla la racha
  it('una dosis off-cadencia (jueves) NO infla la racha', () => {
    const s = dispatch(semTaken(), doseAction(P, ts(2026, 6, 4, 10, 0)))
    expect(protocolStreak(s, today, now)).toBe(2)
  })

  it('un martes perdido (ya vencido) rompe la racha', () => {
    const s = dispatch(semState(), doseAction(P, ts(2026, 6, 2, 9, 0))) // solo el 1er martes
    expect(protocolStreak(s, today, now)).toBe(0)
  })

  it('gracia al día en curso: hoy martes sin dosis aún no rompe', () => {
    const s = dispatch(semState(), doseAction(P, ts(2026, 6, 2, 9, 0)))
    const hoyMartes = d(2026, 6, 9)
    expect(protocolStreak(s, hoyMartes, d(2026, 6, 9, 7, 0))).toBe(1) // antes del due
    expect(protocolStreak(s, hoyMartes, d(2026, 6, 9, 9, 0))).toBe(1) // vencido, pero es HOY
  })

  it('protocolStreakStart devuelve el primer día del tramo (martes 2)', () => {
    expect(protocolStreakStart(semTaken(), today, now)?.getTime()).toBe(ts(2026, 6, 2))
  })

  it('protocolStreakStart es null sin racha', () => {
    expect(protocolStreakStart(semState(), today, now)).toBeNull()
  })
})

describe('productStreak — racha por producto', () => {
  it('ignora descansos por cadencia y da gracia a hoy', () => {
    const s = semTaken()
    expect(productStreak(s, P, d(2026, 6, 10))).toBe(2) // hoy miércoles (descanso) no rompe
    expect(productStreak(s, P, d(2026, 6, 16))).toBe(2) // hoy martes sin dosis aún: gracia
  })

  it('producto sin protocolo = 0', () => {
    expect(productStreak(semTaken(), 'BPC-157', d(2026, 6, 10))).toBe(0)
  })
})

describe('tallyDoses / adherence — denominador SOLO de dosis programadas', () => {
  // cadaN n=2 desde el lunes 8: tocan 8, 10, 12 jun
  const P2 = 'BPC-157'
  const cadaDos = () =>
    mkState({
      todayTs: ts(2026, 6, 12),
      protocols: { [P2]: mkProtocol(P2, ts(2026, 6, 8), cad({ mode: 'cadaN', n: 2 })) },
    })

  it('cuenta taken/missed/upcoming sobre lo programado', () => {
    const s = dispatch(cadaDos(), doseAction(P2, ts(2026, 6, 8, 9, 0)), doseAction(P2, ts(2026, 6, 10, 9, 0)))
    const now = d(2026, 6, 12, 12, 0) // hoy 12: due 08:00 ya venció, sin dosis
    expect(tallyDoses(s, ts(2026, 6, 8), ts(2026, 6, 12), now)).toEqual({ taken: 2, missed: 1, upcoming: 0 })
    expect(adherence(s, 5, now)?.pct).toBe(67) // 2 de 3 vencidas
  })

  // INVARIANTE (Codex Lote 13): la dosis off-cadencia del día 9 no entra ni al numerador ni al denominador
  it('una dosis off-cadencia (martes 9) es invisible para la adherencia', () => {
    const s = dispatch(
      cadaDos(),
      doseAction(P2, ts(2026, 6, 8, 9, 0)),
      doseAction(P2, ts(2026, 6, 9, 9, 0)), // off-cadencia
      doseAction(P2, ts(2026, 6, 10, 9, 0)),
    )
    const now = d(2026, 6, 12, 12, 0)
    expect(tallyDoses(s, ts(2026, 6, 8), ts(2026, 6, 12), now)).toEqual({ taken: 2, missed: 1, upcoming: 0 })
  })

  it('la toma de HOY aún no vencida cuenta como upcoming (no penaliza)', () => {
    const s = dispatch(cadaDos(), doseAction(P2, ts(2026, 6, 8, 9, 0)), doseAction(P2, ts(2026, 6, 10, 9, 0)))
    const now = d(2026, 6, 12, 7, 0) // antes del due de hoy
    expect(tallyDoses(s, ts(2026, 6, 8), ts(2026, 6, 12), now)).toEqual({ taken: 2, missed: 0, upcoming: 1 })
    expect(adherence(s, 5, now)?.pct).toBe(100)
  })

  it('skip intencional sin toma queda excluido de due/missed', () => {
    const s = dispatch(
      cadaDos(),
      doseAction(P2, ts(2026, 6, 8, 9, 0)),
      { t: 'logSkip', product: P2, ts: ts(2026, 6, 10, 9, 0) },
    )
    const now = d(2026, 6, 12, 12, 0)
    expect(tallyDoses(s, ts(2026, 6, 8), ts(2026, 6, 12), now)).toEqual({ taken: 1, missed: 1, upcoming: 0 })
  })

  it('adherence devuelve null sin protocolo', () => {
    expect(adherence(mkState(), 7, d(2026, 6, 10, 12, 0))).toBeNull()
  })
})

describe('weekAdherencePct / dayAdherencePct', () => {
  it('semana con 1 martes tomado = 100; semana sin programación = null', () => {
    const s = semTaken()
    const now = d(2026, 6, 10, 12, 0)
    const week = (from: number) => Array.from({ length: 7 }, (_, i) => d(2026, 6, from + i))
    expect(weekAdherencePct(s, week(8), now)).toBe(100) // martes 9 tomado
    // semana previa al inicio del protocolo (25–31 may): nada programado
    const mayWeek = Array.from({ length: 7 }, (_, i) => d(2026, 5, 25 + i))
    expect(weekAdherencePct(s, mayWeek, now)).toBeNull()
  })

  it('dayAdherencePct: 100 el martes tomado, null en descanso, 0 el martes perdido', () => {
    // todayTs = 17 jun: tallyDoses clasifica "vencida" contra s.todayTs, no solo contra `now`
    const s = { ...semTaken(), todayTs: ts(2026, 6, 17) }
    const now = d(2026, 6, 17, 12, 0)
    expect(dayAdherencePct(s, d(2026, 6, 9), now)).toBe(100)
    expect(dayAdherencePct(s, d(2026, 6, 10), now)).toBeNull()
    expect(dayAdherencePct(s, d(2026, 6, 16), now)).toBe(0) // martes 16 sin dosis, vencido
  })
})

describe('pendingDoses — atrasadas y de hoy ya vencidas', () => {
  it('lista cada día programado sin dosis con su dueTime exacta', () => {
    const P2 = 'BPC-157'
    const s = dispatch(
      mkState({
        todayTs: ts(2026, 6, 10),
        protocols: { [P2]: mkProtocol(P2, ts(2026, 6, 8), cad({ mode: 'dia' })) },
      }),
      doseAction(P2, ts(2026, 6, 8, 9, 0)),
    )
    const out = pendingDoses(s, d(2026, 6, 10, 12, 0))
    expect(out.map((p) => isoKey(p.date.getTime()))).toEqual(['2026-06-09', '2026-06-10'])
    expect(out[0].date.getTime()).toBe(ts(2026, 6, 9, 8, 0)) // dueTime = reminderTime 08:00
  })

  it('no lista tomas de hoy que aún no vencen ni días con skip', () => {
    const P2 = 'BPC-157'
    const s = dispatch(
      mkState({
        todayTs: ts(2026, 6, 10),
        protocols: { [P2]: mkProtocol(P2, ts(2026, 6, 8), cad({ mode: 'dia' })) },
      }),
      doseAction(P2, ts(2026, 6, 8, 9, 0)),
      { t: 'logSkip', product: P2, ts: ts(2026, 6, 9, 9, 0) },
    )
    expect(pendingDoses(s, d(2026, 6, 10, 7, 0))).toEqual([]) // hoy no vence hasta las 08:00
  })
})
