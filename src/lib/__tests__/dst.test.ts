// Suite DST — America/Tijuana (vitest.config.ts fija TZ; CDMX abolió el DST, Tijuana no).
// 2026: adelanto dom 8 mar 02:00 (PST−8 → PDT−7); atraso dom 1 nov 02:00 (PDT → PST).
//
// Deuda #69 (debt-69 / gap-debt-69): isoKey y tallyDoses iteran por día LOCAL y son correctos,
// pero varios consumidores caminan días con 86_400_000 ms FIJOS. Al cruzar el adelanto hacia
// atrás, medianoche−24 h cae a las 23:00 de DOS días antes → se salta un día local completo.
// Los tests marcados it.fails documentan ese bug tal cual existe hoy; la siguiente ola
// (barrido #69) los volteará a `it` cuando cambie la aritmética a días calendario locales.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pendingDoses, productStreak, protocolStreak, weekAdherencePctLast8 } from '../calendar'
import { adherence, isoKey, nextDose, tallyDoses } from '../store'
import { compositeStreak, kcalSeries } from '../nutrition'
import { cad, d, dispatch, doseAction, mkProtocol, mkState, ts } from './helpers'

const P = 'Ipamorelin'

// protocolo diario desde el 1 mar con una dosis registrada cada día [from..to] a las 09:00
const dailyMarch = (fromDay: number, toDay: number, opts: { skipDays?: number[]; startDay?: number } = {}) => {
  const start = ts(2026, 3, opts.startDay ?? fromDay)
  let s = mkState({
    todayTs: ts(2026, 3, 12),
    protocols: { [P]: mkProtocol(P, start, cad({ mode: 'dia' })) },
  })
  for (let day = fromDay; day <= toDay; day++) {
    if (opts.skipDays?.includes(day)) continue
    s = dispatch(s, doseAction(P, ts(2026, 3, day, 9, 0)))
  }
  return s
}

describe('guardia de TZ', () => {
  it('el runner corre en America/Tijuana y observa el cambio PST→PDT', () => {
    expect(new Date(2026, 2, 8, 1, 0).getTimezoneOffset()).toBe(480) // PST
    expect(new Date(2026, 2, 8, 4, 0).getTimezoneOffset()).toBe(420) // PDT
  })
})

describe('lo que YA es DST-seguro (iteración por día local)', () => {
  it('tallyDoses cruza el adelanto sin perder el 8 de marzo', () => {
    const s = dailyMarch(1, 12)
    const now = d(2026, 3, 12, 12, 0)
    expect(tallyDoses(s, ts(2026, 3, 1), ts(2026, 3, 12), now)).toEqual({ taken: 12, missed: 0, upcoming: 0 })
    expect(adherence(s, 12, now)?.pct).toBe(100)
  })

  it('kcalSeries incluye el día de la transición', () => {
    const s = mkState({
      todayTs: ts(2026, 3, 12),
      nutrition: { '2026-03-08': { water: 0, meals: [{ id: 'm1', kcal: 400, ts: ts(2026, 3, 8, 14, 0) }] } },
    })
    const serie = kcalSeries(s, 10)
    expect(serie).toHaveLength(10)
    const mar8 = serie.find((x) => isoKey(x.ts) === '2026-03-08')
    expect(mar8).toEqual({ ts: ts(2026, 3, 8), kcal: 400, has: true })
  })

  it('compositeStreak cruza el adelanto (constructor de día local)', () => {
    const nutrition: Record<string, { water: number; meals: { id: string; kcal: number; ts: number }[] }> = {}
    for (let day = 6; day <= 12; day++) {
      nutrition[`2026-03-${String(day).padStart(2, '0')}`] = { water: 2000, meals: [{ id: `m${day}`, kcal: 500, ts: ts(2026, 3, day, 14, 0) }] }
    }
    const s = mkState({ todayTs: ts(2026, 3, 12), profile: { ...mkState().profile, peso: 70 }, nutrition })
    expect(compositeStreak(s)).toBe(7)
  })

  it('atraso (1 nov): la caminata de protocolStreak NO salta días (el bug es solo del adelanto)', () => {
    const start = ts(2026, 10, 28)
    let s = mkState({
      todayTs: ts(2026, 11, 3),
      protocols: { [P]: mkProtocol(P, start, cad({ mode: 'dia' })) },
    })
    for (const [m, day] of [[10, 28], [10, 29], [10, 30], [10, 31], [11, 1], [11, 2], [11, 3]] as const) {
      s = dispatch(s, doseAction(P, ts(2026, m, day, 9, 0)))
    }
    expect(protocolStreak(s, d(2026, 11, 3), d(2026, 11, 3, 20, 0))).toBe(7)
  })
})

describe('deuda #69 — caminatas con 86_400_000 ms fijos saltan el 8 de marzo', () => {
  beforeEach(() => {
    // weekAdherencePctLast8 usa new Date() interno → reloj fijo para determinismo
    vi.useFakeTimers()
    vi.setSystemTime(d(2026, 3, 12, 12, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // 12 días tomados (1–12 mar) → la racha real es 12; la caminata (calendar.ts:133) salta el 8
  // y cuenta 11. Verificado hoy: falla con 11 !== 12.
  it.fails('protocolStreak cuenta los 12 días tomados que cruzan el adelanto', () => {
    const s = dailyMarch(1, 12)
    expect(protocolStreak(s, d(2026, 3, 12), d(2026, 3, 12, 20, 0))).toBe(12)
  })

  // Misma caminata en calendar.ts:101/107. Verificado hoy: falla con 11 !== 12.
  it.fails('productStreak cuenta los 12 días tomados que cruzan el adelanto', () => {
    const s = dailyMarch(1, 12)
    expect(productStreak(s, P, d(2026, 3, 12))).toBe(12)
  })

  // Semana pasada real = 2–8 mar (6 tomadas + el 8 perdida = 86%); la caminata (calendar.ts:170)
  // corre la ventana a 1–7 mar → reporta 100. Verificado hoy: falla con 100 !== 86.
  it.fails('weekAdherencePctLast8 evalúa la semana pasada sobre 2–8 mar (86%), no 1–7', () => {
    const s = dailyMarch(2, 12, { skipDays: [8] })
    const weeks = weekAdherencePctLast8(s, d(2026, 3, 12))
    expect(weeks[0]).toBe(100) // semana en curso (9–15): 4 de 4 vencidas
    expect(weeks[1]).toBe(86) // semana pasada: 6 de 7 (el 8 mar se perdió)
  })

  // Sin ninguna dosis registrada, 1–12 mar programados y vencidos → 12 pendientes; la caminata
  // con offsets de ms fijos (calendar.ts:231) nunca visita el 8 de marzo. Verificado hoy: falla
  // con 11 pendientes y sin '2026-03-08'.
  it.fails('pendingDoses lista las 12 tomas vencidas, incluida la del 8 de marzo', () => {
    const s = dailyMarch(1, 0) // sin dosis (rango vacío), protocolo desde el 1 mar
    const out = pendingDoses(s, d(2026, 3, 12, 12, 0))
    const keys = out.map((p) => isoKey(p.date.getTime()))
    expect(keys).toContain('2026-03-08')
    expect(out).toHaveLength(12)
  })

  // nextDose cruza el adelanto sin perder el día (la caminata hacia ADELANTE absorbe el día de
  // 23 h)… pero la fecha devuelta queda a la 01:00, no a medianoche.
  it('nextDose devuelve el DÍA correcto al cruzar el adelanto (identidad de día)', () => {
    const s = mkState({
      todayTs: ts(2026, 3, 7),
      protocols: { [P]: mkProtocol(P, ts(2026, 3, 4), cad({ mode: 'cadaN', n: 5 })) },
    })
    const next = nextDose(s) // toca el 9 mar (día 5 desde el 4 mar)
    expect(next && isoKey(next.getTime())).toBe('2026-03-09')
  })

  // La caminata hacia adelante (store.ts:1400) no salta el día pero acumula +1 h al cruzar el
  // adelanto. Verificado hoy: falla devolviendo la 01:00 (1773043200000 vs 1773039600000).
  it.fails('nextDose devuelve la medianoche exacta del 9 de marzo (hoy deriva a la 01:00)', () => {
    const s = mkState({
      todayTs: ts(2026, 3, 7),
      protocols: { [P]: mkProtocol(P, ts(2026, 3, 4), cad({ mode: 'cadaN', n: 5 })) },
    })
    expect(nextDose(s)?.getTime()).toBe(ts(2026, 3, 9))
  })
})
