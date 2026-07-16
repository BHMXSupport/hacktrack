// Golden: motor de cadencias — diaTocaCadence/diaTocaCatalog (el predicado "¿toca hoy?"),
// weekStrip y monthMatrix, con fechas de referencia fijas de 2026.
// Referencia: jun 2026 — lun 1, mar 2, mié 3 … (1 jun 2026 es lunes).
import { describe, expect, it } from 'vitest'
import { cyclePhase, diaTocaCadence, diaTocaCatalog, monthMatrix, weekStrip } from '../cadence'
import { isoKey } from '../store'
import type { PeptideEntry } from '../types'
import { LV_DAYS, TUESDAY_ONLY, cad, d } from './helpers'

const START = d(2026, 6, 1) // lunes

describe('diaTocaCadence — cadencia del usuario', () => {
  it("mode 'dia': solo los días marcados (orden WDS L Ma Mi J V S D)", () => {
    const lv = cad({ mode: 'dia', days: LV_DAYS })
    expect(diaTocaCadence(d(2026, 6, 5), lv, START)).toBe(true) // viernes
    expect(diaTocaCadence(d(2026, 6, 6), lv, START)).toBe(false) // sábado
    expect(diaTocaCadence(d(2026, 6, 8), lv, START)).toBe(true) // lunes
  })

  it('nunca marca días antes del inicio del protocolo', () => {
    const daily = cad({ mode: 'dia' })
    expect(diaTocaCadence(d(2026, 5, 31), daily, START)).toBe(false)
    expect(diaTocaCadence(d(2026, 6, 1), daily, START)).toBe(true)
  })

  it("mode 'sem' semanal-martes: solo martes, cada semana", () => {
    const semMartes = cad({ mode: 'sem', semDays: TUESDAY_ONLY })
    const start = d(2026, 6, 2) // martes
    expect(diaTocaCadence(d(2026, 6, 2), semMartes, start)).toBe(true)
    expect(diaTocaCadence(d(2026, 6, 8), semMartes, start)).toBe(false) // lunes
    expect(diaTocaCadence(d(2026, 6, 9), semMartes, start)).toBe(true) // martes siguiente
    expect(diaTocaCadence(d(2026, 6, 16), semMartes, start)).toBe(true)
  })

  it("mode 'sem' every=2: martes sí, pero solo en semanas pares desde el inicio", () => {
    const quincenal = cad({ mode: 'sem', every: 2, semDays: TUESDAY_ONLY })
    const start = d(2026, 6, 2)
    expect(diaTocaCadence(d(2026, 6, 2), quincenal, start)).toBe(true) // semana 0
    expect(diaTocaCadence(d(2026, 6, 9), quincenal, start)).toBe(false) // semana 1
    expect(diaTocaCadence(d(2026, 6, 16), quincenal, start)).toBe(true) // semana 2
  })

  it("mode 'mes': mismo día del mes; mes corto cae al último día", () => {
    const mensual = cad({ mode: 'mes' })
    const start = d(2026, 1, 31)
    expect(diaTocaCadence(d(2026, 2, 28), mensual, start)).toBe(true) // feb: 31 → 28
    expect(diaTocaCadence(d(2026, 2, 27), mensual, start)).toBe(false)
    expect(diaTocaCadence(d(2026, 3, 31), mensual, start)).toBe(true)
    expect(diaTocaCadence(d(2026, 3, 30), mensual, start)).toBe(false)
  })

  it("mode 'cadaN' n=3: día 0, 3, 6… desde el inicio", () => {
    const cada3 = cad({ mode: 'cadaN', n: 3 })
    expect(diaTocaCadence(d(2026, 6, 1), cada3, START)).toBe(true)
    expect(diaTocaCadence(d(2026, 6, 2), cada3, START)).toBe(false)
    expect(diaTocaCadence(d(2026, 6, 4), cada3, START)).toBe(true)
    expect(diaTocaCadence(d(2026, 6, 7), cada3, START)).toBe(true)
  })

  it("mode 'ciclo' 5 on / 2 off", () => {
    const ciclo = cad({ mode: 'ciclo', on: 5, off: 2 })
    expect(diaTocaCadence(d(2026, 6, 1), ciclo, START)).toBe(true) // día 0 (on)
    expect(diaTocaCadence(d(2026, 6, 5), ciclo, START)).toBe(true) // día 4 (on)
    expect(diaTocaCadence(d(2026, 6, 6), ciclo, START)).toBe(false) // día 5 (off)
    expect(diaTocaCadence(d(2026, 6, 7), ciclo, START)).toBe(false) // día 6 (off)
    expect(diaTocaCadence(d(2026, 6, 8), ciclo, START)).toBe(true) // día 7 (reinicia on)
  })

  it("mode 'uso': nunca programa", () => {
    expect(diaTocaCadence(d(2026, 6, 1), cad({ mode: 'uso' }), START)).toBe(false)
  })
})

describe('diaTocaCatalog — los 6 tipos del catálogo', () => {
  const entry = (p: Partial<PeptideEntry> & { type: PeptideEntry['type'] }): PeptideEntry =>
    ({ cat: 'Explorar', ...p })

  it('diaria / lv / semanal (weekday 2 = martes)', () => {
    expect(diaTocaCatalog(d(2026, 6, 3), entry({ type: 'diaria' }), START)).toBe(true)
    expect(diaTocaCatalog(d(2026, 6, 6), entry({ type: 'lv' }), START)).toBe(false) // sábado
    expect(diaTocaCatalog(d(2026, 6, 4), entry({ type: 'lv' }), START)).toBe(true) // jueves
    expect(diaTocaCatalog(d(2026, 6, 9), entry({ type: 'semanal', weekday: 2 }), START)).toBe(true) // martes
    expect(diaTocaCatalog(d(2026, 6, 10), entry({ type: 'semanal', weekday: 2 }), START)).toBe(false)
  })

  it('cadaN / ciclo / por-demanda', () => {
    expect(diaTocaCatalog(d(2026, 6, 5), entry({ type: 'cadaN', n: 2 }), START)).toBe(true) // día 4
    expect(diaTocaCatalog(d(2026, 6, 4), entry({ type: 'cadaN', n: 2 }), START)).toBe(false)
    expect(diaTocaCatalog(d(2026, 5, 30), entry({ type: 'cadaN', n: 2 }), START)).toBe(false) // antes del inicio
    expect(diaTocaCatalog(d(2026, 6, 3), entry({ type: 'ciclo', on: 3, off: 4 }), START)).toBe(true) // día 2
    expect(diaTocaCatalog(d(2026, 6, 4), entry({ type: 'ciclo', on: 3, off: 4 }), START)).toBe(false) // día 3
    expect(diaTocaCatalog(d(2026, 6, 1), entry({ type: 'por-demanda' }), START)).toBe(false)
  })
})

describe('weekStrip — tira lunes→domingo', () => {
  it('semana ISO de un miércoles: lunes 8 → domingo 14', () => {
    const strip = weekStrip(d(2026, 6, 10))
    expect(strip).toHaveLength(7)
    expect(strip.map((x) => isoKey(x.getTime()))).toEqual([
      '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14',
    ])
  })

  it('la semana que contiene el salto DST no pierde el domingo', () => {
    // Semana 2–8 mar 2026: el salto es el domingo 8 a las 02:00. Las celdas se generan con
    // addDays (constructor de día local), así que la caminata es DST-segura por diseño — ya no
    // por la coincidencia de que la transición de EUA/Tijuana caiga en domingo (última celda),
    // como cuando se sumaban +i·86 400 000 ms fijos. (Barrido #69; ver dst.test.ts.)
    const strip = weekStrip(d(2026, 3, 7)) // sábado
    expect(strip.map((x) => isoKey(x.getTime()))).toEqual([
      '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08',
    ])
  })

  it('transición A MEDIANOCHE (America/Santiago): la celda del domingo no cae en sábado', () => {
    // En Tijuana la transición es a las 02:00 del domingo (última celda) y los ms fijos nunca
    // fallaban en weekStrip; el caso que SÍ rompía es una transición a medianoche exacta.
    // Chile atrasa el reloj a las 00:00: el dom 5 abr 2026, las 00:00 −03 vuelven a las 23:00
    // del sáb 4 −04. Con ms fijos, lun 30 mar + 6·86 400 000 ms caía en sáb 4 abr 23:00
    // (sábado duplicado, domingo perdido); addDays da la medianoche real del domingo.
    // Node ≥13 relee process.env.TZ en tiempo de ejecución (misma premisa que vitest.config.ts).
    const prevTZ = process.env.TZ
    try {
      process.env.TZ = 'America/Santiago'
      // guardia: el offset realmente cambia −03 → −04 (si no, el entorno no honra el cambio de TZ)
      expect(new Date(2026, 3, 4, 12, 0).getTimezoneOffset()).toBe(180)
      expect(new Date(2026, 3, 5, 12, 0).getTimezoneOffset()).toBe(240)
      const strip = weekStrip(new Date(2026, 2, 30)) // lunes 30 mar
      expect(strip.map((x) => isoKey(x.getTime()))).toEqual([
        '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05',
      ])
      expect(strip[6].getHours()).toBe(0) // medianoche local real del domingo
    } finally {
      process.env.TZ = prevTZ
    }
  })
})

describe('monthMatrix — matriz mensual L→D', () => {
  it('marzo 2026: 1º es domingo → 6 celdas de relleno y 6 semanas', () => {
    const m = monthMatrix(2026, 2)
    expect(m).toHaveLength(6)
    expect(m.every((w) => w.length === 7)).toBe(true)
    expect(m[0].slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(m[0][6]?.getDate()).toBe(1)
    const days = m.flat().filter((c): c is Date => c != null)
    expect(days).toHaveLength(31)
    // cada día exactamente una vez, incluido el 8 (día de DST): el constructor local es seguro
    expect(new Set(days.map((c) => c.getDate())).size).toBe(31)
  })

  it('junio 2026: 1º es lunes → sin relleno inicial, 5 semanas', () => {
    const m = monthMatrix(2026, 5)
    expect(m).toHaveLength(5)
    expect(m[0][0]?.getDate()).toBe(1)
    expect(m[4][1]?.getDate()).toBe(30) // martes 30 = última celda con fecha
  })
})

describe('cyclePhase — fase actual de un ciclo on/off', () => {
  const ciclo = cad({ mode: 'ciclo', on: 5, off: 2 })

  it('día 3 de la fase on', () => {
    expect(cyclePhase(ciclo, d(2026, 6, 3), START)).toEqual({ phase: 'on', dayInPhase: 3, daysLeft: 3 })
  })

  it('día 1 de la fase off', () => {
    expect(cyclePhase(ciclo, d(2026, 6, 6), START)).toEqual({ phase: 'off', dayInPhase: 1, daysLeft: 2 })
  })

  it('null si la cadencia no es de ciclo', () => {
    expect(cyclePhase(cad({ mode: 'dia' }), d(2026, 6, 3), START)).toBeNull()
  })
})
