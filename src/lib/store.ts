// Hacktrack — store central (Context + reducer). Implementa los fixes P0 + endurecimiento del audit.
import { createContext, useContext } from 'react'
import type {
  Category, LogGroup, LogItem, Profile, UserCadence, UserProtocol, UserSettings, SyringeScale, MeasureSample,
} from './types'
import { PEPTIDES, MEASURES_BY, MEASURE_META, MEASURE_ICON } from './catalog'
import { presetCad, diaTocaCadence, fmtTime, startOfDay, weekStrip } from './cadence'
import { bmiCalc } from './bmi'

export type ScreenId =
  | 's-splash' | 's-onboarding' | 's-goal' | 's-account' | 's-login' | 's-import' | 's-app'
export type TabId = 'inicio' | 'diario' | 'protocolo' | 'ajustes'
export type SheetId =
  | 'registrar' | 'calc' | 'medida' | 'medidas' | 'agregar'
  | 'arco' | 'confirm-delete' | 'perfil' | 'paywall' | 'protocolo-edit'

export interface AppState {
  todayTs: number
  screen: ScreenId
  tab: TabId
  sheet: SheetId | null
  sheetArg: string | null      // p.ej. id de log a borrar, o producto

  curGoal: Category | null
  selectedMeasures: string[]
  protocol: UserProtocol | null
  importedProducts: string[]

  log: LogGroup[]
  profile: Profile
  measureValues: Record<string, number>
  history: Record<string, MeasureSample[]>   // serie temporal por KPI/medida (dashboard)
  settings: UserSettings

  logged: boolean              // pasó el primer registro (P1-5 / P1-7)
  scale: SyringeScale          // escala de jeringa de la calculadora (P0-6)
  draftDose: { value: number; unit: string } | null  // "copiar a mi registro" desde la calc
  toast: string | null
}

export const initialState: AppState = {
  todayTs: Date.now(),
  screen: 's-splash',
  tab: 'inicio',
  sheet: null,
  sheetArg: null,
  curGoal: null,
  selectedMeasures: [],
  protocol: null,
  importedProducts: [],
  log: [],                     // vacío para usuario nuevo (P0-2: racha honesta)
  profile: { peso: null, est: null, grasa: null, musculo: null, bmi: null },
  measureValues: {},
  history: {},
  settings: {
    pinEnabled: false,
    darkMode: false,
    weeklySummary: true,
    emailNotices: false,
    consentVersion: 'v1.0',
    consentActive: true,
  },
  logged: false,
  scale: 100,
  draftDose: null,
  toast: null,
}

export type Action =
  | { t: 'go'; screen: ScreenId }
  | { t: 'tab'; tab: TabId }
  | { t: 'sheet'; sheet: SheetId | null; arg?: string | null }
  | { t: 'tick' }                                                     // refresca todayTs (medianoche)
  | { t: 'pickGoal'; cat: Category }                                   // P0-4
  | { t: 'setProtocol'; product: string }
  | { t: 'setCadence'; cadence: UserCadence }                          // P0-3
  | { t: 'updateProtocol'; patch: Partial<UserProtocol> }             // editar protocolo (tunear)
  | { t: 'importProducts'; names: string[] }
  | { t: 'logDose'; product: string; value: number | null; unit: string; ts?: number } // P0-1
  | { t: 'saveMeasure'; name: string; value: number; nota?: string; ts?: number }  // P0-1
  | { t: 'saveMedidas'; values: Partial<Pick<Profile, 'peso' | 'est' | 'grasa' | 'musculo'>>; ts?: number } // KPI compuesto
  | { t: 'deleteLog'; id: string }                                    // P1-1
  | { t: 'setSetting'; key: keyof UserSettings; value: boolean | string }
  | { t: 'setScale'; scale: SyringeScale }
  | { t: 'setDraftDose'; draft: { value: number; unit: string } | null }
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

// estado on/off de la tira semanal (cualquier registro ese día) — por clave de fecha
export function weekStatus(log: LogGroup[], today: Date): boolean[] {
  return weekStrip(today).map((d) => {
    const g = log.find((x) => x.dateKey === isoKey(d.getTime()))
    return !!g && g.items.length > 0
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
  }
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
      const protocol = freshProtocol(a.product, s.todayTs)
      return protocol ? { ...s, protocol } : s
    }

    // P0-3: la cadencia editada por el usuario es la fuente de verdad
    case 'setCadence':
      return s.protocol ? { ...s, protocol: { ...s.protocol, cadence: a.cadence } } : s

    // tunear el protocolo (cadencia, fases, etc.)
    case 'updateProtocol':
      return s.protocol ? { ...s, protocol: { ...s.protocol, ...a.patch } } : s

    case 'importProducts': {
      // fusiona (no reemplaza) — fix red-team
      const products = [...new Set([...s.importedProducts, ...a.names.filter((n) => n in PEPTIDES)])]
      const protocol = s.protocol ?? (products[0] ? freshProtocol(products[0], s.todayTs) : null)
      return { ...s, importedProducts: products, protocol }
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
        ic: '💉',
        type: 'dose',
        ts: now.getTime(),
      }
      return { ...s, log: prependToLog(s.log, item), logged: true, sheet: null, toast: 'Registro guardado 🎉' }
    }

    // P0-1 + P1-5: las medidas también entran al diario y activan el dashboard
    case 'saveMeasure': {
      const now = a.ts ? new Date(a.ts) : new Date()
      const ic = MEASURE_ICON[a.name] ?? { ic: '•', cat: '#5FC9B8' }
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: a.name,
        u: fmtMeasureValue(a.name, a.value) + (a.nota ? ' · ' + a.nota : ''),
        cat: ic.cat,
        ic: ic.ic,
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
        cat: '#1B8A7D', ic: '📐', type: 'medida', ts,
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
      return { ...s, log, history, logged: log.length > 0, sheet: null }
    }

    case 'setSetting':
      return { ...s, settings: { ...s.settings, [a.key]: a.value } }
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
      return { ...s, toast: a.msg }

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

// productos a trackear con su cadencia, para el calendario dinámico:
// el protocolo activo usa la cadencia del usuario; los demás importados usan la del catálogo.
export interface Tracked { product: string; cadence: UserCadence; start: Date }
export function trackedProtocols(s: AppState): Tracked[] {
  const out: Tracked[] = []
  const seen = new Set<string>()
  const start = s.protocol ? new Date(s.protocol.startDate) : startOfDay(new Date(s.todayTs))
  if (s.protocol) {
    out.push({ product: s.protocol.product, cadence: s.protocol.cadence, start })
    seen.add(s.protocol.product)
  }
  for (const p of s.importedProducts) {
    if (seen.has(p) || !(p in PEPTIDES)) continue
    out.push({ product: p, cadence: presetCad(PEPTIDES[p]), start })
    seen.add(p)
  }
  return out
}

// qué productos tocan un día dado (calendario dinámico)
export function productsOnDay(d: Date, tracked: Tracked[]): string[] {
  return tracked.filter((t) => diaTocaCadence(d, t.cadence, t.start)).map((t) => t.product)
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
