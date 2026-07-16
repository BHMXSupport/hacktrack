// Golden: motor de merge por registro (sync Opción C) — mergeStates (leyes: idempotencia,
// conmutatividad, no-resurrección, no-pérdida), cada unidad de merge, payloads legados sin
// m/syncMeta/tombstones, GC de lápidas, prepareSyncPayload (exclusión ENUMERADA de todo lo
// nunca-sincronizado) y applyMerged (preserva lo device-local, recomputa cachés).
// Timestamps fijos siempre (jun 2026); mergeStates es puro (sin reloj) → no hace falta fake timers,
// salvo en el pipeline integrado (los reducers estampan con Date.now() y el orden debe ser determinista).
import { describe, expect, it, vi } from 'vitest'
import { mergeStates, TOMBSTONE_TTL_MS } from '../merge'
import {
  applyMerged, emptyTombstones, initialState, isoKey, prepareSyncPayload, reducer, syncActive,
  CACHE_KEYS, DEVICE_SETTINGS_KEYS, NEVER_SYNCED_KEYS,
  type AppState, type SyncPayload,
} from '../store'
import type { LogGroup, LogItem, Tombstones } from '../types'
import { cad, mkDoseItem, mkProtocol, mkState, ts } from './helpers'

const P = 'Ipamorelin'
const Q = 'BPC 157'

// ── constructores de payloads golden ──────────────────────────────────────────

// agrupa items en LogGroup[] con la MISMA convención de orden que regroupLog/prependToLog
// (grupos desc por dateKey, items desc por ts con desempate por id desc) → idempotencia comparable
function logOf(...items: LogItem[]): LogGroup[] {
  const map = new Map<string, LogItem[]>()
  for (const it of items) map.set(isoKey(it.ts), [...(map.get(isoKey(it.ts)) ?? []), it])
  return [...map.entries()]
    .map(([dateKey, its]) => ({ dateKey, items: its.sort((a, b) => b.ts - a.ts || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)) }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
}

const dose = (id: string, when: number, m?: number, extra: Partial<LogItem> = {}): LogItem =>
  mkDoseItem(P, `${P} · 1 mg`, when, { id, ...(m != null ? { m } : {}), ...extra })

// payload canónico a partir de un estado (misma ruta que usará el push real)
const pay = (overrides: Partial<AppState> = {}): SyncPayload => prepareSyncPayload(mkState(overrides))

// payload con mtimes de unidad y lápidas explícitos
function withMeta(p: SyncPayload, units: Record<string, number> = {}, tomb: Partial<Tombstones> = {}): SyncPayload {
  return {
    ...p,
    syncMeta: { units: { ...(p.syncMeta?.units ?? {}), ...units } },
    tombstones: { ...emptyTombstones(), ...(p.tombstones ?? {}), ...tomb },
  }
}

// ── leyes del merge (sobre un par de estados ricos que ejercitan todas las unidades) ──────────

function richPair(): { a: SyncPayload; b: SyncPayload } {
  const T = (d: number, h = 9) => ts(2026, 6, d, h)
  const a = withMeta(pay({
    protocols: {
      [P]: mkProtocol(P, T(1), cad({ mode: 'dia' }), { m: T(5) }),
      [Q]: mkProtocol(Q, T(2), cad({ mode: 'sem' }), { m: T(3) }),
    },
    activeProduct: P,
    log: logOf(
      dose('common', T(3), T(3)),
      dose('conflictA', T(4, 10), T(6), { u: `${P} · 2 mg`, value: 2 }), // editado en A (m más nuevo)
      dose('soloA', T(5)),
    ),
    profile: { name: 'Jan', peso: 82, est: 180, grasa: null, musculo: null, bmi: 25.3 },
    history: {
      Peso: [
        { ts: T(2), value: 83 },
        { ts: T(4), value: 82.5, m: T(6) }, // valor corregido en A
      ],
    },
    nutrition: {
      '2026-06-09': { water: 500, meals: [{ id: 'mA', kcal: 400, ts: T(9, 14), portion: 1, label: 'Pollo' }], m: T(9, 20) },
      '2026-06-08': { water: 250, meals: [], m: T(8, 20) },
    },
    foodLibrary: [{ id: 'favA', label: 'Avena', kcal: 200, usoCount: 3, m: T(5) }],
    savedRecons: [{ id: 'rA', label: '10/2', vialMg: 10, aguaMl: 2, createdAt: T(1), m: T(1) }],
    measureGoals: { Peso: 75 },
    dayNotes: { '2026-06-09': 'buena semana' },
    achievements: ['primera-dosis', 'racha-7'],
    fastStartTs: null,
    lastMealTs: T(9, 14),
    curGoal: 'Metabolismo',
    kcalGoal: 2200,
  }), {
    profile: T(6), goals: T(6), settings: T(2), activeProduct: T(1),
    measureGoals: T(5), dayNotes: T(9), fastStartTs: T(7), productDoses: T(4),
  })

  const b = withMeta(pay({
    protocols: {
      [P]: mkProtocol(P, T(1), cad({ mode: 'dia' }), { m: T(4), archived: true, archivedAt: T(4) }), // archivado en B, pero A lo editó DESPUÉS
      [Q]: mkProtocol(Q, T(2), cad({ mode: 'sem' }), { m: T(7), reminderTime: '21:00' }),            // B editó Q más tarde → gana
    },
    activeProduct: Q,
    log: logOf(
      dose('common', T(3), T(3)),
      dose('conflictA', T(4, 10), T(4)), // versión vieja en B
      dose('soloB', T(6)),
    ),
    profile: { name: 'Jan S', peso: 81, est: 180, grasa: null, musculo: null, bmi: 25.0 },
    history: {
      Peso: [
        { ts: T(2), value: 83 },
        { ts: T(4), value: 84, m: T(4) }, // versión vieja del mismo (Peso, ts)
        { ts: T(6), value: 82, m: T(6) }, // muestra solo en B
      ],
    },
    nutrition: {
      '2026-06-09': { water: 750, meals: [{ id: 'mB', kcal: 300, ts: T(9, 19), portion: 1, label: 'Cena' }], m: T(9, 21) },
      '2026-06-10': { water: 250, meals: [], m: T(10, 8) },
    },
    foodLibrary: [{ id: 'favB', label: 'Yogurt', kcal: 150, usoCount: 1, m: T(6) }],
    savedRecons: [{ id: 'rB', label: '5/1', vialMg: 5, aguaMl: 1, createdAt: T(2), m: T(2) }],
    measureGoals: { Peso: 78, IMC: 24 },
    dayNotes: { '2026-06-08': 'descanso' },
    achievements: ['primera-dosis', 'hidratado'],
    fastStartTs: ts(2026, 6, 9, 20),
    lastMealTs: T(9, 19),
    curGoal: 'Recuperación',
    kcalGoal: 2000,
  }), {
    profile: T(4), goals: T(4), settings: T(5), activeProduct: T(8),
    measureGoals: T(4), dayNotes: T(8), fastStartTs: T(9, 20), productDoses: T(3),
  })
  return { a, b }
}

describe('mergeStates — leyes', () => {
  it('idempotencia: merge(a, a) = a y ambos flags de cambio en false', () => {
    const { a } = richPair()
    const r = mergeStates(a, a)
    expect(r.merged).toEqual(a)
    expect(r.changedVsLocal).toBe(false)
    expect(r.changedVsRemote).toBe(false)
  })

  it('conmutatividad: merge(a, b) = merge(b, a) (resultado idéntico, orden determinista incluido)', () => {
    const { a, b } = richPair()
    expect(mergeStates(a, b).merged).toEqual(mergeStates(b, a).merged)
  })

  it('no-pérdida: el fusionado contiene la versión MÁS NUEVA de cada registro en conflicto', () => {
    const { a, b } = richPair()
    const m = mergeStates(a, b).merged
    // log: la edición más nueva de 'conflictA' (m=T6, 2 mg) + unión de soloA/soloB/common
    const items = m.log.flatMap((g) => g.items)
    expect(items.find((i) => i.id === 'conflictA')?.value).toBe(2)
    expect(items.map((i) => i.id).sort()).toEqual(['common', 'conflictA', 'soloA', 'soloB'])
    // protocolos: A editó P después del archivado de B → P vivo con m=T5; B editó Q más tarde → 21:00
    expect(m.protocols[P].archived).toBeUndefined()
    expect(m.protocols[Q].reminderTime).toBe('21:00')
    // history: muestra (Peso, T4) → valor corregido en A (m más nuevo); la muestra solo-B entra
    expect(m.history['Peso'].map((x) => x.value)).toEqual([83, 82.5, 82])
    // unidades LWW: profile de A (T6 > T4), goals de A, settings de B (T5 > T2), activeProduct de B (T8)
    expect(m.profile.name).toBe('Jan')
    expect(m.curGoal).toBe('Metabolismo')
    expect(m.activeProduct).toBe(Q)
    // mapas: conflicto Peso → gana A (measureGoals T5 > T4); clave solo-B (IMC) entra
    expect(m.measureGoals).toEqual({ Peso: 75, IMC: 24 })
    // logros: unión; lastMealTs: max; fastStartTs: unidad más nueva (B, T9 20h)
    expect(m.achievements).toEqual(['hidratado', 'primera-dosis', 'racha-7'])
    expect(m.lastMealTs).toBe(ts(2026, 6, 9, 19))
    expect(m.fastStartTs).toBe(ts(2026, 6, 9, 20))
  })
})

// ── unidad: log items + lápidas (borrar-vs-editar en ambos órdenes, deshacer tras sync) ───────

describe('mergeStates — log items con lápidas', () => {
  const T = (d: number, h = 9) => ts(2026, 6, d, h)

  it('borrar-vs-editar, AMBOS órdenes: lápida m >= registro → muerto; edición m > lápida → vive y limpia la lápida', () => {
    // Caso 1: borrado DESPUÉS de la edición (lápida T6 > edición T5) → muerto
    const edited = pay({ log: logOf(dose('x', T(3), T(5))) })
    const deleter = withMeta(pay({}), {}, { logItems: { x: T(6) } })
    for (const [l, r] of [[edited, deleter], [deleter, edited]] as const) {
      const m = mergeStates(l, r).merged
      expect(m.log).toHaveLength(0)
      expect(m.tombstones?.logItems['x']).toBe(T(6)) // la lápida se conserva (mata copias rezagadas)
    }
    // Caso 2: edición DESPUÉS del borrado (edición T7 > lápida T6) → revive y la lápida se limpia
    const reEdited = pay({ log: logOf(dose('x', T(3), T(7))) })
    for (const [l, r] of [[reEdited, deleter], [deleter, reEdited]] as const) {
      const m = mergeStates(l, r).merged
      expect(m.log.flatMap((g) => g.items).map((i) => i.id)).toEqual(['x'])
      expect(m.tombstones?.logItems['x']).toBeUndefined()
    }
  })

  it('deshacer-tras-sync: el otro dispositivo ya tiene la lápida sincronizada; el undo local (m más nuevo) revive el registro en el merge', () => {
    // dispositivo A: borró y sincronizó → remoto trae lápida T5. Luego A deshizo → item con m=T6, sin lápida local.
    const local = pay({ log: logOf(dose('x', T(3), T(6))) })
    const remote = withMeta(pay({}), {}, { logItems: { x: T(5) } })
    const m = mergeStates(local, remote).merged
    expect(m.log.flatMap((g) => g.items).map((i) => i.id)).toEqual(['x'])
    expect(m.tombstones?.logItems['x']).toBeUndefined()
  })

  it('reagrupa por día: el item editado a OTRO día en un lado queda una sola vez, en el día nuevo', () => {
    const orig = dose('mv', T(3, 10), T(3, 10))
    const moved = dose('mv', T(5, 15), T(8)) // editLogTime en el otro dispositivo: ts nuevo + m más nuevo
    const l = pay({ log: logOf(orig) })
    const r = pay({ log: logOf(moved) })
    const m = mergeStates(l, r).merged
    expect(m.log).toHaveLength(1)
    expect(m.log[0].dateKey).toBe('2026-06-05')
    expect(m.log[0].items[0].ts).toBe(T(5, 15))
  })

  it('legado sin m: el conflicto cae al ts (gana el ts más nuevo)', () => {
    const l = pay({ log: logOf(dose('x', T(3))) })            // sin m → cae a ts T3
    const r = pay({ log: logOf(dose('x', T(4), undefined, { u: `${P} · 3 mg` })) }) // ts T4 (mismo id, editado con hora nueva)
    const m = mergeStates(l, r).merged
    expect(m.log.flatMap((g) => g.items)[0].u).toBe(`${P} · 3 mg`)
  })
})

// ── unidad: protocolos ─────────────────────────────────────────────────────────

describe('mergeStates — protocolos por clave', () => {
  const T = (d: number) => ts(2026, 6, d)

  it('LWW por producto; archivar es edición normal (gana por m, no mata el registro)', () => {
    const l = pay({ protocols: { [P]: mkProtocol(P, T(1), cad({ mode: 'dia' }), { m: T(4) }) } })
    const r = pay({ protocols: { [P]: mkProtocol(P, T(1), cad({ mode: 'dia' }), { m: T(6), archived: true, archivedAt: T(6) }) } })
    const m = mergeStates(l, r).merged
    expect(m.protocols[P].archived).toBe(true) // el archivado es MÁS NUEVO → gana como edición
  })

  it('deleteProduct-vs-editar en ambos órdenes (misma ley que log items)', () => {
    const editado = pay({ protocols: { [P]: mkProtocol(P, T(1), cad({ mode: 'dia' }), { m: T(5) }) } })
    const borrado = withMeta(pay({}), {}, { protocols: { [P]: T(6) } })
    for (const [l, r] of [[editado, borrado], [borrado, editado]] as const) {
      expect(mergeStates(l, r).merged.protocols[P]).toBeUndefined()
    }
    // re-creado después del borrado (m T7 > lápida T6) → vive y limpia la lápida
    const recreado = pay({ protocols: { [P]: mkProtocol(P, T(7), cad({ mode: 'dia' }), { m: T(7) }) } })
    const m = mergeStates(recreado, borrado).merged
    expect(m.protocols[P]).toBeTruthy()
    expect(m.tombstones?.protocols[P]).toBeUndefined()
  })

  it('unión de productos disjuntos (cada dispositivo trackea el suyo)', () => {
    const l = pay({ protocols: { [P]: mkProtocol(P, T(1), cad({ mode: 'dia' }), { m: T(1) }) } })
    const r = pay({ protocols: { [Q]: mkProtocol(Q, T(2), cad({ mode: 'sem' }), { m: T(2) }) } })
    expect(Object.keys(mergeStates(l, r).merged.protocols).sort()).toEqual([Q, P].sort())
  })
})

// ── unidad: nutrición por día (comidas POR ID con m propio + lápidas) ──────────

describe('mergeStates — nutrición por dateKey', () => {
  const T9 = (h: number, min = 0) => ts(2026, 6, 9, h, min)
  const meal = (id: string, kcal: number, mts: number, label: string, m?: number) =>
    ({ id, kcal, ts: mts, portion: 1, label, ...(m != null ? { m } : {}) })

  it('agua: max(a, b); m del día: max; comidas: unión POR ID sin duplicar', () => {
    const shared = meal('m1', 400, T9(14), 'Pollo') // misma comida ya sincronizada (mismo id en ambos lados)
    const l = pay({ nutrition: { '2026-06-09': { water: 500, meals: [meal('m2', 200, T9(18), 'Snack'), shared], m: T9(20) } } })
    const r = pay({ nutrition: { '2026-06-09': { water: 750, meals: [shared], m: T9(19) } } })
    const m = mergeStates(l, r).merged
    const day = m.nutrition['2026-06-09']
    expect(day.water).toBe(750)
    expect(day.m).toBe(T9(20))
    expect(day.meals.map((x) => x.label)).toEqual(['Snack', 'Pollo']) // ts desc, sin duplicados
  })

  it('conflicto por id (kcal editada): gana la comida con m PROPIO más nuevo (no el m del día)', () => {
    // el m del día va al revés (r lo tiene más nuevo) para demostrar que decide el m de la COMIDA
    const l = pay({ nutrition: { '2026-06-09': { water: 0, meals: [meal('m1', 450, T9(14), 'Pollo', T9(21))], m: T9(21) } } })
    const r = pay({ nutrition: { '2026-06-09': { water: 0, meals: [meal('m1', 400, T9(14), 'Pollo', T9(15))], m: T9(22) } } })
    expect(mergeStates(l, r).merged.nutrition['2026-06-09'].meals[0].kcal).toBe(450)
    expect(mergeStates(r, l).merged.nutrition['2026-06-09'].meals[0].kcal).toBe(450) // conmutativo
  })

  it('editar el label CONSERVA el id → una sola comida (la edición gana), nunca duplicada', () => {
    const before = meal('m1', 480, T9(8), 'Avena')                    // legada sin m → cae a ts
    const after = meal('m1', 480, T9(8), 'Avena con fruta', T9(10))   // editada (m más nuevo)
    const l = pay({ nutrition: { '2026-06-09': { water: 0, meals: [after], m: T9(10) } } })
    const r = pay({ nutrition: { '2026-06-09': { water: 0, meals: [before], m: T9(8) } } })
    for (const [x, y] of [[l, r], [r, l]] as const) {
      const meals = mergeStates(x, y).merged.nutrition['2026-06-09'].meals
      expect(meals).toHaveLength(1) // las 480 kcal NO cuentan doble
      expect(meals[0].label).toBe('Avena con fruta')
    }
  })

  it('borrar una comida deja lápida y NO resucita (ambos órdenes); la lápida se conserva', () => {
    const eaten = meal('m1', 480, T9(8), 'Avena', T9(8))
    const stale = pay({ nutrition: { '2026-06-09': { water: 0, meals: [eaten], m: T9(8) } } })
    const deleter = withMeta(
      pay({ nutrition: { '2026-06-09': { water: 0, meals: [], m: T9(9) } } }),
      {}, { meals: { m1: T9(9) } },
    )
    for (const [x, y] of [[stale, deleter], [deleter, stale]] as const) {
      const m = mergeStates(x, y).merged
      expect(m.nutrition['2026-06-09'].meals).toHaveLength(0)
      expect(m.tombstones?.meals['m1']).toBe(T9(9)) // mata copias rezagadas
    }
  })

  it('edición más nueva que la lápida revive la comida y LIMPIA la lápida', () => {
    const revived = pay({ nutrition: { '2026-06-09': { water: 0, meals: [meal('m1', 480, T9(8), 'Avena editada', T9(10))], m: T9(10) } } })
    const deleter = withMeta(
      pay({ nutrition: { '2026-06-09': { water: 0, meals: [], m: T9(9) } } }),
      {}, { meals: { m1: T9(9) } },
    )
    for (const [x, y] of [[revived, deleter], [deleter, revived]] as const) {
      const m = mergeStates(x, y).merged
      expect(m.nutrition['2026-06-09'].meals.map((z) => z.label)).toEqual(['Avena editada'])
      expect(m.tombstones?.meals['m1']).toBeUndefined()
    }
  })

  it('la lápida aplica también a un día presente en UN solo lado (copia rezagada no resucita)', () => {
    const staleDay = pay({ nutrition: { '2026-06-09': { water: 250, meals: [meal('m1', 480, T9(8), 'Avena', T9(8))], m: T9(8) } } })
    const tombOnly = withMeta(pay({}), {}, { meals: { m1: T9(9) } }) // sin el día, solo la lápida
    for (const [x, y] of [[staleDay, tombOnly], [tombOnly, staleDay]] as const) {
      const m = mergeStates(x, y).merged
      expect(m.nutrition['2026-06-09'].meals).toHaveLength(0)
      expect(m.nutrition['2026-06-09'].water).toBe(250) // el agua del día sobrevive
    }
  })

  it('comida legada SIN id: identidad determinista ts|label — el mismo platillo sincronizado no se duplica', () => {
    const legacy = { kcal: 300, ts: T9(9), label: 'Avena', portion: 1 } as unknown as ReturnType<typeof meal>
    const l = pay({ nutrition: { '2026-06-09': { water: 0, meals: [legacy], m: T9(9) } } })
    const r = pay({ nutrition: { '2026-06-09': { water: 0, meals: [{ ...legacy }], m: T9(9) } } })
    expect(mergeStates(l, r).merged.nutrition['2026-06-09'].meals).toHaveLength(1)
  })

  it('día presente en UN solo lado: entra tal cual (unión de días)', () => {
    const l = pay({ nutrition: { '2026-06-08': { water: 250, meals: [], m: ts(2026, 6, 8, 20) } } })
    const r = pay({ nutrition: { '2026-06-09': { water: 500, meals: [meal('m1', 300, T9(9), 'Avena')], m: T9(9) } } })
    const m = mergeStates(l, r).merged
    expect(Object.keys(m.nutrition).sort()).toEqual(['2026-06-08', '2026-06-09'])
    expect(m.nutrition['2026-06-09'].meals).toHaveLength(1)
  })
})

// ── unidad: history (muestras por (medida, ts)) ────────────────────────────────

describe('mergeStates — history de medidas', () => {
  const T = (d: number, h = 8) => ts(2026, 6, d, h)

  it('unión por (medida, ts); conflicto de valor → gana m más nuevo; legado sin m cae a ts (empate → determinista)', () => {
    const l = pay({ history: { Peso: [{ ts: T(2), value: 83 }, { ts: T(4), value: 82.5, m: T(6) }] } })
    const r = pay({ history: { Peso: [{ ts: T(4), value: 84, m: T(5) }, { ts: T(5), value: 82 }], IMC: [{ ts: T(2), value: 25 }] } })
    const m = mergeStates(l, r).merged
    expect(m.history['Peso']).toEqual([
      { ts: T(2), value: 83 },
      { ts: T(4), value: 82.5, m: T(6) }, // el valor corregido más recientemente gana
      { ts: T(5), value: 82 },
    ])
    expect(m.history['IMC']).toHaveLength(1) // medida presente solo en un lado
  })
})

// ── unidad: mapas por clave, recons, favoritos, logros, unidades LWW ───────────

describe('mergeStates — mapas por clave y unidades LWW', () => {
  const T = (d: number) => ts(2026, 6, d)

  it('mapas por clave: unión de claves; conflicto de valor → gana el lado con mtime de unidad más nuevo', () => {
    const l = withMeta(pay({ productAliases: { [P]: 'Ipa', [Q]: 'BPC mío' } }), { productAliases: T(6) })
    const r = withMeta(pay({ productAliases: { [P]: 'Ipamo', 'TB 500': 'TB' } }), { productAliases: T(4) })
    const m = mergeStates(l, r).merged
    expect(m.productAliases).toEqual({ [P]: 'Ipa', [Q]: 'BPC mío', 'TB 500': 'TB' })
  })

  it('borrar una clave de mapa deja lápida mapKeys y NO resucita (ambos órdenes)', () => {
    // el otro lado aún trae la meta con unidad VIEJA (T4) — la lápida (T6) debe ganar
    const deleter = withMeta(pay({}), { measureGoals: T(6) }, { mapKeys: { 'measureGoals:Peso': T(6) } })
    const stale = withMeta(pay({ measureGoals: { Peso: 80 } }), { measureGoals: T(4) })
    for (const [x, y] of [[deleter, stale], [stale, deleter]] as const) {
      const m = mergeStates(x, y).merged
      expect(m.measureGoals['Peso']).toBeUndefined()
      expect(m.tombstones?.mapKeys['measureGoals:Peso']).toBe(T(6)) // mata copias rezagadas
    }
  })

  it('re-set posterior al borrado (unidad más nueva que la lápida) revive la clave y LIMPIA la lápida', () => {
    const reSet = withMeta(pay({ measureGoals: { Peso: 82 } }), { measureGoals: T(7) })
    const deleter = withMeta(pay({}), { measureGoals: T(6) }, { mapKeys: { 'measureGoals:Peso': T(6) } })
    for (const [x, y] of [[reSet, deleter], [deleter, reSet]] as const) {
      const m = mergeStates(x, y).merged
      expect(m.measureGoals['Peso']).toBe(82)
      expect(m.tombstones?.mapKeys['measureGoals:Peso']).toBeUndefined()
    }
  })

  it('deleteProduct: el residuo por-producto (recon/alias) muere junto con el protocolo (lápidas mapKeys)', () => {
    const stale = withMeta(pay({
      protocols: { [P]: mkProtocol(P, T(1), cad({ mode: 'dia' }), { m: T(1) }) },
      productRecon: { [P]: { vialMg: 5, aguaMl: 2 } },
      productAliases: { [P]: 'Ipa' },
    }), { productRecon: T(1), productAliases: T(1) })
    const deleter = withMeta(
      pay({}),
      { productDoses: T(6), productRecon: T(6), lastInjectionSite: T(6), productAliases: T(6) },
      { protocols: { [P]: T(6) }, mapKeys: { [`productRecon:${P}`]: T(6), [`productAliases:${P}`]: T(6), [`productDoses:${P}`]: T(6), [`lastInjectionSite:${P}`]: T(6) } },
    )
    for (const [x, y] of [[deleter, stale], [stale, deleter]] as const) {
      const m = mergeStates(x, y).merged
      expect(m.protocols[P]).toBeUndefined()
      expect(m.productRecon[P]).toBeUndefined()   // antes resucitaba como residuo
      expect(m.productAliases[P]).toBeUndefined()
    }
  })

  it('savedRecons: misma etiqueta creada en dos dispositivos (ids distintos) → UNA sola, gana m más nuevo', () => {
    const l = pay({ savedRecons: [{ id: 'ra', label: 'BPC 5mg/2ml', vialMg: 5, aguaMl: 2, createdAt: T(1), m: T(1) }] })
    const r = pay({ savedRecons: [{ id: 'rb', label: 'bpc 5mg/2ml', vialMg: 5, aguaMl: 2.5, createdAt: T(2), m: T(2) }] })
    const m = mergeStates(l, r).merged
    expect(m.savedRecons).toHaveLength(1)
    expect(m.savedRecons[0]).toMatchObject({ id: 'rb', aguaMl: 2.5 }) // versión más nueva
    expect(mergeStates(r, l).merged.savedRecons).toEqual(m.savedRecons) // conmutativo
  })

  it('savedRecons: lápida respetada; ambos lados conservan las suyas (unión por id)', () => {
    const l = withMeta(
      pay({ savedRecons: [{ id: 'r1', label: '10/2', vialMg: 10, aguaMl: 2, createdAt: T(1), m: T(1) }] }),
      {}, { savedRecons: { r2: T(5) } },
    )
    const r = pay({
      savedRecons: [
        { id: 'r2', label: '5/1', vialMg: 5, aguaMl: 1, createdAt: T(2), m: T(2) },   // borrado en L (lápida T5)
        { id: 'r3', label: '15/3', vialMg: 15, aguaMl: 3, createdAt: T(3), m: T(3) },
      ],
    })
    const m = mergeStates(l, r).merged
    expect(m.savedRecons.map((x) => x.id)).toEqual(['r1', 'r3'])
    expect(m.tombstones?.savedRecons['r2']).toBe(T(5))
  })

  it('foodLibrary: mismo platillo creado en dos dispositivos (ids distintos, misma etiqueta) → uno solo, gana m más nuevo y usoCount = max', () => {
    const l = pay({ foodLibrary: [{ id: 'fa', label: 'Avena', kcal: 200, usoCount: 5, m: T(3) }] })
    const r = pay({ foodLibrary: [{ id: 'fb', label: 'avena', kcal: 220, usoCount: 2, m: T(6) }] })
    const m = mergeStates(l, r).merged
    expect(m.foodLibrary).toHaveLength(1)
    expect(m.foodLibrary[0]).toMatchObject({ id: 'fb', kcal: 220, usoCount: 5 }) // versión más nueva + max uso
    expect(mergeStates(r, l).merged.foodLibrary).toEqual(m.foodLibrary) // conmutativo
  })

  it('achievements: unión de conjuntos (orden determinista)', () => {
    const l = pay({ achievements: ['a', 'c'] })
    const r = pay({ achievements: ['b', 'a'] })
    expect(mergeStates(l, r).merged.achievements).toEqual(['a', 'b', 'c'])
  })

  it('settings + scale viajan JUNTOS como una unidad (el lado más nuevo aporta ambos)', () => {
    const l = withMeta(pay({ scale: 30, settings: { ...initialState.settings, darkMode: true } }), { settings: T(6) })
    const r = withMeta(pay({ scale: 100, settings: { ...initialState.settings, darkMode: false, premium: true } }), { settings: T(4) })
    const m = mergeStates(l, r).merged
    expect(m.scale).toBe(30)
    expect(m.settings.darkMode).toBe(true)
    expect(m.settings.premium).toBe(false) // settings es UNA unidad: no se mezclan campos de ambos lados
  })

  it('el grupo de metas gana en BLOQUE (curGoal/selectedMeasures/kcalGoal del mismo lado)', () => {
    const l = withMeta(pay({ curGoal: 'Metabolismo', selectedMeasures: ['Peso'], kcalGoal: 2200 }), { goals: T(6) })
    const r = withMeta(pay({ curGoal: 'Recuperación', selectedMeasures: ['Dolor'], kcalGoal: 1800 }), { goals: T(4) })
    const m = mergeStates(l, r).merged
    expect(m.curGoal).toBe('Metabolismo')
    expect(m.selectedMeasures).toEqual(['Peso'])
    expect(m.kcalGoal).toBe(2200)
  })
})

// ── legado + GC + flags de cambio ──────────────────────────────────────────────

describe('mergeStates — payload legado, GC de lápidas y flags', () => {
  const T = (d: number) => ts(2026, 6, d)

  it('payload legado (blob de estado completo: sin m/syncMeta/tombstones, CON basura de UI) se fusiona sin colar la basura', () => {
    // así se ve una fila vieja de user_state: el estado entero menos sheet/toast, con pin ya filtrado
    const legacyRemote = {
      todayTs: T(1), screen: 's-app', tab: 'inicio', localOnly: false, logged: true,
      protocols: { [P]: mkProtocol(P, T(1), cad({ mode: 'dia' })) },
      log: logOf(dose('legacy1', T(3))),
      profile: { name: 'Legado', peso: 90, est: 175, grasa: null, musculo: null, bmi: 29.4 },
      settings: { ...initialState.settings, consentActive: true, cloudSync: true },
      importedProducts: [P], protocol: mkProtocol(P, T(1), cad({ mode: 'dia' })),
      measureValues: { Peso: 90 },
    } as unknown as SyncPayload
    const local = pay({ log: logOf(dose('local1', T(5), T(5))) })
    const m = mergeStates(local, legacyRemote).merged
    // la unión de registros funciona con fallbacks…
    expect(m.log.flatMap((g) => g.items).map((i) => i.id).sort()).toEqual(['legacy1', 'local1'])
    expect(m.protocols[P]).toBeTruthy()
    expect(m.profile.name).toBe('Legado') // empate m=0 → riqueza: el perfil configurado le gana al vacío
    // …y NADA de lo nunca-sincronizado ni cachés ni campos de dispositivo se cuela al resultado
    for (const k of [...NEVER_SYNCED_KEYS, ...CACHE_KEYS]) expect(m).not.toHaveProperty(k)
    for (const k of DEVICE_SETTINGS_KEYS) expect(m.settings).not.toHaveProperty(k)
    expect(m.syncMeta).toEqual({ units: {} })
    expect(m.tombstones).toEqual(emptyTombstones())
  })

  it('GC: las lápidas anteriores al corte se descartan; las recientes sobreviven', () => {
    const now = ts(2026, 6, 10)
    const cutoff = now - TOMBSTONE_TTL_MS
    const l = withMeta(pay({}), {}, { logItems: { vieja: ts(2026, 2, 1), reciente: ts(2026, 6, 1) } })
    const m = mergeStates(l, pay({}), cutoff).merged
    expect(m.tombstones?.logItems['vieja']).toBeUndefined()   // > 90 días → GC
    expect(m.tombstones?.logItems['reciente']).toBe(ts(2026, 6, 1))
  })

  it('flags: remoto adelantado → changedVsLocal true / changedVsRemote false (y viceversa)', () => {
    const behind = pay({})
    const ahead = pay({ log: logOf(dose('x', T(3), T(3))) })
    const r1 = mergeStates(behind, ahead)
    expect(r1.changedVsLocal).toBe(true)
    expect(r1.changedVsRemote).toBe(false)
    const r2 = mergeStates(ahead, behind)
    expect(r2.changedVsLocal).toBe(false)
    expect(r2.changedVsRemote).toBe(true)
  })
})

// ── prepareSyncPayload: exclusión ENUMERADA (un campo nuevo sin clasificar truena aquí) ────────

// Clasificación COMPLETA de AppState. Si agregas un campo a AppState, este test (y el chequeo de
// tipos de abajo) fallan hasta que lo clasifiques a consciencia: ¿viaja a la nube o no?
const SYNCED_KEYS = [
  'curGoal', 'secondaryGoals', 'selectedMeasures', 'protocols', 'activeProduct', 'log', 'profile',
  'history', 'kpiOrder', 'productDoses', 'productRecon', 'nutrition', 'foodLibrary', 'macroGoals',
  'kcalGoal', 'lastMealTs', 'settings', 'lastInjectionSite', 'scale', 'savedRecons', 'measureGoals',
  'measureReminders', 'productAliases', 'fastStartTs', 'achievements', 'dayNotes', 'syncMeta', 'tombstones',
] as const

type Classified = (typeof NEVER_SYNCED_KEYS)[number] | (typeof CACHE_KEYS)[number] | (typeof SYNCED_KEYS)[number]
// chequeo a NIVEL DE TIPOS: si deja de compilar, hay una clave de AppState sin clasificar
// (o una clasificada que ya no existe) → decide consciente si el campo nuevo se sincroniza o no.
const _exhaustive: [Exclude<keyof AppState, Classified>, Exclude<Classified, keyof AppState>] extends [never, never] ? 'ok' : never = 'ok'
void _exhaustive

// estado con TODOS los campos opcionales poblados (para que Object.keys los vea)
const fullState = (): AppState => syncActive({
  ...mkState(),
  kpiOrder: ['Peso'],
  syncMeta: { units: { profile: 1 } },
  tombstones: emptyTombstones(),
  settings: { ...initialState.settings, pinEnabled: true, pinHash: 'abc123', cloudSync: true },
  draftDose: { value: 1, unit: 'mg' },
  toast: 'x', toastUndoId: 'y',
  returnTo: 's-app',
  activeProduct: null,
})

describe('prepareSyncPayload — exclusión de todo lo nunca-sincronizado', () => {
  it('el payload contiene EXACTAMENTE las claves sincronizadas (enumeradas)', () => {
    const p = prepareSyncPayload(fullState())
    expect(Object.keys(p).sort()).toEqual([...SYNCED_KEYS].sort())
  })

  it('cada clave nunca-sincronizada y cada caché está AUSENTE del payload (enumeradas una por una)', () => {
    const p = prepareSyncPayload(fullState())
    // enumeración explícita: si un campo nuevo device-local no se agrega a NEVER_SYNCED_KEYS,
    // el test de arriba truena (clave extra); si se agrega, este verifica que de verdad se excluye.
    for (const k of NEVER_SYNCED_KEYS) expect(p, `clave nunca-sincronizada presente: ${k}`).not.toHaveProperty(k)
    for (const k of CACHE_KEYS) expect(p, `caché presente: ${k}`).not.toHaveProperty(k)
  })

  it('settings viaja SIN los campos del dispositivo (pin/consent/cloudSync)', () => {
    const p = prepareSyncPayload(fullState())
    for (const k of DEVICE_SETTINGS_KEYS) expect(p.settings, `campo de dispositivo presente: ${k}`).not.toHaveProperty(k)
    expect(p.settings.darkMode).toBe(false) // lo sincronizable sí viaja
  })

  it('garantiza syncMeta/tombstones (defaults) en estados legados que no los traen', () => {
    const p = prepareSyncPayload(mkState()) // mkState no trae syncMeta/tombstones
    expect(p.syncMeta).toEqual({ units: {} })
    expect(p.tombstones).toEqual(emptyTombstones())
  })
})

// ── applyMerged: preserva lo device-local y recomputa cachés ───────────────────

describe('applyMerged — aplicación del merge sobre el estado local', () => {
  it('conserva UI/dispositivo (pin, consent, cloudSync, localOnly, pantalla, todayTs) y aplica lo sincronizado', () => {
    const local = mkState({
      screen: 's-app', tab: 'diario',
      localOnly: false,
      settings: { ...initialState.settings, pinEnabled: true, pinHash: 'HASH', consentActive: true, cloudSync: true, darkMode: false },
    })
    const merged = withMeta(pay({
      settings: { ...initialState.settings, darkMode: true },
      profile: { name: 'Remoto', peso: 80, est: 178, grasa: null, musculo: null, bmi: 25.2 },
    }), { settings: ts(2026, 6, 9), profile: ts(2026, 6, 9) })
    const next = applyMerged(local, merged)
    expect(next.settings.pinEnabled).toBe(true)      // dispositivo: intacto
    expect(next.settings.pinHash).toBe('HASH')
    expect(next.settings.consentActive).toBe(true)
    expect(next.settings.cloudSync).toBe(true)
    expect(next.settings.darkMode).toBe(true)        // sincronizado: aplicado
    expect(next.profile.name).toBe('Remoto')
    expect(next.screen).toBe('s-app')                // UI: intacta
    expect(next.tab).toBe('diario')
    expect(next.todayTs).toBe(local.todayTs)
  })

  it('recomputa cachés: protocol/importedProducts (syncActive) y measureValues/perfil-espejo/bmi desde el history fusionado', () => {
    const local = mkState()
    const merged = pay({
      protocols: {
        [P]: mkProtocol(P, ts(2026, 6, 1), cad({ mode: 'dia' }), { m: ts(2026, 6, 1) }),
        [Q]: mkProtocol(Q, ts(2026, 6, 2), cad({ mode: 'dia' }), { m: ts(2026, 6, 2), archived: true }),
      },
      activeProduct: P,
      history: { Peso: [{ ts: ts(2026, 6, 8), value: 82, m: ts(2026, 6, 8) }] },
      profile: { name: 'Jan', peso: 90, est: 180, grasa: null, musculo: null, bmi: 27.8 }, // peso stale vs history
      log: logOf(dose('d1', ts(2026, 6, 8, 9), ts(2026, 6, 8, 9))),
    })
    const next = applyMerged(local, merged)
    expect(next.protocol?.product).toBe(P)                    // caché re-derivada
    expect(next.importedProducts).toEqual([P])                // archivados fuera del caché
    expect(next.measureValues['Peso']).toBe(82)               // desde el history fusionado…
    expect(next.profile.peso).toBe(82)                        // …y el campo espejo del perfil corregido
    expect(next.measureValues['Altura']).toBe(180)            // Altura re-espejada desde profile.est (no tiene serie)
    expect(next.profile.bmi).not.toBeNull()
    expect(next.logged).toBe(true)                            // derivado del log fusionado
    expect(next.lastMealTs).toBeNull()                        // derivado de nutrition (vacía)
  })

  it('si el merge mató el último protocolo, las cachés locales stale NO lo resucitan vía hydrate', () => {
    // el otro dispositivo borró P (lápida más nueva) → merged.protocols queda vacío;
    // el estado local aún tiene los cachés protocol/importedProducts apuntando a P
    const local = mkState({ protocols: { [P]: mkProtocol(P, ts(2026, 6, 1), cad({ mode: 'dia' }), { m: ts(2026, 6, 1) }) } })
    expect(local.protocol?.product).toBe(P) // caché poblada (vía syncActive de mkState)
    const localPay = prepareSyncPayload(local)
    const remote = withMeta(pay({}), {}, { protocols: { [P]: ts(2026, 6, 8) } })
    const { merged } = mergeStates(localPay, remote)
    expect(merged.protocols).toEqual({})
    const next = applyMerged(local, merged)
    expect(next.protocols).toEqual({})       // no resucitó desde la caché stale
    expect(next.protocol).toBeNull()
    expect(next.importedProducts).toEqual([])
    expect(next.activeProduct).toBeNull()
  })

  it("la acción 'applyMerged' del reducer aplica el merge en silencio (sin toast)", () => {
    const local = mkState({ toast: null })
    const merged = pay({ dayNotes: { '2026-06-09': 'hola' } })
    const next = reducer(local, { t: 'applyMerged', merged })
    expect(next.dayNotes['2026-06-09']).toBe('hola')
    expect(next.toast).toBeNull()
  })
})

// ── pipeline completo reducer → prepareSyncPayload → mergeStates → applyMerged ─
// (la misma ruta que recorre el sync real: borrar en B debe morir también en A)

describe('pipeline integrado — borrados que viajan por el merge real', () => {
  it('B borra una comida (reducer) → el merge con la copia rezagada de A NO la resucita; aplicada en A, desaparece', () => {
    const shared = mkState({
      nutrition: { '2026-06-09': { water: 250, meals: [{ id: 'm1', kcal: 480, ts: ts(2026, 6, 9, 8), portion: 1, label: 'Avena', m: ts(2026, 6, 9, 8) }], m: ts(2026, 6, 9, 8) } },
    })
    const stateB = reducer(shared, { t: 'delMeal', id: 'm1' }) // lápida real del reducer
    const merged = mergeStates(prepareSyncPayload(shared), prepareSyncPayload(stateB)).merged
    expect(merged.nutrition['2026-06-09'].meals).toHaveLength(0)
    expect(merged.nutrition['2026-06-09'].water).toBe(250)
    const nextA = applyMerged(shared, merged) // A aplica el merge: la comida muere y lastMealTs se recalcula
    expect(nextA.nutrition['2026-06-09'].meals).toHaveLength(0)
    expect(nextA.lastMealTs).toBeNull()
  })

  it('B quita un alias (reducer) → muere en el merge; A lo re-establece después → revive y limpia la lápida', () => {
    vi.useFakeTimers()
    try {
      const shared = mkState({ productAliases: { [P]: 'Ipa' }, syncMeta: { units: { productAliases: ts(2026, 6, 1) } } })
      vi.setSystemTime(ts(2026, 6, 10, 12, 0)) // B borra en T1
      const stateB = reducer(shared, { t: 'setProductAlias', product: P, alias: null })
      const m1 = mergeStates(prepareSyncPayload(shared), prepareSyncPayload(stateB)).merged
      expect(m1.productAliases[P]).toBeUndefined()
      expect(m1.tombstones?.mapKeys[`productAliases:${P}`]).toBe(ts(2026, 6, 10, 12, 0))
      // A (ya con el borrado aplicado) re-establece el alias en T2 > T1 → unidad más nueva que la lápida
      vi.setSystemTime(ts(2026, 6, 10, 12, 5))
      const stateA2 = reducer(applyMerged(shared, m1), { t: 'setProductAlias', product: P, alias: 'Ipa v2' })
      const m2 = mergeStates(prepareSyncPayload(stateA2), m1).merged
      expect(m2.productAliases[P]).toBe('Ipa v2')
      expect(m2.tombstones?.mapKeys[`productAliases:${P}`]).toBeUndefined()
    } finally { vi.useRealTimers() }
  })
})
