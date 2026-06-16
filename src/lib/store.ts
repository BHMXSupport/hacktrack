// Hacktrack — store central (Context + reducer). Implementa los fixes P0 + endurecimiento del audit.
import { createContext, useContext } from 'react'
import type {
  Category, LogGroup, LogItem, Profile, UserCadence, UserProtocol, UserSettings, SyringeScale, MeasureSample, Meal, FoodFav,
} from './types'
import { PEPTIDES, MEASURES_BY, MEASURE_META, MEASURE_ICON } from './catalog'
import { presetCad, diaTocaCadence, fmtTime, startOfDay, weekStrip } from './cadence'
import { bmiCalc } from './bmi'

export type ScreenId =
  | 's-splash' | 's-onboarding' | 's-goal' | 's-account' | 's-login' | 's-import' | 's-app'
export type TabId = 'inicio' | 'diario' | 'protocolo' | 'vida' | 'comida' | 'semana'
export type ProgresoView = 'cal' | 'avances'
export type SheetId =
  | 'registrar' | 'calc' | 'medida' | 'medidas' | 'agregar' | 'day-detail'
  | 'arco' | 'confirm-delete' | 'perfil' | 'paywall' | 'protocolo-edit' | 'ajustes'

export interface AppState {
  todayTs: number
  screen: ScreenId
  tab: TabId
  sheet: SheetId | null
  sheetArg: string | null      // p.ej. id de log a borrar, o producto

  curGoal: Category | null
  selectedMeasures: string[]
  progresoView: ProgresoView                // segmento activo en Progreso (global, para deep-link desde Inicio)
  protocols: Record<string, UserProtocol>  // FUENTE DE VERDAD: un protocolo editable por producto
  activeProduct: string | null             // producto "primario" (cuenta regresiva en Inicio, etc.)
  protocol: UserProtocol | null            // CACHÉ sincronizado = protocols[activeProduct] (no escribir directo)
  importedProducts: string[]               // CACHÉ = Object.keys(protocols) (lista de productos trackeados)

  log: LogGroup[]
  profile: Profile
  measureValues: Record<string, number>
  history: Record<string, MeasureSample[]>   // serie temporal por KPI/medida (dashboard)
  productDoses: Record<string, { value: number; unit: string }>  // dosis recordada por producto (para "hecho hoy")
  productRecon: Record<string, { vialMg: number; aguaMl: number }> // reconstitución recordada por producto (UI/mL → mg)
  nutrition: Record<string, { water: number; meals: Meal[] }>        // por dateKey: hidratación + comidas
  foodLibrary: FoodFav[]                                              // comidas frecuentes (registro 1-tap)
  macroGoals: { protein: number; carbs: number; fat: number } | null // metas de macros que define el usuario
  kcalGoal: number | null                                            // meta calórica diaria
  lastMealTs: number | null                                          // última comida registrada (chip "repetir")
  settings: UserSettings

  logged: boolean              // pasó el primer registro (P1-5 / P1-7)
  scale: SyringeScale          // escala de jeringa de la calculadora (P0-6)
  draftDose: { value: number; unit: string; recon?: { vialMg: number; aguaMl: number } } | null  // "copiar a mi registro" desde la calc (con reconstitución)
  toast: string | null
  toastUndoId: string | null   // id del log a deshacer desde el toast (ej. dosis recién registrada)
}

export const initialState: AppState = {
  todayTs: Date.now(),
  screen: 's-splash',
  tab: 'inicio',
  sheet: null,
  sheetArg: null,
  curGoal: null,
  selectedMeasures: [],
  progresoView: 'cal',
  protocols: {},
  activeProduct: null,
  protocol: null,
  importedProducts: [],
  log: [],                     // vacío para usuario nuevo (P0-2: racha honesta)
  profile: { name: null, peso: null, est: null, grasa: null, musculo: null, bmi: null },
  measureValues: {},
  history: {},
  productDoses: {},
  productRecon: {},
  nutrition: {},
  foodLibrary: [],
  macroGoals: null,
  kcalGoal: null,
  lastMealTs: null,
  settings: {
    pinEnabled: false,
    darkMode: false,
    remindersEnabled: false,
    weeklySummary: true,
    emailNotices: false,
    consentVersion: 'v1.0',
    consentActive: true,
    premium: false,
  },
  logged: false,
  scale: 100,
  draftDose: null,
  toast: null,
  toastUndoId: null,
}

export type Action =
  | { t: 'go'; screen: ScreenId }
  | { t: 'tab'; tab: TabId }
  | { t: 'sheet'; sheet: SheetId | null; arg?: string | null }
  | { t: 'tick' }                                                     // refresca todayTs (medianoche)
  | { t: 'pickGoal'; cat: Category }                                   // P0-4
  | { t: 'setProtocol'; product: string }
  | { t: 'setCadence'; cadence: UserCadence }                          // P0-3
  | { t: 'updateProtocol'; patch: Partial<UserProtocol> }             // editar el protocolo en foco de edición
  | { t: 'updateProtocolFor'; product: string; patch: Partial<UserProtocol> } // editar un producto específico
  | { t: 'setActiveProduct'; product: string }                        // foco de edición (interno, no "activo" visible)
  | { t: 'setProgresoView'; view: ProgresoView }                      // cambia el segmento de Progreso (deep-link)
  | { t: 'water'; delta: number }                                     // hidratación de hoy (± vasos)
  | { t: 'addMeal'; kcal: number; protein?: number | null; carbs?: number | null; fat?: number | null; label?: string; fav?: boolean; ts?: number } // agrega comida (ts = franja elegida)
  | { t: 'addFavMeal'; id: string; portion?: number; ts?: number }    // registra una comida favorita (1-tap, con porción y franja)
  | { t: 'delMeal'; id: string }                                      // elimina una comida
  | { t: 'delFav'; id: string }                                       // elimina un favorito
  | { t: 'editFav'; id: string; patch: Partial<FoodFav> }             // edita un favorito (nombre/kcal/macros)
  | { t: 'copyYesterday' }                                            // copia las comidas de ayer a hoy
  | { t: 'setMacroGoals'; goals: { protein: number; carbs: number; fat: number } | null } // metas de macros
  | { t: 'setKcalGoal'; value: number | null }                        // meta calórica diaria
  | { t: 'deleteProduct'; product: string }                           // quitar producto (conserva registros pasados)
  | { t: 'importProducts'; names: string[] }
  | { t: 'logDose'; product: string; value: number | null; unit: string; ts?: number; doseMg?: number; recon?: { vialMg: number; aguaMl: number } } // P0-1
  | { t: 'saveMeasure'; name: string; value: number; nota?: string; ts?: number }  // P0-1
  | { t: 'saveMedidas'; values: Partial<Pick<Profile, 'peso' | 'est' | 'grasa' | 'musculo'>>; ts?: number } // KPI compuesto
  | { t: 'deleteLog'; id: string }                                    // P1-1
  | { t: 'setSetting'; key: keyof UserSettings; value: boolean | string }
  | { t: 'setName'; name: string }
  | { t: 'setProfileFields'; patch: Partial<Profile> }                // edad/sexo/actividad/meta (TDEE/proyección)
  | { t: 'setReminderTime'; time: string }
  | { t: 'setScale'; scale: SyringeScale }
  | { t: 'setDraftDose'; draft: { value: number; unit: string; recon?: { vialMg: number; aguaMl: number } } | null }
  | { t: 'arcoDelete' }                                               // P0-5
  | { t: 'reset' }                                                    // P1-7
  | { t: 'toast'; msg: string | null }

// ── helpers ────────────────────────────────────────────────────────────────────
let _seq = 0
const genId = () => `it_${Date.now().toString(36)}_${_seq++}`

// clave de fecha local estable 'YYYY-MM-DD' (identidad del grupo del diario)
export function isoKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// franja horaria de una comida (para predicción contextual) — frases es-MX
export function mealSlot(ts: number): string {
  const h = new Date(ts).getHours()
  if (h < 6) return 'antojo nocturno'
  if (h < 10) return 'desayuno'
  if (h < 12) return 'colación de la mañana'
  if (h < 16) return 'comida'
  if (h < 19) return 'colación de la tarde'
  if (h < 23) return 'cena'
  return 'antojo nocturno'
}

const HISTORY_CAP = 365

function prependToLog(log: LogGroup[], item: LogItem): LogGroup[] {
  const key = isoKey(item.ts)
  const idx = log.findIndex((g) => g.dateKey === key)
  let next: LogGroup[]
  if (idx === -1) {
    next = [...log, { dateKey: key, items: [item] }]
  } else {
    next = log.slice()
    next[idx] = { ...next[idx], items: [item, ...next[idx].items].sort((a, b) => b.ts - a.ts) }
  }
  return next.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)) // más reciente primero
}

function pushHistory(
  hist: Record<string, MeasureSample[]>,
  entries: { name: string; value: number; ts: number }[],
): Record<string, MeasureSample[]> {
  const next = { ...hist }
  for (const e of entries) {
    const arr = [...(next[e.name] ?? []), { ts: e.ts, value: e.value }].sort((a, b) => a.ts - b.ts)
    next[e.name] = arr.length > HISTORY_CAP ? arr.slice(arr.length - HISTORY_CAP) : arr
  }
  return next
}

// P0-2: racha = días consecutivos (desde hoy hacia atrás) con ≥1 dosis — por clave de fecha estable
export function computeStreak(log: LogGroup[], today: Date): number {
  let count = 0
  let d = startOfDay(today)
  for (;;) {
    const g = log.find((x) => x.dateKey === isoKey(d.getTime()))
    if (!g?.items.some((it) => it.type === 'dose')) break
    count++
    d = new Date(d.getTime() - 86400000)
  }
  return count
}

// estado on/off de la tira semanal por clave de fecha. doseOnly = solo días con dosis (adherencia).
export function weekStatus(log: LogGroup[], today: Date, doseOnly = false): boolean[] {
  return weekStrip(today).map((d) => {
    const g = log.find((x) => x.dateKey === isoKey(d.getTime()))
    if (!g) return false
    return doseOnly ? g.items.some((it) => it.type === 'dose') : g.items.length > 0
  })
}

export const STREAK_GOAL = 30

function fmtMeasureValue(name: string, v: number): string {
  const meta = MEASURE_META[name] ?? { kind: 'scale' as const, max: 100 }
  return meta.kind === 'scale' ? `${v} / ${meta.max}` : `${v}${meta.unit ? ' ' + meta.unit : ''}`
}

function freshProtocol(product: string, todayTs: number): UserProtocol | null {
  const entry = PEPTIDES[product]
  if (!entry) return null
  return {
    product,
    cadence: presetCad(entry),
    progOn: false,
    progN: entry.phases ?? 2,
    curPhase: 0,
    startDate: startOfDay(new Date(todayTs)).getTime(),
    endDate: null,
    reminderTime: '08:00',
  }
}

// mantiene sincronizados los cachés (protocol = activo, importedProducts = llaves del mapa)
export function syncActive(s: AppState): AppState {
  const protocol = s.activeProduct ? (s.protocols[s.activeProduct] ?? null) : null
  const activeProduct = protocol ? s.activeProduct : (Object.keys(s.protocols)[0] ?? null)
  return {
    ...s,
    activeProduct,
    protocol: activeProduct ? (s.protocols[activeProduct] ?? null) : null,
    importedProducts: Object.keys(s.protocols),
  }
}

// migra estado legado (un solo `protocol` + `importedProducts`) al mapa multi-protocolo
export function hydrate(s: AppState): AppState {
  let protocols = s.protocols ?? {}
  if (Object.keys(protocols).length === 0 && (s.protocol || (s.importedProducts ?? []).length)) {
    protocols = {}
    if (s.protocol) protocols[s.protocol.product] = s.protocol
    for (const name of s.importedProducts ?? []) {
      if (!protocols[name]) {
        const fp = freshProtocol(name, s.todayTs)
        if (fp) protocols[name] = fp
      }
    }
  }
  const activeProduct = s.activeProduct ?? s.protocol?.product ?? Object.keys(protocols)[0] ?? null

  // Estampa las dosis legado (sin producto) con el producto, SOLO si es inequívoco: hay exactamente
  // UN protocolo. Con varios protocolos, atribuirlas al activo crea inyecciones fantasma (p.ej. SLU-PP);
  // mejor dejarlas en null → quedan excluidas de las vistas por-producto. (fix: dosis fantasma en el chart.)
  let log = s.log
  const names = Object.keys(protocols)
  const anchor = names.length === 1 ? names[0] : null
  if (anchor && s.log.some((g) => g.items.some((it) => it.type === 'dose' && it.product == null))) {
    log = s.log.map((g) => ({
      ...g,
      items: g.items.map((it) => (it.type === 'dose' && it.product == null ? { ...it, product: anchor } : it)),
    }))
  }

  return syncActive({ ...s, protocols, log, activeProduct })
}

// ── reducer ──────────────────────────────────────────────────────────────────
export function reducer(s: AppState, a: Action): AppState {
  switch (a.t) {
    case 'go':
      return { ...s, screen: a.screen }
    case 'tab':
      return { ...s, tab: a.tab, sheet: null }
    case 'sheet':
      return { ...s, sheet: a.sheet, sheetArg: a.arg ?? null }
    case 'tick':
      return { ...s, todayTs: startOfDay(new Date()).getTime() }

    // P0-4: el objetivo configura SOLO las medidas; nunca precarga un producto
    case 'pickGoal':
      return {
        ...s,
        curGoal: a.cat,
        selectedMeasures: [...(MEASURES_BY[a.cat] ?? MEASURES_BY.Explorar)],
      }

    case 'setProtocol': {
      // crea el protocolo del producto si no existe y lo deja como activo
      const existing = s.protocols[a.product]
      const fp = existing ?? freshProtocol(a.product, s.todayTs)
      if (!fp) return s
      return syncActive({ ...s, protocols: { ...s.protocols, [a.product]: fp }, activeProduct: a.product })
    }

    case 'setActiveProduct':
      return s.protocols[a.product] ? syncActive({ ...s, activeProduct: a.product }) : s

    case 'setProgresoView':
      return { ...s, progresoView: a.view }

    case 'water': {
      const k = isoKey(s.todayTs)
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      return { ...s, nutrition: { ...s.nutrition, [k]: { ...cur, water: Math.max(0, cur.water + a.delta) } } }
    }
    case 'addMeal': {
      if (!(a.kcal > 0)) return s
      const k = isoKey(s.todayTs)
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      const meal: Meal = {
        id: genId(), kcal: Math.round(a.kcal), ts: a.ts ?? Date.now(),
        protein: a.protein ?? null, carbs: a.carbs ?? null, fat: a.fat ?? null, label: a.label?.trim() || null, portion: 1,
      }
      const slot = mealSlot(meal.ts)
      // guardar como favorito (fusiona por etiqueta) si se pidió + aprende la franja horaria
      let foodLibrary = s.foodLibrary
      if (a.fav && meal.label) {
        const i = foodLibrary.findIndex((f) => f.label.toLowerCase() === meal.label!.toLowerCase())
        if (i >= 0) {
          foodLibrary = foodLibrary.map((f, j) => (j === i ? { ...f, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, usoCount: f.usoCount + 1, hourBucket: { ...(f.hourBucket ?? {}), [slot]: (f.hourBucket?.[slot] ?? 0) + 1 } } : f))
        } else {
          foodLibrary = [{ id: genId(), label: meal.label, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, usoCount: 1, hourBucket: { [slot]: 1 }, defaultMultiplier: 1 }, ...foodLibrary]
        }
      }
      return { ...s, nutrition: { ...s.nutrition, [k]: { ...cur, meals: [meal, ...cur.meals] } }, foodLibrary, lastMealTs: meal.ts }
    }
    case 'addFavMeal': {
      const fav = s.foodLibrary.find((f) => f.id === a.id)
      if (!fav) return s
      const por = a.portion && a.portion > 0 ? a.portion : (fav.defaultMultiplier && fav.defaultMultiplier > 0 ? fav.defaultMultiplier : 1)
      const sc = (v: number | null | undefined) => (v != null ? Math.round(v * por) : null)
      const k = isoKey(s.todayTs)
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      const meal: Meal = {
        id: genId(), kcal: Math.round(fav.kcal * por), ts: a.ts ?? Date.now(),
        protein: sc(fav.protein), carbs: sc(fav.carbs), fat: sc(fav.fat),
        label: por !== 1 ? `${fav.label} ×${por}` : fav.label, portion: por, favId: fav.id,
      }
      const slot = mealSlot(meal.ts)
      // aprende: cuenta uso, franja horaria y porción por defecto
      const foodLibrary = s.foodLibrary.map((f) => (f.id === a.id
        ? { ...f, usoCount: f.usoCount + 1, hourBucket: { ...(f.hourBucket ?? {}), [slot]: (f.hourBucket?.[slot] ?? 0) + 1 }, defaultMultiplier: por }
        : f))
      return { ...s, nutrition: { ...s.nutrition, [k]: { ...cur, meals: [meal, ...cur.meals] } }, foodLibrary, lastMealTs: meal.ts }
    }
    case 'copyYesterday': {
      const k = isoKey(s.todayTs)
      const yd = new Date(s.todayTs); yd.setDate(yd.getDate() - 1)
      const y = s.nutrition[isoKey(yd.getTime())]
      if (!y || y.meals.length === 0) return s
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      const now = Date.now()
      const copied: Meal[] = y.meals.map((m, i) => ({ ...m, id: genId(), ts: now - i }))
      return { ...s, nutrition: { ...s.nutrition, [k]: { ...cur, meals: [...copied, ...cur.meals] } }, lastMealTs: now }
    }
    case 'delMeal': {
      const nutrition: AppState['nutrition'] = {}
      for (const [k, v] of Object.entries(s.nutrition)) nutrition[k] = { ...v, meals: v.meals.filter((m) => m.id !== a.id) }
      return { ...s, nutrition }
    }
    case 'delFav':
      return { ...s, foodLibrary: s.foodLibrary.filter((f) => f.id !== a.id) }
    case 'editFav':
      return { ...s, foodLibrary: s.foodLibrary.map((f) => (f.id === a.id ? { ...f, ...a.patch } : f)) }
    case 'setMacroGoals':
      return { ...s, macroGoals: a.goals }
    case 'setKcalGoal':
      return { ...s, kcalGoal: a.value && a.value > 0 ? Math.round(a.value) : null }

    case 'deleteProduct': {
      // quita el producto del seguimiento. NO toca s.log → los registros pasados se conservan.
      if (!s.protocols[a.product]) return s
      const protocols = { ...s.protocols }
      delete protocols[a.product]
      const activeProduct = s.activeProduct === a.product ? (Object.keys(protocols)[0] ?? null) : s.activeProduct
      return syncActive({ ...s, protocols, activeProduct })
    }

    // P0-3: la cadencia editada por el usuario es la fuente de verdad (protocolo activo)
    case 'setCadence':
      return s.activeProduct && s.protocols[s.activeProduct]
        ? syncActive({ ...s, protocols: { ...s.protocols, [s.activeProduct]: { ...s.protocols[s.activeProduct], cadence: a.cadence } } })
        : s

    // tunear el protocolo en foco de edición (cadencia, fases, fechas, etc.)
    case 'updateProtocol':
      return s.activeProduct && s.protocols[s.activeProduct]
        ? syncActive({ ...s, protocols: { ...s.protocols, [s.activeProduct]: { ...s.protocols[s.activeProduct], ...a.patch } } })
        : s

    // tunear un producto específico (p.ej. navegar fases de titulación de ESE producto)
    case 'updateProtocolFor':
      return s.protocols[a.product]
        ? syncActive({ ...s, protocols: { ...s.protocols, [a.product]: { ...s.protocols[a.product], ...a.patch } } })
        : s

    case 'importProducts': {
      // fusiona (no reemplaza) — crea un protocolo por cada producto nuevo del catálogo
      const protocols = { ...s.protocols }
      for (const name of a.names.filter((n) => n in PEPTIDES)) {
        if (!protocols[name]) {
          const fp = freshProtocol(name, s.todayTs)
          if (fp) protocols[name] = fp
        }
      }
      const activeProduct = s.activeProduct ?? Object.keys(protocols)[0] ?? null
      return syncActive({ ...s, protocols, activeProduct })
    }

    // P0-1: la dosis tecleada ENTRA al diario; activa dashboard; suma racha. Respeta la hora elegida.
    case 'logDose': {
      const now = a.ts ? new Date(a.ts) : new Date()
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: 'Dosis registrada',
        u: a.product + (a.value ? ` · ${a.value} ${a.unit}` : ''),
        cat: '#1B8A7D',
        ic: 'dose',
        type: 'dose',
        ts: now.getTime(),
        product: a.product,
        doseMg: a.doseMg, // mg canónicos (para vida media/presencia); undefined si no se pudo convertir
      }
      return {
        ...s,
        log: prependToLog(s.log, item),
        // recuerda la dosis tecleada por producto (alimenta "tus dosis de hoy")
        productDoses: a.value != null ? { ...s.productDoses, [a.product]: { value: a.value, unit: a.unit } } : s.productDoses,
        // recuerda la reconstitución del producto (para pre-llenar y para "hecho hoy" en UI/mL)
        productRecon: a.recon ? { ...s.productRecon, [a.product]: a.recon } : s.productRecon,
        logged: true,
        sheet: null,
        toast: 'Dosis registrada',
        toastUndoId: item.id, // permite "Deshacer" desde el toast
      }
    }

    // P0-1 + P1-5: las medidas también entran al diario y activan el dashboard
    case 'saveMeasure': {
      const now = a.ts ? new Date(a.ts) : new Date()
      const ic = MEASURE_ICON[a.name] ?? { icon: 'medidas', cat: '#5FC9B8' }
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: a.name,
        u: fmtMeasureValue(a.name, a.value) + (a.nota ? ' · ' + a.nota : ''),
        cat: ic.cat,
        ic: ic.icon,
        type: 'medida',
        ts: now.getTime(),
      }
      const meta = MEASURE_META[a.name]
      const profile = { ...s.profile }
      if (meta?.prof) {
        profile[meta.prof] = a.value as never
        if (profile.peso != null && profile.est != null) profile.bmi = bmiCalc(profile.peso, profile.est)
      }
      return {
        ...s,
        log: prependToLog(s.log, item),
        measureValues: { ...s.measureValues, [a.name]: a.value },
        history: pushHistory(s.history, [{ name: a.name, value: a.value, ts: now.getTime() }]),
        profile,
        logged: true,
        sheet: null,
        toast: 'Medida registrada',
        toastUndoId: null,
      }
    }

    // KPI "Cambio de medidas": guarda peso/altura/grasa/músculo en el perfil + IMC, historial y diario
    case 'saveMedidas': {
      const now = a.ts ? new Date(a.ts) : new Date()
      const profile = { ...s.profile, ...a.values }
      if (profile.peso != null && profile.est != null) profile.bmi = bmiCalc(profile.peso, profile.est)
      const ts = now.getTime()
      const samples: { name: string; value: number; ts: number }[] = []
      const mv: Record<string, number> = { ...s.measureValues }
      if (a.values.peso != null) { samples.push({ name: 'Peso', value: a.values.peso, ts }); mv['Peso'] = a.values.peso }
      if (a.values.est != null) { samples.push({ name: 'Altura', value: a.values.est, ts }); mv['Altura'] = a.values.est }
      if (a.values.grasa != null) { samples.push({ name: '% grasa', value: a.values.grasa, ts }); mv['% grasa'] = a.values.grasa }
      if (a.values.musculo != null) { samples.push({ name: '% músculo', value: a.values.musculo, ts }); mv['% músculo'] = a.values.musculo }
      if (profile.bmi != null) { samples.push({ name: 'IMC', value: profile.bmi, ts }); mv['IMC'] = profile.bmi }

      const parts: string[] = []
      if (a.values.peso != null) parts.push(`${a.values.peso} kg`)
      if (profile.bmi != null) parts.push(`IMC ${profile.bmi}`)
      if (a.values.grasa != null) parts.push(`${a.values.grasa}% grasa`)
      if (a.values.musculo != null) parts.push(`${a.values.musculo}% músculo`)

      const item: LogItem = {
        id: genId(), t: fmtTime(now), n: 'Cambio de medidas', u: parts.join(' · ') || 'actualizado',
        cat: '#1B8A7D', ic: 'medidas', type: 'medida', ts,
      }
      return {
        ...s,
        log: prependToLog(s.log, item),
        history: pushHistory(s.history, samples),
        measureValues: mv,
        profile,
        logged: true,
        sheet: null,
        toast: 'Medidas actualizadas',
        toastUndoId: null,
      }
    }

    // P1-1: borrar un registro de verdad + reconciliar history/measureValues
    case 'deleteLog': {
      let deleted: LogItem | undefined
      for (const g of s.log) { const it = g.items.find((i) => i.id === a.id); if (it) { deleted = it; break } }
      const log = s.log
        .map((g) => ({ ...g, items: g.items.filter((it) => it.id !== a.id) }))
        .filter((g) => g.items.length > 0)
      let history = s.history
      if (deleted?.type === 'medida') {
        history = {}
        for (const k of Object.keys(s.history)) history[k] = s.history[k].filter((sm) => sm.ts !== deleted!.ts)
      }
      return { ...s, log, history, logged: log.length > 0, sheet: null, toastUndoId: null }
    }

    case 'setSetting':
      return { ...s, settings: { ...s.settings, [a.key]: a.value } }
    case 'setName':
      return { ...s, profile: { ...s.profile, name: a.name.trim() || null } }
    case 'setProfileFields':
      return { ...s, profile: { ...s.profile, ...a.patch } }
    case 'setReminderTime': {
      // hora global de recordatorio: se aplica a TODOS los productos (todos están activos)
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) return s
      const protocols: Record<string, UserProtocol> = {}
      for (const [name, p] of Object.entries(s.protocols)) protocols[name] = { ...p, reminderTime: a.time }
      return syncActive({ ...s, protocols })
    }
    case 'setScale':
      return { ...s, scale: a.scale }
    case 'setDraftDose':
      return { ...s, draftDose: a.draft }

    // P0-5: Cancelación ARCO / borrar cuenta — borra datos de verdad y reinicia
    case 'arcoDelete':
      return {
        ...initialState,
        todayTs: startOfDay(new Date()).getTime(),
        screen: 's-onboarding',
        settings: { ...initialState.settings, consentActive: false },
        toast: 'Tus datos fueron borrados.',
      }

    // P1-7: reinicio total de estado (logout / rehacer onboarding)
    case 'reset':
      return { ...initialState, todayTs: startOfDay(new Date()).getTime(), screen: 's-onboarding' }

    case 'toast':
      return { ...s, toast: a.msg, toastUndoId: null } // un toast normal no trae acción de deshacer

    default:
      return s
  }
}

// próxima toma según la cadencia del usuario (P1-2)
export function nextDose(s: AppState): Date | null {
  if (!s.protocol) return null
  const start = new Date(s.protocol.startDate)
  let d = startOfDay(new Date(s.todayTs))
  for (let i = 0; i < 60; i++) {
    if (diaTocaCadence(d, s.protocol.cadence, start)) return d
    d = new Date(d.getTime() + 86400000)
  }
  return null
}

// adherencia REAL, MULTI-PRODUCTO. Recorre TODOS los productos trackeados (protocolo + importados),
// cuenta cada dosis que tocaría según su cadencia y respeta fecha de inicio/fin de cada uno.
// Clasifica cada dosis programada en: tomada / perdida (ya venció, sin registro) / próxima (futura).
// El % se calcula solo sobre las vencidas (no penaliza futuras) — fix red-team.
export interface AdherenceStat {
  pct: number       // taken / due (cumplimiento de lo que ya venció)
  taken: number     // dosis registradas
  missed: number    // vencidas sin registrar
  upcoming: number  // futuras (aún no vencen)
  due: number       // taken + missed (vencidas)
  scheduled: number // total programado en la ventana (due + upcoming)
  // compat: algunos consumidores leían .scheduled como denominador "registrado"
}

interface DoseTally { taken: number; missed: number; upcoming: number }

// núcleo: cuenta dosis de todos los productos en [fromMs, toMs] (días, inclusive)
function tallyDoses(s: AppState, fromMs: number, toMs: number, now: Date): DoseTally {
  const tracked = trackedProtocols(s)
  const today = startOfDay(new Date(s.todayTs))
  const todayKey = isoKey(today.getTime())

  const todayMs = today.getTime()
  const fromDay = startOfDay(new Date(fromMs)).getTime()
  const toDay = startOfDay(new Date(toMs)).getTime()

  let taken = 0, missed = 0, upcoming = 0
  for (const t of tracked) {
    const tStart = startOfDay(t.start).getTime()
    const tEnd = t.end != null ? startOfDay(new Date(t.end)).getTime() : null
    // ¿ya venció la toma de HOY de ESTE producto? (cada producto tiene su propia hora)
    const [hh, mm] = (t.reminderTime ?? '08:00').split(':').map(Number)
    const reminderToday = new Date(today)
    reminderToday.setHours(hh || 0, mm || 0, 0, 0)
    const todayPassed = now.getTime() >= reminderToday.getTime()
    // iterar por DÍA LOCAL (robusto a horario de verano; no sumar 86_400_000 fijo)
    for (let d = new Date(fromDay); d.getTime() <= toDay; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const ms = d.getTime()
      if (ms < tStart) continue
      if (tEnd != null && ms > tEnd) continue // fin INCLUSIVE (último día cuenta)
      if (!diaTocaCadence(d, t.cadence, new Date(tStart))) continue
      const dKey = isoKey(ms)
      const g = s.log.find((x) => x.dateKey === dKey)
      const took = !!g?.items.some((it) => it.type === 'dose' && it.product === t.product)
      const past = dKey === todayKey ? todayPassed : ms < todayMs
      if (took) taken++
      else if (past) missed++
      else upcoming++
    }
  }
  return { taken, missed, upcoming }
}

function toStat(t: DoseTally): AdherenceStat | null {
  const due = t.taken + t.missed
  const scheduled = due + t.upcoming
  if (scheduled === 0) return null
  return { pct: due === 0 ? 100 : Math.round((t.taken / due) * 100), taken: t.taken, missed: t.missed, upcoming: t.upcoming, due, scheduled }
}

// ventana rodante de N días terminando hoy (para Progreso)
export function adherence(s: AppState, days = 30, now: Date = new Date()): AdherenceStat | null {
  if (!s.protocol) return null
  const today = startOfDay(new Date(s.todayTs)).getTime()
  return toStat(tallyDoses(s, today - (days - 1) * 86400000, today, now))
}

// mes calendario actual: TODAS las dosis que tocarían en el mes (incl. futuras) — para Inicio
export function adherenceMonth(s: AppState, now: Date = new Date()): AdherenceStat | null {
  if (!s.protocol) return null
  const today = startOfDay(new Date(s.todayTs))
  const from = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).getTime()
  return toStat(tallyDoses(s, from, to, now))
}

// próxima toma como fecha+hora (usa reminderTime); requiere el "ahora" real para la cuenta regresiva
export function nextDoseAt(s: AppState, now: Date): Date | null {
  if (!s.protocol) return null
  const start = new Date(s.protocol.startDate)
  const [hh, mm] = (s.protocol.reminderTime ?? '08:00').split(':').map(Number)
  let d = startOfDay(now)
  for (let i = 0; i < 60; i++) {
    if (diaTocaCadence(d, s.protocol.cadence, start)) {
      const at = new Date(d)
      at.setHours(hh || 0, mm || 0, 0, 0)
      if (at.getTime() > now.getTime()) return at
    }
    d = new Date(d.getTime() + 86400000)
  }
  return null
}

// dosis a usar para un producto en "hecho hoy": la de su fase activa, o la recordada del último registro
export function doseForProduct(s: AppState, product: string): { value: number; unit: string } | null {
  const p = s.protocols[product]
  if (p && p.progOn) {
    const phaseDose = p.phaseDoses?.[p.curPhase]
    if (phaseDose != null) return { value: phaseDose, unit: 'mg' }
  }
  return s.productDoses[product] ?? null
}

// productos a trackear con su cadencia, para el calendario/adherencia dinámicos.
// Cada producto tiene su PROPIO protocolo editable (cadencia, inicio/fin, hora, fases).
export interface Tracked { product: string; cadence: UserCadence; start: Date; end: number | null; reminderTime: string }
export function trackedProtocols(s: AppState): Tracked[] {
  return Object.values(s.protocols).map((p) => ({
    product: p.product,
    cadence: p.cadence,
    start: new Date(p.startDate),
    end: p.endDate ?? null,
    reminderTime: p.reminderTime ?? '08:00',
  }))
}

// qué productos tocan un día dado (calendario dinámico) — respeta inicio y fin del protocolo
export function productsOnDay(d: Date, tracked: Tracked[]): string[] {
  const dayMs = startOfDay(d).getTime()
  return tracked
    .filter((t) => dayMs >= startOfDay(t.start).getTime())
    .filter((t) => t.end == null || dayMs <= startOfDay(new Date(t.end)).getTime())
    .filter((t) => diaTocaCadence(d, t.cadence, t.start))
    .map((t) => t.product)
}

// ── Context ──────────────────────────────────────────────────────────────────
export interface AppCtx {
  state: AppState
  dispatch: (a: Action) => void
}
export const AppContext = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
