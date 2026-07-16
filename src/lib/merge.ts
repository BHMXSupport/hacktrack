// Hacktrack — motor de merge por registro (sync Opción C).
// PURO: sin Date.now() ni I/O — el corte de GC de lápidas llega por parámetro (el caller lo calcula).
// Leyes que garantiza (y que los tests verifican como propiedades):
//   1. Idempotente: merge(a, a) = a (módulo orden determinista de arreglos).
//   2. Conmutativo: merge(a, b) y merge(b, a) producen el MISMO resultado (orden determinista incluido).
//   3. Sin resurrecciones: lápida con m >= m del registro → sigue muerto; una edición/deshacer con
//      m > m de la lápida revive el registro Y limpia la lápida.
//   4. Sin pérdidas: el estado fusionado nunca pierde la versión más nueva de ningún registro.
// Fallback de mtime faltante (payloads legados): log items, muestras de history y comidas caen a
// su ts; todo lo demás cae a 0 (pierde ante cualquier lado estampado — el legado es el "más viejo").
// Limitación conocida (aceptada): regroupLog reagrupa los items por la isoKey LOCAL del dispositivo
// que fusiona — dos dispositivos en zonas horarias distintas pueden colocar el mismo item (mismo ts)
// bajo dateKeys distintos. El dateKey es presentación derivada, el ts del item es la verdad; no hay
// pérdida ni duplicación, solo agrupación local diferente.
import type {
  FoodFav, LogGroup, LogItem, Meal, MeasureSample, NutritionDay, SavedRecon, SyncMeta, Tombstones, UserProtocol,
} from './types'
import { DEVICE_SETTINGS_KEYS, HISTORY_CAP, isoKey, type SyncedSettings, type SyncPayload } from './store'

// vida de una lápida: el caller pasa `gcCutoffMs = ahora - TOMBSTONE_TTL_MS` (mergeStates no mira el reloj)
export const TOMBSTONE_TTL_MS = 90 * 86_400_000

export interface MergeResult {
  merged: SyncPayload
  changedVsLocal: boolean   // el fusionado difiere del local → hay que aplicarlo al estado
  changedVsRemote: boolean  // el fusionado difiere del remoto → hay que subirlo
}

// ── utilidades deterministas ───────────────────────────────────────────────────

// stringify con claves ordenadas (claves con undefined se omiten) — para desempates conmutativos
function stableStringify(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? '·undefined·'
  if (Array.isArray(x)) return '[' + x.map(stableStringify).join(',') + ']'
  const o = x as Record<string, unknown>
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}'
}

// "riqueza": nº de hojas definidas no-nulas — en empate de mtime gana el lado con MÁS contenido
// (evita que un estado recién estrenado le gane por azar a uno configurado cuando ambos son legados m=0)
function richness(x: unknown): number {
  if (x == null) return 0
  if (typeof x !== 'object') return 1
  if (Array.isArray(x)) return x.reduce((n: number, v) => n + richness(v), 0)
  return Object.values(x as Record<string, unknown>).reduce((n: number, v) => n + richness(v), 0)
}

// desempate TOTALMENTE determinista y conmutativo cuando los mtimes empatan
function preferDet<T>(a: T, b: T): T {
  const ra = richness(a), rb = richness(b)
  if (ra !== rb) return ra > rb ? a : b
  return stableStringify(a) >= stableStringify(b) ? a : b
}

// igualdad profunda insensible al orden de claves (claves con undefined = ausentes)
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  const aArr = Array.isArray(a), bArr = Array.isArray(b)
  if (aArr !== bArr) return false
  if (aArr) {
    const A = a as unknown[], B = b as unknown[]
    return A.length === B.length && A.every((v, i) => deepEqual(v, B[i]))
  }
  const A = a as Record<string, unknown>, B = b as Record<string, unknown>
  const ka = Object.keys(A).filter((k) => A[k] !== undefined)
  const kb = Object.keys(B).filter((k) => B[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => deepEqual(A[k], B[k]))
}

// ── merge genérico de registros con lápidas ───────────────────────────────────

// une dos mapas de lápidas conservando el m MÁS NUEVO por clave (conmutativo)
function mergeTombMaps(a: Record<string, number> = {}, b: Record<string, number> = {}): Record<string, number> {
  const out = { ...a }
  for (const [id, tm] of Object.entries(b)) if (out[id] == null || tm > out[id]) out[id] = tm
  return out
}

// Fusiona colecciones indexadas por id con LWW por registro + lápidas:
//   presente en ambos → gana el m más nuevo (empate → preferDet);
//   lápida m >= m del registro → muerto; registro m > lápida → vive y la lápida se limpia.
function mergeRecords<T>(
  localArr: T[], remoteArr: T[],
  tombL: Record<string, number>, tombR: Record<string, number>,
  keyOf: (x: T) => string, mOf: (x: T) => number,
): { alive: T[]; tomb: Record<string, number> } {
  const tomb = mergeTombMaps(tombL, tombR)
  const byId = new Map<string, T>()
  for (const arr of [localArr, remoteArr]) {
    for (const x of arr) {
      const id = keyOf(x)
      const prev = byId.get(id)
      if (!prev) { byId.set(id, x); continue }
      const mp = mOf(prev), mx = mOf(x)
      byId.set(id, mx > mp ? x : mx < mp ? prev : preferDet(prev, x))
    }
  }
  const alive: T[] = []
  for (const [id, x] of byId) {
    const tm = tomb[id]
    if (tm != null && tm >= mOf(x)) continue // muerto: la lápida es igual o más nueva que el registro
    if (tm != null) delete tomb[id]          // revivido: la edición es más nueva → limpia la lápida
    alive.push(x)
  }
  return { alive, tomb }
}

const mLogItem = (it: LogItem) => it.m ?? it.ts          // legado: cae al ts del registro
const mSample = (sm: MeasureSample) => sm.m ?? sm.ts     // legado: cae al ts de la muestra
const mZero = (x: { m?: number }) => x.m ?? 0            // legado: cae a 0 (pierde ante lo estampado)

// ── unidades de merge ──────────────────────────────────────────────────────────

// log: los ITEMS son la unidad (por id); los grupos por día son DERIVADOS → se reagrupan al final
function regroupLog(items: LogItem[]): LogGroup[] {
  const byDay = new Map<string, LogItem[]>()
  for (const it of items) {
    const k = isoKey(it.ts)
    const arr = byDay.get(k)
    if (arr) arr.push(it)
    else byDay.set(k, [it])
  }
  return [...byDay.entries()]
    .map(([dateKey, its]) => ({ dateKey, items: its.sort((a, b) => b.ts - a.ts || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)) }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)) // más reciente primero (misma convención que prependToLog)
}

// nutrición: unidad = día (dateKey) para agua y m; las COMIDAS se fusionan POR ID ESTABLE con LWW
// por comida (m propio; fallback ts para comidas legadas) + lápidas (tombstones.meals) — editar el
// label conserva el id (no duplica) y borrar deja lápida (no resucita). Identidad de una comida
// legada sin id: `${ts}|${label}` (determinista — dos payloads viejos del mismo platillo coinciden).
const mealKey = (x: Meal) => x.id || `${x.ts}|${x.label ?? ''}`
const mMeal = (x: Meal) => x.m ?? x.ts

function mergeNutrition(
  l: Record<string, NutritionDay> = {}, r: Record<string, NutritionDay> = {},
  tomb: Record<string, number> = {}, // lápidas de comidas YA fusionadas — se MUTA: revivir limpia
): Record<string, NutritionDay> {
  // lápida m >= m de la comida → muerta; comida m > lápida → vive y la lápida se limpia
  const filterTomb = (meals: Meal[]): Meal[] => meals.filter((meal) => {
    const tm = tomb[mealKey(meal)]
    if (tm != null && tm >= mMeal(meal)) return false
    if (tm != null) delete tomb[mealKey(meal)]
    return true
  })
  const out: Record<string, NutritionDay> = {}
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const a = l[k], b = r[k]
    if (!a || !b) {
      // día presente en un solo lado → entra tal cual (orden original), pero las lápidas SÍ aplican:
      // una copia rezagada del día no debe resucitar una comida borrada en otro dispositivo
      const day = (a ?? b)!
      const alive = filterTomb(day.meals)
      out[k] = alive.length === day.meals.length ? day : { ...day, meals: alive }
      continue
    }
    const byId = new Map<string, Meal>()
    for (const meal of [...a.meals, ...b.meals]) {
      const id = mealKey(meal)
      const prev = byId.get(id)
      if (!prev) { byId.set(id, meal); continue }
      const mp = mMeal(prev), mx = mMeal(meal)
      byId.set(id, mx > mp ? meal : mx < mp ? prev : preferDet(prev, meal))
    }
    const meals = filterTomb([...byId.values()]).sort((x, y) => y.ts - x.ts || (x.id < y.id ? 1 : x.id > y.id ? -1 : 0))
    const m = Math.max(a.m ?? 0, b.m ?? 0)
    // AGUA = max(a, b) POR DISEÑO: los vasos se agregan en cualquier dispositivo y max nunca pierde
    // hidratación registrada. Limitación aceptada: "Quitar un vaso" NO se propaga entre dispositivos
    // (el max lo deshace al fusionar con una copia que aún trae el total anterior) — solo corrige en
    // el dispositivo local. Un decremento sincronizable exigiría deltas o mtime por día con LWW, que
    // perdería vasos legítimos agregados en paralelo; se prefiere no perder agua real.
    out[k] = { water: Math.max(a.water, b.water), meals, ...(m > 0 ? { m } : {}) }
  }
  return out
}

// history: unión de muestras por identidad (medida, ts); conflicto de valor → gana m más nuevo
// (fallback ts). Tope compartido con el store (HISTORY_CAP muestras más recientes por medida).
function mergeHistory(
  l: Record<string, MeasureSample[]> = {}, r: Record<string, MeasureSample[]> = {},
): Record<string, MeasureSample[]> {
  const out: Record<string, MeasureSample[]> = {}
  for (const name of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const byTs = new Map<number, MeasureSample>()
    for (const sm of [...(l[name] ?? []), ...(r[name] ?? [])]) {
      const prev = byTs.get(sm.ts)
      if (!prev) { byTs.set(sm.ts, sm); continue }
      const mp = mSample(prev), ms = mSample(sm)
      byTs.set(sm.ts, ms > mp ? sm : ms < mp ? prev : preferDet(prev, sm))
    }
    const arr = [...byTs.values()].sort((x, y) => x.ts - y.ts)
    out[name] = arr.length > HISTORY_CAP ? arr.slice(arr.length - HISTORY_CAP) : arr
  }
  return out
}

// mapas por clave (metas, recordatorios, alias, dosis/recon/sitio por producto, notas del día):
// unión de claves; conflicto de VALOR en una clave presente en ambos → gana el lado cuyo mtime de
// unidad de mapa (syncMeta.units[<mapa>]) es más nuevo; empate → preferDet.
// Lápidas por clave (tombstones.mapKeys, `${mapa}:${clave}`): la AUSENCIA gana si la lápida es tan
// nueva como el mtime de unidad del lado que aún TIENE la clave; un re-set posterior (mtime de
// unidad > lápida) revive la clave y limpia la lápida. Granularidad conocida: el mtime es del MAPA
// completo (no por clave) — tocar otra clave del mismo mapa sin haber hecho pull puede revivir un
// borrado concurrente; coste aceptado a cambio de no llevar mtimes por clave.
function mergePlainMap<V>(
  l: Record<string, V> = {}, r: Record<string, V> = {}, mL: number, mR: number,
  mapName?: string, tomb: Record<string, number> = {}, // lápidas mapKeys fusionadas — se MUTA: revivir limpia
): Record<string, V> {
  const out: Record<string, V> = { ...r, ...l }
  for (const k of Object.keys(out)) {
    if (k in l && k in r && !deepEqual(l[k], r[k])) {
      out[k] = mL > mR ? l[k] : mR > mL ? r[k] : preferDet(l[k], r[k])
    }
    if (!mapName) continue
    const tm = tomb[`${mapName}:${k}`]
    if (tm == null) continue
    const vm = Math.max(k in l ? mL : 0, k in r ? mR : 0)
    if (tm >= vm) delete out[k]
    else delete tomb[`${mapName}:${k}`]
  }
  return out
}

// unidad LWW completa (profile, settings+scale, grupo de metas, escalares): gana el mtime de unidad
// más nuevo; empate → un lado indefinido (payload legado sin el campo) pierde ante uno definido,
// y si ambos existen decide preferDet (riqueza primero: un lado configurado le gana a uno vacío).
function pickUnit<T>(l: T, r: T, mL: number, mR: number): T {
  if (mL > mR) return l
  if (mR > mL) return r
  if (l == null && r != null) return r
  if (r == null && l != null) return l
  return preferDet(l, r)
}

// ── merge principal ────────────────────────────────────────────────────────────

/** Fusiona dos payloads de sync registro por registro. PURO — sin reloj: `gcCutoffMs` es el corte
 *  de GC de lápidas (las anteriores al corte se descartan del resultado; 0 = conservar todas). */
export function mergeStates(local: SyncPayload, remote: SyncPayload, gcCutoffMs = 0): MergeResult {
  const uL = (k: string) => local.syncMeta?.units?.[k] ?? 0
  const uR = (k: string) => remote.syncMeta?.units?.[k] ?? 0
  const empty = (): Tombstones => ({ logItems: {}, protocols: {}, savedRecons: {}, foodLibrary: {}, meals: {}, mapKeys: {} })
  const tL: Tombstones = { ...empty(), ...(local.tombstones ?? {}) }
  const tR: Tombstones = { ...empty(), ...(remote.tombstones ?? {}) }
  // lápidas de comidas y de claves de mapa: fusionadas ANTES (mergeNutrition/mergePlainMap las
  // consultan y las MUTAN — revivir limpia); las lápidas legadas ausentes caen a {} vía `empty`
  const mealTomb = mergeTombMaps(tL.meals ?? {}, tR.meals ?? {})
  const mapTomb = mergeTombMaps(tL.mapKeys ?? {}, tR.mapKeys ?? {})

  // log: items por id (grupos derivados → reagrupar)
  const logRes = mergeRecords(
    (local.log ?? []).flatMap((g) => g.items), (remote.log ?? []).flatMap((g) => g.items),
    tL.logItems, tR.logItems, (it) => it.id, mLogItem,
  )

  // protocolos: por clave de producto (archivar es edición normal; borrar deja lápida)
  const protoRes = mergeRecords(
    Object.entries(local.protocols ?? {}), Object.entries(remote.protocols ?? {}),
    tL.protocols, tR.protocols, ([k]) => k, ([, p]) => mZero(p),
  )
  const protocols: Record<string, UserProtocol> = {}
  for (const [k, p] of protoRes.alive.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) protocols[k] = p

  // reconstituciones guardadas: por id (fallback label para formas legadas sin id) + de-dupe por
  // etiqueta (la misma receta guardada en dos dispositivos nace con ids distintos) — espejo del
  // patrón de foodLibrary: en choque de etiqueta gana el m más nuevo
  const reconRes = mergeRecords(
    local.savedRecons ?? [], remote.savedRecons ?? [],
    tL.savedRecons, tR.savedRecons, (x: SavedRecon) => x.id || x.label, mZero,
  )
  const reconByLabel = new Map<string, SavedRecon>()
  for (const x of reconRes.alive) {
    const lk = (x.label ?? '').trim().toLowerCase()
    const prev = reconByLabel.get(lk)
    if (!prev) { reconByLabel.set(lk, x); continue }
    reconByLabel.set(lk, mZero(x) > mZero(prev) ? x : mZero(x) < mZero(prev) ? prev : preferDet(prev, x))
  }
  const savedRecons = [...reconByLabel.values()].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id < b.id ? -1 : 1))

  // biblioteca de comidas: por id + de-dupe por etiqueta (dos dispositivos crean el mismo platillo
  // con ids distintos) — gana el m más nuevo y usoCount = max (conserva el aprendizaje de ambos)
  const favRes = mergeRecords(
    local.foodLibrary ?? [], remote.foodLibrary ?? [],
    tL.foodLibrary, tR.foodLibrary, (f: FoodFav) => f.id || f.label, mZero,
  )
  const byLabel = new Map<string, FoodFav>()
  for (const f of favRes.alive) {
    const lk = (f.label ?? '').trim().toLowerCase()
    const prev = byLabel.get(lk)
    if (!prev) { byLabel.set(lk, f); continue }
    const win = mZero(f) > mZero(prev) ? f : mZero(f) < mZero(prev) ? prev : preferDet(prev, f)
    byLabel.set(lk, { ...win, usoCount: Math.max(prev.usoCount ?? 0, f.usoCount ?? 0) })
  }
  const foodLibrary = [...byLabel.values()].sort((a, b) => mZero(b) - mZero(a) || (a.id < b.id ? -1 : 1))

  // unidades LWW: perfil | settings (+scale, viajan juntos) | grupo de metas | activeProduct | fastStartTs
  const profile = pickUnit(local.profile, remote.profile, uL('profile'), uR('profile'))
  // depurar campos de dispositivo también AQUÍ: un blob remoto legado (push de estado completo)
  // aún trae consent/cloudSync — no deben sobrevivir en el resultado del merge
  const cleanSettings = (st: SyncedSettings | undefined): SyncedSettings | undefined => {
    if (!st) return st
    const c: Record<string, unknown> = { ...st }
    for (const k of DEVICE_SETTINGS_KEYS) delete c[k]
    return c as SyncedSettings
  }
  const setGrp = pickUnit(
    { settings: cleanSettings(local.settings), scale: local.scale },
    { settings: cleanSettings(remote.settings), scale: remote.scale },
    uL('settings'), uR('settings'),
  )
  const goals = pickUnit(
    { curGoal: local.curGoal ?? null, secondaryGoals: local.secondaryGoals ?? [], selectedMeasures: local.selectedMeasures ?? [], kpiOrder: local.kpiOrder, macroGoals: local.macroGoals ?? null, kcalGoal: local.kcalGoal ?? null },
    { curGoal: remote.curGoal ?? null, secondaryGoals: remote.secondaryGoals ?? [], selectedMeasures: remote.selectedMeasures ?? [], kpiOrder: remote.kpiOrder, macroGoals: remote.macroGoals ?? null, kcalGoal: remote.kcalGoal ?? null },
    uL('goals'), uR('goals'),
  )
  const activeProduct = pickUnit(local.activeProduct ?? null, remote.activeProduct ?? null, uL('activeProduct'), uR('activeProduct'))
  const fastStartTs = pickUnit(local.fastStartTs ?? null, remote.fastStartTs ?? null, uL('fastStartTs'), uR('fastStartTs'))

  // escalares/conjuntos sin conflicto real: max y unión
  const lastMealTs = local.lastMealTs == null ? (remote.lastMealTs ?? null)
    : remote.lastMealTs == null ? local.lastMealTs
    : Math.max(local.lastMealTs, remote.lastMealTs)
  const achievements = [...new Set([...(local.achievements ?? []), ...(remote.achievements ?? [])])].sort()

  // syncMeta: por unidad, el mtime más nuevo de ambos lados
  const unitKeys = new Set([...Object.keys(local.syncMeta?.units ?? {}), ...Object.keys(remote.syncMeta?.units ?? {})])
  const units: Record<string, number> = {}
  for (const k of [...unitKeys].sort()) units[k] = Math.max(uL(k), uR(k))
  const syncMeta: SyncMeta = { units }

  // nutrición y mapas por clave: se fusionan ANTES de armar las lápidas finales — consultan
  // mealTomb/mapTomb y les LIMPIAN las claves revividas (no deben sobrevivir en el resultado)
  const nutrition = mergeNutrition(local.nutrition, remote.nutrition, mealTomb)
  const productDoses = mergePlainMap(local.productDoses, remote.productDoses, uL('productDoses'), uR('productDoses'), 'productDoses', mapTomb)
  const productRecon = mergePlainMap(local.productRecon, remote.productRecon, uL('productRecon'), uR('productRecon'), 'productRecon', mapTomb)
  const lastInjectionSite = mergePlainMap(local.lastInjectionSite, remote.lastInjectionSite, uL('lastInjectionSite'), uR('lastInjectionSite'), 'lastInjectionSite', mapTomb)
  const measureGoals = mergePlainMap(local.measureGoals, remote.measureGoals, uL('measureGoals'), uR('measureGoals'), 'measureGoals', mapTomb)
  const measureReminders = mergePlainMap(local.measureReminders, remote.measureReminders, uL('measureReminders'), uR('measureReminders'), 'measureReminders', mapTomb)
  const productAliases = mergePlainMap(local.productAliases, remote.productAliases, uL('productAliases'), uR('productAliases'), 'productAliases', mapTomb)
  const dayNotes = mergePlainMap(local.dayNotes, remote.dayNotes, uL('dayNotes'), uR('dayNotes'), 'dayNotes', mapTomb)

  // lápidas fusionadas + GC (las anteriores al corte se descartan; su registro ya murió arriba)
  const gc = (t: Record<string, number>) => {
    const out: Record<string, number> = {}
    for (const [id, tm] of Object.entries(t)) if (tm >= gcCutoffMs) out[id] = tm
    return out
  }
  const tombstones: Tombstones = {
    logItems: gc(logRes.tomb),
    protocols: gc(protoRes.tomb),
    savedRecons: gc(reconRes.tomb),
    foodLibrary: gc(favRes.tomb),
    meals: gc(mealTomb),
    mapKeys: gc(mapTomb),
  }

  // TODAS las claves del payload se emiten EXPLÍCITAS (nunca spread de las entradas: un payload
  // legado trae basura de UI — todayTs, screen… — que no debe colarse al resultado)
  const merged: SyncPayload = {
    curGoal: goals.curGoal,
    secondaryGoals: goals.secondaryGoals,
    selectedMeasures: goals.selectedMeasures,
    kpiOrder: goals.kpiOrder,
    macroGoals: goals.macroGoals,
    kcalGoal: goals.kcalGoal,
    protocols,
    activeProduct,
    log: regroupLog(logRes.alive),
    profile,
    history: mergeHistory(local.history, remote.history),
    productDoses,
    productRecon,
    nutrition,
    foodLibrary,
    lastMealTs,
    // el lado local siempre viene de prepareSyncPayload (settings/scale definidos); los defaults
    // solo cubren el caso degenerado de dos payloads legados incompletos
    settings: setGrp.settings ?? ({} as SyncedSettings),
    scale: setGrp.scale ?? 100,
    lastInjectionSite,
    savedRecons,
    measureGoals,
    measureReminders,
    productAliases,
    fastStartTs,
    achievements,
    dayNotes,
    syncMeta,
    tombstones,
  }

  return {
    merged,
    changedVsLocal: !deepEqual(merged, local),
    changedVsRemote: !deepEqual(merged, remote),
  }
}
