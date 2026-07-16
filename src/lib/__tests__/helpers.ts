// Utilidades compartidas de los tests golden (no es archivo de test: vitest solo colecta *.test.ts).
// Todo timestamp es fijo y se construye con el constructor LOCAL (new Date(y, m, d)) — nunca strings
// ISO 'YYYY-MM-DD' (parsean como UTC y corren un día bajo TZ negativas como Tijuana).
import { initialState, reducer, syncActive, type Action, type AppState } from '../store'
import type { LogItem, UserCadence, UserProtocol } from '../types'

export const DAY_MS = 86_400_000
export const H_MS = 3_600_000

// mes 1-based (junio = 6) para que las fechas de los tests se lean como en los comentarios
export const d = (y: number, m: number, day: number, h = 0, min = 0, s = 0): Date =>
  new Date(y, m - 1, day, h, min, s)
export const ts = (y: number, m: number, day: number, h = 0, min = 0, s = 0): number =>
  d(y, m, day, h, min, s).getTime()

const ALL_DAYS = [true, true, true, true, true, true, true]
const MONDAY_ONLY = [true, false, false, false, false, false, false]
// orden WDS: L Ma Mi J V S D
export const TUESDAY_ONLY = [false, true, false, false, false, false, false]
export const LV_DAYS = [true, true, true, true, true, false, false]

export function cad(partial: Partial<UserCadence> & { mode: UserCadence['mode'] }): UserCadence {
  return { days: [...ALL_DAYS], every: 1, semDays: [...MONDAY_ONLY], ...partial }
}

export function mkProtocol(
  product: string,
  startDate: number,
  cadence: UserCadence,
  extra: Partial<UserProtocol> = {},
): UserProtocol {
  return { product, cadence, progOn: false, progN: 2, curPhase: 0, startDate, endDate: null, reminderTime: '08:00', ...extra }
}

// Estado base determinista: pisa el todayTs impuro de initialState (Date.now() en carga de módulo)
// y sincroniza los cachés protocol/importedProducts igual que el provider.
export function mkState(overrides: Partial<AppState> = {}): AppState {
  return syncActive({ ...initialState, todayTs: ts(2026, 6, 10), screen: 's-app', ...overrides })
}

export function dispatch(s: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, s)
}

export function doseAction(
  product: string,
  when: number,
  value: number | null = 1,
  unit = 'mg',
  extra: Partial<Extract<Action, { t: 'logDose' }>> = {},
): Action {
  return { t: 'logDose', product, value, unit, ts: when, ...extra }
}

export function findItem(s: AppState, pred: (it: LogItem) => boolean): LogItem {
  for (const g of s.log) {
    const it = g.items.find(pred)
    if (it) return it
  }
  throw new Error('item no encontrado en el log')
}

// LogItem de dosis "a mano" (para casos que necesitan controlar `u` o la ausencia de doseMg,
// que el reducer siempre completa). Estructura idéntica a la que produce logDose.
export function mkDoseItem(product: string, u: string, when: number, extra: Partial<LogItem> = {}): LogItem {
  return { id: `it_test_${when}`, t: '9:00 AM', n: 'Dosis registrada', u, cat: '#1B8A7D', ic: 'dose', type: 'dose', ts: when, product, ...extra }
}
