// Hacktrack — store central (Context + reducer). Implementa los fixes P0 del audit.
import { createContext, useContext } from 'react'
import type {
  Category, LogGroup, LogItem, Profile, UserCadence, UserProtocol, UserSettings, SyringeScale,
} from './types'
import { PEPTIDES, MEASURES_BY, MEASURE_META, MEASURE_ICON } from './catalog'
import { presetCad, diaTocaCadence, dayLabel, fmtTime, startOfDay, weekStrip } from './cadence'

export type ScreenId =
  | 's-splash' | 's-onboarding' | 's-goal' | 's-account' | 's-import' | 's-app'
export type TabId = 'inicio' | 'diario' | 'protocolo' | 'ajustes'
export type SheetId =
  | 'registrar' | 'calc' | 'medida' | 'arco' | 'confirm-delete' | 'perfil' | 'paywall' | 'protocolo-edit'

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
  settings: UserSettings

  logged: boolean              // pasó el primer registro (P1-5 / P1-7)
  scale: SyringeScale          // escala de jeringa de la calculadora (P0-6)
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
  profile: { peso: null, est: null, grasa: null, bmi: null },
  measureValues: {},
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
  toast: null,
}

export type Action =
  | { t: 'go'; screen: ScreenId }
  | { t: 'tab'; tab: TabId }
  | { t: 'sheet'; sheet: SheetId | null; arg?: string | null }
  | { t: 'pickGoal'; cat: Category }                                   // P0-4
  | { t: 'setProtocol'; product: string }
  | { t: 'setCadence'; cadence: UserCadence }                          // P0-3
  | { t: 'updateProtocol'; patch: Partial<UserProtocol> }             // editar protocolo (tunear)
  | { t: 'importProducts'; names: string[] }
  | { t: 'logDose'; product: string; value: number | null; unit: string } // P0-1
  | { t: 'saveMeasure'; name: string; value: number }                 // P0-1
  | { t: 'deleteLog'; id: string }                                    // P1-1
  | { t: 'setSetting'; key: keyof UserSettings; value: boolean | string }
  | { t: 'setScale'; scale: SyringeScale }
  | { t: 'arcoDelete' }                                               // P0-5
  | { t: 'reset' }                                                    // P1-7
  | { t: 'toast'; msg: string | null }

// ── helpers ────────────────────────────────────────────────────────────────────
let _seq = 0
const genId = () => `it_${Date.now().toString(36)}_${_seq++}`

function prependToLog(log: LogGroup[], label: string, range: number, item: LogItem): LogGroup[] {
  const idx = log.findIndex((g) => g.day === label)
  if (idx === -1) return [{ day: label, range, items: [item] }, ...log]
  const next = log.slice()
  next[idx] = { ...next[idx], items: [item, ...next[idx].items] }
  return next
}

// P0-2: racha = días consecutivos (desde hoy hacia atrás) con al menos una dosis registrada
export function computeStreak(log: LogGroup[], today: Date): number {
  let count = 0
  let d = startOfDay(today)
  for (;;) {
    const label = dayLabel(d, today)
    const group = log.find((g) => g.day === label)
    const hasDose = group?.items.some((it) => it.type === 'dose')
    if (!hasDose) break
    count++
    d = new Date(d.getTime() - 86400000)
  }
  return count
}

// estado on/off de la tira semanal (cualquier registro ese día)
export function weekStatus(log: LogGroup[], today: Date): boolean[] {
  return weekStrip(today).map((d) => {
    const label = dayLabel(d, today)
    const group = log.find((g) => g.day === label)
    return !!group && group.items.length > 0
  })
}

export const STREAK_GOAL = 30

function fmtMeasureValue(name: string, v: number): string {
  const meta = MEASURE_META[name] ?? { kind: 'scale', max: 5 }
  return meta.kind === 'scale' ? `${v} / ${meta.max}` : `${v}${meta.unit ? ' ' + meta.unit : ''}`
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

    // P0-4: el objetivo configura SOLO las medidas; nunca precarga un producto
    case 'pickGoal':
      return {
        ...s,
        curGoal: a.cat,
        selectedMeasures: [...(MEASURES_BY[a.cat] ?? MEASURES_BY.Explorar)],
      }

    case 'setProtocol': {
      const entry = PEPTIDES[a.product]
      if (!entry) return s
      const protocol: UserProtocol = {
        product: a.product,
        cadence: presetCad(entry),
        progOn: false,
        progN: entry.phases ?? 2,
        curPhase: 0,
        startDate: startOfDay(new Date(s.todayTs)).getTime(),
      }
      // el producto puede afinar las medidas mostradas, pero no cambia el objetivo del usuario
      return { ...s, protocol }
    }

    // P0-3: la cadencia editada por el usuario es la fuente de verdad
    case 'setCadence':
      return s.protocol ? { ...s, protocol: { ...s.protocol, cadence: a.cadence } } : s

    // tunear el protocolo (cadencia, fases, etc.) — punto 4
    case 'updateProtocol':
      return s.protocol ? { ...s, protocol: { ...s.protocol, ...a.patch } } : s

    case 'importProducts': {
      const products = a.names.filter((n) => n in PEPTIDES)
      const first = products[0]
      let protocol = s.protocol
      if (!protocol && first) {
        protocol = {
          product: first,
          cadence: presetCad(PEPTIDES[first]),
          progOn: false,
          progN: PEPTIDES[first].phases ?? 2,
          curPhase: 0,
          startDate: startOfDay(new Date(s.todayTs)).getTime(),
        }
      }
      return { ...s, importedProducts: products, protocol }
    }

    // P0-1: la dosis tecleada ENTRA al diario; activa dashboard; suma racha
    case 'logDose': {
      const now = new Date()
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
      return {
        ...s,
        log: prependToLog(s.log, 'Hoy', 7, item),
        logged: true,
        sheet: null,
        toast: 'Registro guardado 🎉',
      }
    }

    // P0-1 + P1-5: las medidas también entran al diario y activan el dashboard
    case 'saveMeasure': {
      const now = new Date()
      const ic = MEASURE_ICON[a.name] ?? { ic: '•', cat: '#5FC9B8' }
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: a.name,
        u: fmtMeasureValue(a.name, a.value),
        cat: ic.cat,
        ic: ic.ic,
        type: 'medida',
        ts: now.getTime(),
      }
      const meta = MEASURE_META[a.name]
      const profile = { ...s.profile }
      if (meta?.prof) {
        profile[meta.prof] = a.value as never
        if (profile.peso != null && profile.est != null) {
          const m = profile.est > 3 ? profile.est / 100 : profile.est
          const v = profile.peso / (m * m)
          profile.bmi = v > 0 && v < 150 ? Math.round(v * 10) / 10 : null
        }
      }
      return {
        ...s,
        log: prependToLog(s.log, 'Hoy', 7, item),
        measureValues: { ...s.measureValues, [a.name]: a.value },
        profile,
        logged: true,
        sheet: null,
        toast: 'Medida registrada',
      }
    }

    // P1-1: borrar un registro de verdad
    case 'deleteLog': {
      const log = s.log
        .map((g) => ({ ...g, items: g.items.filter((it) => it.id !== a.id) }))
        .filter((g) => g.items.length > 0)
      return { ...s, log, sheet: null }
    }

    case 'setSetting':
      return { ...s, settings: { ...s.settings, [a.key]: a.value } }
    case 'setScale':
      return { ...s, scale: a.scale }

    // P0-5: Cancelación ARCO / borrar cuenta — borra datos de verdad y reinicia
    case 'arcoDelete':
      return {
        ...initialState,
        todayTs: s.todayTs,
        screen: 's-onboarding',
        settings: { ...initialState.settings, consentActive: false },
        toast: 'Tus datos fueron borrados.',
      }

    // P1-7: reinicio total de estado (logout / rehacer onboarding)
    case 'reset':
      return { ...initialState, todayTs: s.todayTs, screen: 's-onboarding' }

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
