// Hacktrack — store central (Context + reducer). Implementa los fixes P0 + endurecimiento del audit.
import { createContext, useContext } from 'react'
import type {
  Category, LogGroup, LogItem, Profile, UserCadence, UserProtocol, UserSettings, SyringeScale, MeasureSample, Meal, FoodFav, InjectionSite, ThemeMode, ProductReconEntry,
  SavedRecon, AdverseSeverity, NutritionDay, SyncMeta, Tombstones,
} from './types'
import { PEPTIDES, MEASURES_BY, MEASURE_META, MEASURE_ICON } from './catalog'
import { presetCad, diaTocaCadence, fmtTime, startOfDay, weekStrip } from './cadence'
import { addDays, startOfLocalDay } from './dates'
import { bmiCalc } from './bmi'
import { doseToMg } from './calc'

export type ScreenId =
  | 's-splash' | 's-onboarding' | 's-goal' | 's-baseline' | 's-measures' | 's-protocol' | 's-account' | 's-login' | 's-forgot' | 's-welcome' | 's-import' | 's-app'
export type TabId = 'inicio' | 'diario' | 'protocolo' | 'vida' | 'comida' | 'semana'
export type ProgresoView = 'cal' | 'avances'
export type SheetId =
  | 'registrar' | 'calc' | 'medida' | 'medidas' | 'agregar' | 'day-detail' | 'crear-platillo' | 'recetario'
  | 'arco' | 'confirm-delete' | 'perfil' | 'paywall' | 'protocolo-edit' | 'ajustes' | 'dose-confirm'
  | 'medida-detail'  // item 146: detalle de KPI con historial + botón Registrar
  | 'protocolos'     // rebuild v2: listado/gestión de protocolos (ProtocolosSheet)
  | 'import'         // rebuild v2: asistente de importación de productos (ImportSheet)
  | 'pin-setup'      // backend handoff: crear/cambiar el PIN de bloqueo (PinSetupSheet)

export interface AppState {
  // CONVENCIÓN reloj vs. día: todayTs = IDENTIDAD del día a medianoche LOCAL (agrupación/claves
  // isoKey); new Date()/Date.now() = RELOJ (instante real de un evento). El tick del provider
  // refresca todayTs al cruzar medianoche pero puede rezagarse ~1 min — todo reducer que estampe
  // un ts con el reloj debe derivar la clave del día de ESE mismo instante, nunca de todayTs.
  todayTs: number
  screen: ScreenId
  tab: TabId
  sheet: SheetId | null
  sheetArg: string | null      // p.ej. id de log a borrar, o producto

  curGoal: Category | null
  secondaryGoals: Category[]                 // objetivos adicionales (multi-goal, máx 3 total)
  selectedMeasures: string[]
  localOnly: boolean                         // modo sin cuenta (solo local, sin sync en la nube)
  justOnboarded: boolean                     // pasó el onboarding recién (para Welcome/coachmarks)
  coachmarksSeen: boolean                    // ya vio el tutorial de coachmarks
  returnTo: ScreenId | null                  // deep-link de retorno post-auth
  progresoView: ProgresoView                // segmento activo en Progreso (global, para deep-link desde Inicio)
  protocols: Record<string, UserProtocol>  // FUENTE DE VERDAD: un protocolo editable por producto
  activeProduct: string | null             // producto "primario" (cuenta regresiva en Inicio, etc.)
  protocol: UserProtocol | null            // CACHÉ sincronizado = protocols[activeProduct] (no escribir directo)
  importedProducts: string[]               // CACHÉ = Object.keys(protocols) (lista de productos trackeados)

  log: LogGroup[]
  profile: Profile
  measureValues: Record<string, number>
  history: Record<string, MeasureSample[]>   // serie temporal por KPI/medida (dashboard)
  kpiOrder?: string[]                         // n=146: orden y selección de KPIs mostrados (hasta 4)
  productDoses: Record<string, { value: number; unit: string }>  // dosis recordada por producto (para "hecho hoy")
  productRecon: Record<string, ProductReconEntry> // reconstitución recordada por producto (UI/mL → mg); incluye reconDate opcional
  nutrition: Record<string, NutritionDay>                            // por dateKey: hidratación + comidas (+ mtime de sync del día)
  foodLibrary: FoodFav[]                                              // comidas frecuentes (registro 1-tap)
  macroGoals: { protein: number; carbs: number; fat: number } | null // metas de macros que define el usuario
  kcalGoal: number | null                                            // meta calórica diaria
  lastMealTs: number | null                                          // última comida registrada (chip "repetir")
  settings: UserSettings

  lastInjectionSite: Record<string, InjectionSite> // último sitio de inyección por producto (loop 140)

  logged: boolean              // pasó el primer registro (P1-5 / P1-7)
  scale: SyringeScale          // escala de jeringa de la calculadora (P0-6)
  draftDose: { value?: number; unit?: string; recon?: { vialMg: number; aguaMl: number }; site?: InjectionSite; ts?: number; overdue?: boolean } | null  // precarga de RegistrarSheet: calc (value/unit/recon), sitio del mapa (site), fecha de backfill (ts) o marca de dosis ATRASADA (overdue → pregunta "¿programado o cambio?")
  toast: string | null
  toastUndoId: string | null   // id del log a deshacer desde el toast (ej. dosis recién registrada)
  // buffer para deshacer borrado: el item + las muestras de history removidas (para restaurarlas en undo)
  deletedLogBuffer: { item: LogItem; samples: { name: string; sample: MeasureSample }[] } | null

  // ── Nuevos campos (aditivos, retrocompatibles) ──────────────────────────────
  calcDraft: { vialStr: string; aguaStr: string; dosisStr: string; unit: string; plumaMode?: boolean; clicMgStr?: string } | null  // estado efímero de la calculadora (#73: incluye modo pluma)
  registrarDraft: { dose: string; unit: string; nota: string; showNota: boolean; effect: string | undefined; customEffect: string; showCustomEffect: boolean; effectIntensity: number; site: InjectionSite | null; useNow: boolean; wheelTs: number | null; showTimePicker: boolean } | null  // form de RegistrarSheet parqueado al ir a la Calculadora → se restaura al volver (no perder nota/efecto/hora/sitio)
  savedRecons: SavedRecon[]                       // reconstituciones guardadas por el usuario
  measureGoals: Record<string, number>            // meta por medida (p.ej. { 'Peso': 75 })
  measureReminders: Record<string, number>        // recordatorio de medida: intervalDays por nombre
  productAliases: Record<string, string>          // alias personalizado por producto (p.ej. { 'BPC 157': 'Mi BPC' })
  fastStartTs: number | null                      // epoch ms en que empezó el ayuno activo; null = sin ayuno
  showFirstDoseCelebration: boolean               // dispara la animación de primera dosis
  achievements: string[]                          // ids de logros desbloqueados
  dayNotes: Record<string, string>                // nota diaria por dateKey 'YYYY-MM-DD'

  // ── Metadatos de sync (merge por registro) — opcionales: estados legados no los traen ────────
  syncMeta?: SyncMeta        // mtimes por unidad LWW (profile, settings, goals, mapas por clave…)
  tombstones?: Tombstones    // lápidas de borrado por id/clave (log items, protocolos, recons, favoritos)
}

export const initialState: AppState = {
  todayTs: startOfLocalDay(Date.now()).getTime(), // identidad de día: SIEMPRE medianoche local (no el reloj crudo)
  screen: 's-splash',
  tab: 'inicio',
  sheet: null,
  sheetArg: null,
  curGoal: null,
  secondaryGoals: [],
  selectedMeasures: [],
  localOnly: false,
  justOnboarded: false,
  coachmarksSeen: false,
  returnTo: null,
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
    // Recordatorios ACTIVADOS por default (per-dosis + resumen diario + semanal). El permiso del SO se
    // pide al entrar (NotifPermissionPrompt). El usuario puede ajustarlos/apagarlos en Ajustes.
    remindersEnabled: true,
    dailySummary: true,
    weeklySummary: true,
    emailNotices: false,
    consentVersion: 'v1.0',
    // Consentimiento NO pre-activado: se marca true al crear cuenta (Account.handleCreate, tras aceptar el checkbox).
    consentActive: false,
    premium: false,
  },
  lastInjectionSite: {},
  logged: false,
  scale: 100,
  draftDose: null,
  toast: null,
  toastUndoId: null,
  deletedLogBuffer: null,
  calcDraft: null,
  registrarDraft: null,
  savedRecons: [],
  measureGoals: {},
  measureReminders: {},
  productAliases: {},
  fastStartTs: null,
  showFirstDoseCelebration: false,
  achievements: [],
  dayNotes: {},
}

export type Action =
  | { t: 'go'; screen: ScreenId }
  | { t: 'tab'; tab: TabId }
  | { t: 'sheet'; sheet: SheetId | null; arg?: string | null }
  | { t: 'tick' }                                                     // refresca todayTs (medianoche)
  | { t: 'pickGoal'; cat: Category }                                   // P0-4
  | { t: 'setGoals'; cats: Category[] }                                // multi-goal (primario + secundarios)
  | { t: 'setMeasures'; measures: string[] }                           // selector de métricas (onboarding)
  | { t: 'setBaseline'; peso?: number | null; metaPesoKg?: number | null; est?: number | null } // baseline biométrico
  | { t: 'setLocalOnly'; value: boolean }                              // modo sin cuenta
  | { t: 'finishOnboarding' }                                          // marca justOnboarded + va a s-app
  | { t: 'seenWelcome' }                                               // limpia justOnboarded
  | { t: 'seenCoachmarks' }                                            // marca tutorial visto
  | { t: 'setReturnTo'; screen: ScreenId | null }                     // deep-link de retorno
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
  | { t: 'editMeal'; id: string; patch: { kcal?: number; protein?: number | null; carbs?: number | null; fat?: number | null; label?: string | null; note?: string | null } } // edita una comida registrada
  | { t: 'delFav'; id: string }                                       // elimina un favorito
  | { t: 'editFav'; id: string; patch: Partial<FoodFav> }             // edita un favorito (nombre/kcal/macros)
  | { t: 'createFav'; fav: Omit<FoodFav, 'id' | 'usoCount'> }         // crea un platillo en la biblioteca (sin registrarlo)
  | { t: 'copyYesterday' }                                            // copia las comidas de ayer a hoy
  | { t: 'setMacroGoals'; goals: { protein: number; carbs: number; fat: number } | null } // metas de macros
  | { t: 'setKcalGoal'; value: number | null }                        // meta calórica diaria
  | { t: 'deleteProduct'; product: string }                           // quitar producto (conserva registros pasados)
  | { t: 'importProducts'; names: string[] }
  | { t: 'logDose'; product: string; value: number | null; unit: string; ts?: number; doseMg?: number; recon?: { vialMg: number; aguaMl: number }; site?: InjectionSite; note?: string; effect?: string; effectIntensity?: number; keepSheet?: boolean } // P0-1 + loop 140 + loop 138/139
  | { t: 'setLogEffect'; id: string; effect: string; effectIntensity?: number } // loop 139: guarda efecto post-dosis en un item ya registrado
  // saveMeasure: `value` absoluto O `delta` atómico (exactamente uno). Con delta, la base se lee
  // DENTRO del reducer (última muestra del mismo día del ts estampado) → taps rápidos de un stepper
  // acumulan en vez de pisarse con el valor del render anterior (debt-90).
  | { t: 'saveMeasure'; name: string; value?: number; delta?: number; nota?: string; ts?: number }  // P0-1
  | { t: 'saveMedidas'; values: Partial<Pick<Profile, 'peso' | 'est' | 'grasa' | 'musculo'>>; ts?: number } // KPI compuesto
  | { t: 'logSkip'; product: string; ts?: number; keepSheet?: boolean; late?: boolean } // dosis saltada (no penaliza adherencia). keepSheet: flujo mayor → no cierra ni toastea. late: marca la ocurrencia como "tomada tarde" (la dosis real va en otro día)
  | { t: 'deleteLog'; id: string }                                    // P1-1
  | { t: 'setSetting'; key: keyof UserSettings; value: boolean | string | number | null }
  | { t: 'setThemeMode'; mode: ThemeMode }                              // modo de tema: auto | light | dark
  | { t: 'setName'; name: string }
  | { t: 'setProfileFields'; patch: Partial<Profile> }                // edad/sexo/actividad/meta (TDEE/proyección)
  | { t: 'setReminderTime'; time: string; product?: string }  // sin product → protocolo activo
  | { t: 'setRescueWindow'; minutes: 0 | 15 | 30 | 60 }  // item 168: ventana de rescate de notificación
  | { t: 'setScale'; scale: SyringeScale }
  | { t: 'setDraftDose'; draft: { value?: number; unit?: string; recon?: { vialMg: number; aguaMl: number }; site?: InjectionSite; ts?: number; overdue?: boolean } | null }
  | { t: 'arcoDelete' }                                               // P0-5
  | { t: 'reset' }                                                    // P1-7
  | { t: 'replaceState'; state: Partial<AppState> }                  // restaurar respaldo completo
  | { t: 'toast'; msg: string | null }
  | { t: 'editLogTime'; id: string; ts: number }
  | { t: 'undoDeleteLog' }
  | { t: 'clearDeletedLogBuffer' }
  | { t: 'setKpiOrder'; order: string[] }                             // n=146: orden y selección de KPIs (hasta 4)
  // ── Nuevas acciones (aditivas) ─────────────────────────────────────────────
  | { t: 'editLog'; id: string; patch: { value?: number | null; unit?: string | null; doseMg?: number | null; note?: string | null; severity?: AdverseSeverity | null } }
  | { t: 'setCalcDraft'; draft: AppState['calcDraft'] }
  | { t: 'setRegistrarDraft'; draft: AppState['registrarDraft'] }
  | { t: 'loadRemoteState'; state: Partial<AppState> } // restaurar desde la nube (Supabase): reemplaza el estado local por el blob remoto, vía hydrate (misma ruta segura que la carga inicial) — ruta "Reemplazar todo"
  | { t: 'applyMerged'; merged: SyncPayload } // aplica el resultado del merge por registro (lib/merge.ts) sobre el estado local, conservando lo device-local
  | { t: 'saveRecon'; entry: Omit<SavedRecon, 'id'> }
  | { t: 'deleteRecon'; id: string }
  | { t: 'setMeasureGoal'; name: string; value: number | null }
  | { t: 'setMeasureReminder'; name: string; intervalDays: number | null }
  | { t: 'setProductAlias'; product: string; alias: string | null }
  | { t: 'startFast' }
  | { t: 'endFast' }
  | { t: 'setVialStock'; product: string; totalMg: number; openedAt?: number }
  | { t: 'setPurchase'; product: string; purchasedMg: number; purchasedAt: number; cost?: number | null }
  | { t: 'logAdverseEffect'; product?: string; severity: AdverseSeverity; description: string; ts?: number }
  | { t: 'archiveProtocol'; product: string }
  | { t: 'reactivateProtocol'; product: string }
  | { t: 'dismissFirstDoseCelebration' }
  | { t: 'unlockAchievement'; id: string }
  | { t: 'setDayNote'; dateKey: string; text: string }

// ── helpers ────────────────────────────────────────────────────────────────────
let _seq = 0
const genId = () => `it_${Date.now().toString(36)}_${_seq++}`

// ── helpers de metadatos de sync (merge por registro) ─────────────────────────
// El mtime `m` se estampa con el RELOJ REAL (Date.now()), nunca con a.ts: una dosis backfilleada
// al martes se EDITÓ hoy — es "hoy" lo que decide qué versión gana el merge entre dispositivos.
export const emptyTombstones = (): Tombstones => ({ logItems: {}, protocols: {}, savedRecons: {}, foodLibrary: {}, meals: {}, mapKeys: {} })

// syncMeta.units[unit] = now para cada unidad tocada — solo en ramas que SÍ cambian estado
// (los no-op del reducer devuelven `s` intacto y no deben estampar nada).
function stampUnits(s: AppState, now: number, ...units: string[]): SyncMeta {
  const cur = s.syncMeta ?? { units: {} }
  const next = { ...cur.units }
  for (const u of units) next[u] = now
  return { ...cur, units: next }
}

// escribe una lápida de borrado (kind, id) = now — recibe Tombstones (o undefined) para poder
// encadenar varias lápidas en una misma acción (p.ej. deleteProduct: protocolo + claves de mapas).
// `?? {}` en el bucket: estados persistidos ANTES de agregar meals/mapKeys no traen esos buckets.
function addTombstone(t: Tombstones | undefined, kind: keyof Tombstones, id: string, now: number): Tombstones {
  const cur = t ?? emptyTombstones()
  return { ...emptyTombstones(), ...cur, [kind]: { ...(cur[kind] ?? {}), [id]: now } }
}

// limpia una lápida (el registro revivió: deshacer un borrado / re-set de una clave de mapa)
function clearTombstone(t: Tombstones | undefined, kind: keyof Tombstones, id: string): Tombstones | undefined {
  const cur = t
  if (!cur || !(id in (cur[kind] ?? {}))) return cur
  const rest = { ...cur[kind] }
  delete rest[id]
  return { ...cur, [kind]: rest }
}

// loop 140: rotación fija de sitios de inyección
const INJECTION_ROTATION: InjectionSite[] = [
  'abdomen-izq',
  'abdomen-der',
  'muslo-izq',
  'muslo-der',
  'gluteo-izq',
  'gluteo-der',
]

/** Devuelve el siguiente sitio en la rotación fija dado el último registrado.
 *  Si no hay último, retorna 'abdomen-izq' (primer sitio de la rotación). */
export function nextInjectionSite(last?: InjectionSite): InjectionSite {
  if (!last) return INJECTION_ROTATION[0]
  const idx = INJECTION_ROTATION.indexOf(last)
  return INJECTION_ROTATION[(idx + 1) % INJECTION_ROTATION.length]
}

/** Etiqueta legible COMPLETA del sitio de inyección (es-MX). Fuente única para Registro/Inicio. */
export const SITE_LABEL: Record<InjectionSite, string> = {
  'abdomen-izq': 'Abdomen izquierdo',
  'abdomen-der': 'Abdomen derecho',
  'muslo-izq': 'Muslo izquierdo',
  'muslo-der': 'Muslo derecho',
  'gluteo-izq': 'Glúteo izquierdo',
  'gluteo-der': 'Glúteo derecho',
}
/** Orden de rotación con etiquetas completas (para listas/chips). */
export const SITE_OPTIONS_FULL: { value: InjectionSite; label: string }[] =
  INJECTION_ROTATION.map((value) => ({ value, label: SITE_LABEL[value] }))
/** Etiqueta del sitio o null. */
export function siteLabel(s?: InjectionSite | null): string | null {
  return s ? SITE_LABEL[s] : null
}

// Recencia de inyección por zona (para el mapa anatómico de Inicio): rojo <1d, amarillo <2d, verde <3d.
export type ZoneRecency = 'fresh' | 'recent' | 'ok' | 'none' // <1d | <2d | <3d | ≥3d/nunca
export interface ZoneInfo { recency: ZoneRecency; lastTs: number | null }
export function injectionZoneRecency(s: AppState, now: number = Date.now(), product?: string | null): Record<InjectionSite, ZoneInfo> {
  const latest: Partial<Record<InjectionSite, number>> = {}
  for (const g of s.log) for (const it of g.items) {
    // ignora dosis con timestamp futuro; #16: si se pasa product, filtra solo ese producto
    if (it.type === 'dose' && it.site && it.ts <= now && (!product || it.product === product) && (latest[it.site] == null || it.ts > latest[it.site]!)) latest[it.site] = it.ts
  }
  const out = {} as Record<InjectionSite, ZoneInfo>
  for (const site of INJECTION_ROTATION) {
    const ts = latest[site]
    if (ts == null) { out[site] = { recency: 'none', lastTs: null }; continue }
    const days = (now - ts) / 86_400_000
    const recency: ZoneRecency = days < 1 ? 'fresh' : days < 2 ? 'recent' : days < 3 ? 'ok' : 'none'
    out[site] = { recency, lastTs: ts }
  }
  return out
}

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

export const HISTORY_CAP = 365 // exportado: merge.ts aplica el MISMO tope al fusionar series

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
  entries: { name: string; value: number; ts: number; m?: number }[],
): Record<string, MeasureSample[]> {
  const next = { ...hist }
  for (const e of entries) {
    // m: mtime de sync (momento REAL de la edición); el ts puede ser backfilleado
    const arr = [...(next[e.name] ?? []), { ts: e.ts, value: e.value, ...(e.m != null ? { m: e.m } : {}) }].sort((a, b) => a.ts - b.ts)
    next[e.name] = arr.length > HISTORY_CAP ? arr.slice(arr.length - HISTORY_CAP) : arr
  }
  return next
}

// estado on/off de la tira semanal por clave de fecha. doseOnly = solo días con dosis (adherencia).
export function weekStatus(log: LogGroup[], today: Date, doseOnly = false): boolean[] {
  return weekStrip(today).map((d) => {
    const g = log.find((x) => x.dateKey === isoKey(d.getTime()))
    if (!g) return false
    return doseOnly ? g.items.some((it) => it.type === 'dose') : g.items.length > 0
  })
}

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
// El activo debe ser un protocolo que EXISTE y NO está archivado; si no, salta al primer no-archivado
// (o null). Antes conservaba como activo un protocolo archivado → "Sin protocolo activo" en Progreso/Semana
// y Calc/Recetario/Paywall mostrando el archivado.
export function syncActive(s: AppState): AppState {
  const cur = s.activeProduct ? s.protocols[s.activeProduct] : null
  const activeValid = !!(cur && !cur.archived)
  const firstActive = Object.keys(s.protocols).find((k) => !s.protocols[k].archived) ?? null
  const activeProduct = activeValid ? s.activeProduct : firstActive
  return {
    ...s,
    activeProduct,
    protocol: activeProduct ? (s.protocols[activeProduct] ?? null) : null,
    // solo productos NO archivados: Inicio/Progreso/Recetario iteran este caché y no deben mostrar archivados
    importedProducts: Object.keys(s.protocols).filter((k) => !s.protocols[k].archived),
  }
}

// Recalcula los cachés de medidas (measureValues + campos objetivos del profile + bmi) desde el history,
// que es la fuente de verdad de la serie. Solo toca las medidas `affected` (las que ganaron/perdieron una
// muestra) → las estáticas como Altura (sin history) quedan intactas. Mantiene todo coherente al borrar/undo.
function rebuildMeasureCaches(
  history: Record<string, MeasureSample[]>,
  baseMv: Record<string, number>,
  baseProfile: Profile,
  affected: string[],
): { measureValues: Record<string, number>; profile: Profile } {
  const measureValues = { ...baseMv }
  const profile = { ...baseProfile }
  for (const name of affected) {
    const samples = history[name] ?? []
    const prof = MEASURE_META[name]?.prof
    if (samples.length) {
      const latest = samples.reduce((a, b) => (b.ts >= a.ts ? b : a))
      measureValues[name] = latest.value
      if (prof) (profile as Record<string, number | null>)[prof] = latest.value
    } else {
      delete measureValues[name]
      if (prof) (profile as Record<string, number | null>)[prof] = null
    }
  }
  profile.bmi = profile.peso != null && profile.est != null ? bmiCalc(profile.peso, profile.est) : null
  return { measureValues, profile }
}

// lastMealTs DERIVADO = ts de la comida más reciente en todo el historial de nutrición (o null si no hay).
// Mantenerlo derivado evita que el chip de ayuno mienta al borrar la última comida o al registrar/copiar
// comidas con hora retroactiva.
function latestMealTs(nut: AppState['nutrition']): number | null {
  let max: number | null = null
  for (const v of Object.values(nut)) for (const m of v.meals) if (max == null || m.ts > max) max = m.ts
  return max
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

  // Migración de agua: 'water' pasó de CONTEO DE VASOS a MILILITROS (para que cambiar el tamaño del vaso
  // NO reinterprete lo ya tomado). Valores viejos (conteo de vasos, <50) → × tamaño de vaso. Idempotente:
  // los valores ya en ml (≥150) no se vuelven a tocar (el vaso mínimo es ≥150 ml).
  const gMl = (() => { try { return Number(localStorage.getItem('hacktrack-glass-ml') ?? '250') || 250 } catch { return 250 } })()
  const nutrition: typeof s.nutrition = {}
  for (const [k, v] of Object.entries(s.nutrition ?? {})) {
    nutrition[k] = (v.water > 0 && v.water < 50) ? { ...v, water: Math.round(v.water * gMl) } : v
  }

  // #104: normalizar secondaryGoals (estados antiguos pueden no tenerlo → crash al hacer spread/iterar)
  const secondaryGoals = Array.isArray(s.secondaryGoals) ? s.secondaryGoals : []
  return syncActive({ ...s, protocols, log, activeProduct, nutrition, secondaryGoals })
}

// #F4 — sanea un respaldo importado ANTES de aplicarlo: descarta entradas inválidas en vez de aceptarlas
// (un LogItem con type inválido podía crashear vistas; un protocolo malformado se perdía en silencio).
// Devuelve el estado saneado + cuántas entradas se descartaron (para avisar al usuario, no silenciar).
const VALID_LOG_TYPES = new Set<string>(['dose', 'medida', 'none', 'skip', 'efecto-adverso', 'ayuno'])
export function sanitizeImport(st: Partial<AppState>): { state: Partial<AppState>; dropped: number } {
  const out: Partial<AppState> = { ...st }
  let dropped = 0
  // log: cada grupo {dateKey:string, items:[]}; cada item con ts numérico y type válido
  if (Array.isArray(st.log)) {
    out.log = (st.log as unknown[])
      .filter((g): g is { dateKey: string; items: unknown[] } => !!g && typeof (g as { dateKey?: unknown }).dateKey === 'string' && Array.isArray((g as { items?: unknown }).items))
      .map((g) => {
        const before = g.items.length
        const items = g.items.filter((it) => !!it && typeof (it as { ts?: unknown }).ts === 'number' && VALID_LOG_TYPES.has((it as { type?: unknown }).type as string))
        dropped += before - items.length
        return { ...g, items }
      })
      .filter((g) => g.items.length > 0) as AppState['log']
  }
  // protocols: producto→UserProtocol con product:string y cadence presente
  if (st.protocols && typeof st.protocols === 'object') {
    const ps: Record<string, UserProtocol> = {}
    for (const [k, p] of Object.entries(st.protocols as Record<string, unknown>)) {
      const pp = p as { product?: unknown; cadence?: unknown }
      if (pp && typeof pp === 'object' && typeof pp.product === 'string' && pp.cadence) ps[k] = p as UserProtocol
      else dropped += 1
    }
    out.protocols = ps
  }
  return { state: out, dropped }
}

// Guard de "respaldo con datos": rechaza SOLO la fila hueca ('{}') — un respaldo válido puede tener
// únicamente nutrición/hidratación (Comida), historial de medidas o biblioteca de alimentos, sin log
// ni protocolos. ÚNICA fuente de verdad del predicado: la comparten el reducer (loadRemoteState) y
// Ajustes (restore + import de archivo) para que no puedan divergir. Evaluar siempre sobre el blob
// YA SANEADO por sanitizeImport (el crudo puede "tener datos" que el saneo descarta por completo).
export function importHasData(st: Partial<AppState>): boolean {
  return (
    (Array.isArray(st.log) && st.log.length > 0) ||
    Object.keys(st.protocols ?? {}).length > 0 ||
    (Array.isArray(st.importedProducts) && st.importedProducts.length > 0) ||
    Object.keys(st.nutrition ?? {}).length > 0 ||
    Object.keys(st.history ?? {}).length > 0 ||
    (Array.isArray(st.foodLibrary) && st.foodLibrary.length > 0)
  )
}

// ── Sincronización por registro (Opción C): payload de sync + aplicación del merge ────────────

// Claves de AppState que NUNCA viajan a la nube (estado de UI / de dispositivo). Fuente ÚNICA:
// prepareSyncPayload las excluye en runtime y el test de exclusión exige que TODA clave de
// AppState esté clasificada (synced / never-synced / caché) — un campo nuevo sin clasificar
// rompe tsc y el test: la decisión de sincronizarlo o no es consciente, nunca por accidente.
export const NEVER_SYNCED_KEYS = [
  'todayTs', 'screen', 'tab', 'sheet', 'sheetArg', 'toast', 'toastUndoId', 'draftDose',
  'calcDraft', 'registrarDraft', 'deletedLogBuffer', 'justOnboarded', 'coachmarksSeen',
  'returnTo', 'progresoView', 'logged', 'showFirstDoseCelebration', 'localOnly',
] as const

// Cachés derivadas: no viajan; se recomputan al aplicar el merge (hydrate/syncActive + rebuildMeasureCaches)
export const CACHE_KEYS = ['protocol', 'importedProducts', 'measureValues'] as const

// Campos de settings SOLO-de-dispositivo: el PIN jamás sube (un hash de 4 dígitos se revierte en ms
// con acceso a la BD) y consent/cloudSync son decisiones de ESTA instalación, no de la cuenta.
export const DEVICE_SETTINGS_KEYS = ['pinEnabled', 'pinHash', 'consentVersion', 'consentActive', 'cloudSync'] as const

export type SyncedSettings = Omit<UserSettings, (typeof DEVICE_SETTINGS_KEYS)[number]>

// El payload que viaja/merjea: AppState sin lo nunca-sincronizado ni cachés, con settings depurado.
// syncMeta/tombstones son opcionales en el TIPO (payloads legados no los traen); prepareSyncPayload
// SIEMPRE los emite y merge.ts tolera su ausencia con defaults.
export type SyncPayload = Omit<AppState, (typeof NEVER_SYNCED_KEYS)[number] | (typeof CACHE_KEYS)[number] | 'settings'> & {
  settings: SyncedSettings
}

/** Construye el payload de sync desde el estado (PURO, sin Date.now()): excluye todas las claves
 *  nunca-sincronizadas y las cachés, depura settings y garantiza syncMeta/tombstones presentes. */
export function prepareSyncPayload(s: AppState): SyncPayload {
  const clone: Record<string, unknown> = { ...s }
  for (const k of [...NEVER_SYNCED_KEYS, ...CACHE_KEYS]) delete clone[k]
  const settings: Record<string, unknown> = { ...s.settings }
  for (const k of DEVICE_SETTINGS_KEYS) delete settings[k]
  clone.settings = settings
  clone.syncMeta = s.syncMeta ?? { units: {} }
  clone.tombstones = s.tombstones ?? emptyTombstones()
  return clone as unknown as SyncPayload
}

/** Aplica un payload FUSIONADO (resultado de mergeStates) sobre el estado local. Conserva TODO lo
 *  device-local (UI efímera, todayTs, PIN/consent/cloudSync/localOnly) y recomputa las cachés:
 *  protocol/importedProducts vía hydrate→syncActive y measureValues/campos-espejo del perfil/bmi
 *  desde el history fusionado (la serie es la fuente de verdad). PURO — la acción 'applyMerged'
 *  lo envuelve para despacharlo. La ruta "Reemplazar todo" sigue siendo 'loadRemoteState'. */
export function applyMerged(s: AppState, merged: SyncPayload): AppState {
  // settings: lo sincronizado pisa lo local, pero los campos del DISPOSITIVO se conservan siempre
  const settings: UserSettings = {
    ...s.settings,
    ...merged.settings,
    pinEnabled: s.settings.pinEnabled,
    pinHash: s.settings.pinHash,
    consentVersion: s.settings.consentVersion,
    consentActive: s.settings.consentActive,
    cloudSync: s.settings.cloudSync,
  }
  // Las cachés locales se ANULAN antes de hidratar: si el merge dejó protocols vacío (el otro
  // dispositivo borró el último producto), la migración legado de hydrate lo resucitaría desde
  // el caché stale `protocol`/`importedProducts`. El payload fusionado es la única verdad.
  const base: AppState = { ...s, ...merged, settings, protocol: null, importedProducts: [] }
  // hydrate: migraciones idempotentes + resync de cachés protocol/importedProducts (syncActive)
  const hydrated = hydrate(base)
  // measureValues + campos espejo del perfil + bmi: recomputados desde el history fusionado.
  // Solo medidas CON serie — 'Altura' no tiene history (vive en profile.est) y reconstruirla
  // desde una serie vacía la borraría; se re-espeja desde el perfil fusionado.
  const rebuilt = rebuildMeasureCaches(hydrated.history, hydrated.measureValues, hydrated.profile, Object.keys(hydrated.history))
  const measureValues = { ...rebuilt.measureValues }
  if (rebuilt.profile.est != null) measureValues['Altura'] = rebuilt.profile.est
  return {
    ...hydrated,
    measureValues,
    profile: rebuilt.profile,
    logged: hydrated.log.length > 0,
    lastMealTs: latestMealTs(hydrated.nutrition), // derivado de la verdad fusionada, no del máximo sincronizado
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
        syncMeta: stampUnits(s, Date.now(), 'goals'),
      }

    case 'setGoals': {
      const [primary, ...rest] = a.cats
      const measures = [...new Set(a.cats.flatMap((c) => MEASURES_BY[c] ?? MEASURES_BY.Explorar))]
      return { ...s, curGoal: primary ?? s.curGoal, secondaryGoals: rest, selectedMeasures: measures, syncMeta: stampUnits(s, Date.now(), 'goals') }
    }
    case 'setMeasures':
      return { ...s, selectedMeasures: a.measures, syncMeta: stampUnits(s, Date.now(), 'goals') }
    case 'setBaseline': {
      // El baseline del onboarding ahora CONECTA con los KPIs/medidas: escribe measureValues + history
      // (igual que saveMedidas) además del profile, para que Peso/Altura/IMC ya aparezcan en las cards de
      // Inicio y en "Cambio de medidas" sin tener que re-llenarse. metaPesoKg alimenta la proyección de meta.
      const p = { ...s.profile }
      const mv = { ...s.measureValues }
      const now = Date.now()
      const samples: { name: string; value: number; ts: number; m?: number }[] = []
      if (a.peso != null) { p.peso = a.peso; mv['Peso'] = a.peso; samples.push({ name: 'Peso', value: a.peso, ts: now, m: now }) }
      if (a.est != null) { p.est = a.est; mv['Altura'] = a.est }
      if (a.metaPesoKg != null) p.metaPesoKg = a.metaPesoKg
      const peso = p.peso, est = p.est // consts locales → TS estrecha el null antes de bmiCalc
      if (peso != null && est != null) {
        const bmi = bmiCalc(peso, est) // puede ser null si los datos no son válidos
        p.bmi = bmi
        if (bmi != null) { mv['IMC'] = bmi; samples.push({ name: 'IMC', value: bmi, ts: now, m: now }) }
      }
      return {
        ...s,
        profile: p,
        measureValues: mv,
        history: samples.length ? pushHistory(s.history, samples) : s.history,
        syncMeta: stampUnits(s, now, 'profile'),
      }
    }
    case 'setLocalOnly':
      // Modo solo local y respaldo en la nube son excluyentes: activarlo APAGA cloudSync de verdad
      // (useCloudSync además lo respeta como guard) — el switch no puede decir "solo local" y seguir
      // subiendo. Desactivarlo NO re-enciende el respaldo: eso es un opt-in explícito en Ajustes.
      return a.value
        ? { ...s, localOnly: true, settings: { ...s.settings, cloudSync: false } }
        : { ...s, localOnly: false }
    case 'finishOnboarding':
      return { ...s, justOnboarded: true, screen: 's-app', tab: 'inicio' }
    case 'seenWelcome':
      return { ...s, justOnboarded: false }
    case 'seenCoachmarks':
      return { ...s, coachmarksSeen: true }
    case 'setReturnTo':
      return { ...s, returnTo: a.screen }

    case 'setProtocol': {
      // crea el protocolo del producto si no existe y lo deja como activo
      const existing = s.protocols[a.product]
      const mNow = Date.now()
      const fp = existing ?? (() => { const f = freshProtocol(a.product, s.todayTs); return f ? { ...f, m: mNow } : null })()
      if (!fp) return s
      return syncActive({ ...s, protocols: { ...s.protocols, [a.product]: fp }, activeProduct: a.product, syncMeta: stampUnits(s, mNow, 'activeProduct') })
    }

    case 'setActiveProduct':
      return s.protocols[a.product] ? syncActive({ ...s, activeProduct: a.product, syncMeta: stampUnits(s, Date.now(), 'activeProduct') }) : s

    case 'setProgresoView':
      return { ...s, progresoView: a.view }

    case 'water': {
      // clave del día del RELOJ (no todayTs, que puede rezagarse tras medianoche): el vaso cae en el día real
      const mNow = Date.now()
      const k = isoKey(mNow)
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      return { ...s, nutrition: { ...s.nutrition, [k]: { ...cur, water: Math.max(0, cur.water + a.delta), m: mNow } } }
    }
    case 'addMeal': {
      if (!(a.kcal > 0)) return s
      // la clave del bucket se deriva del MISMO instante que el ts estampado (invariante: comida.ts ∈ día del bucket)
      const mealTs = a.ts ?? Date.now()
      const k = isoKey(mealTs)
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      const mNow = Date.now()
      // m por comida: el merge fusiona comidas POR ID con LWW — sin m propio, una edición no sabría ganar
      const meal: Meal = {
        id: genId(), kcal: Math.round(a.kcal), ts: mealTs,
        protein: a.protein ?? null, carbs: a.carbs ?? null, fat: a.fat ?? null, label: a.label?.trim() || null, portion: 1, m: mNow,
      }
      const slot = mealSlot(meal.ts)
      // guardar como favorito (fusiona por etiqueta) si se pidió + aprende la franja horaria
      let foodLibrary = s.foodLibrary
      if (a.fav && meal.label) {
        const i = foodLibrary.findIndex((f) => f.label.toLowerCase() === meal.label!.toLowerCase())
        if (i >= 0) {
          foodLibrary = foodLibrary.map((f, j) => (j === i ? { ...f, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, usoCount: f.usoCount + 1, hourBucket: { ...(f.hourBucket ?? {}), [slot]: (f.hourBucket?.[slot] ?? 0) + 1 }, m: mNow } : f))
        } else {
          foodLibrary = [{ id: genId(), label: meal.label, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, usoCount: 1, hourBucket: { [slot]: 1 }, defaultMultiplier: 1, m: mNow }, ...foodLibrary]
        }
      }
      const nutAdd = { ...s.nutrition, [k]: { ...cur, meals: [meal, ...cur.meals], m: mNow } }
      return { ...s, nutrition: nutAdd, foodLibrary, lastMealTs: latestMealTs(nutAdd) }
    }
    case 'addFavMeal': {
      const fav = s.foodLibrary.find((f) => f.id === a.id)
      if (!fav) return s
      const por = a.portion && a.portion > 0 ? a.portion : (fav.defaultMultiplier && fav.defaultMultiplier > 0 ? fav.defaultMultiplier : 1)
      const sc = (v: number | null | undefined) => (v != null ? Math.round(v * por) : null)
      // misma invariante que addMeal: bucket y ts derivan del mismo instante
      const mealTs = a.ts ?? Date.now()
      const k = isoKey(mealTs)
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      const mNow = Date.now()
      const meal: Meal = {
        id: genId(), kcal: Math.round(fav.kcal * por), ts: mealTs,
        protein: sc(fav.protein), carbs: sc(fav.carbs), fat: sc(fav.fat),
        label: por !== 1 ? `${fav.label} ×${por}` : fav.label, portion: por, favId: fav.id, m: mNow,
      }
      const slot = mealSlot(meal.ts)
      // aprende: cuenta uso, franja horaria y porción por defecto
      const foodLibrary = s.foodLibrary.map((f) => (f.id === a.id
        ? { ...f, usoCount: f.usoCount + 1, hourBucket: { ...(f.hourBucket ?? {}), [slot]: (f.hourBucket?.[slot] ?? 0) + 1 }, defaultMultiplier: por, m: mNow }
        : f))
      const nutFav = { ...s.nutrition, [k]: { ...cur, meals: [meal, ...cur.meals], m: mNow } }
      return { ...s, nutrition: nutFav, foodLibrary, lastMealTs: latestMealTs(nutFav) }
    }
    case 'copyYesterday': {
      // 'hoy' y 'ayer' se anclan al RELOJ, el mismo instante del que derivan los ts copiados
      const anchor = Date.now()
      const k = isoKey(anchor)
      const y = s.nutrition[isoKey(addDays(anchor, -1).getTime())]
      if (!y || y.meals.length === 0) return s
      const cur = s.nutrition[k] ?? { water: 0, meals: [] }
      // conserva la hora del día de cada comida de ayer, trasladada a hoy (mantiene su franja);
      // cada copia es una comida NUEVA (id y m propios) — el merge por id no la confunde con la de ayer
      const copied: Meal[] = y.meals.map((m) => {
        const o = new Date(m.ts)
        const d = new Date(anchor); d.setHours(o.getHours(), o.getMinutes(), o.getSeconds(), 0)
        return { ...m, id: genId(), ts: d.getTime(), m: anchor }
      })
      const nutCopy = { ...s.nutrition, [k]: { ...cur, meals: [...copied, ...cur.meals], m: anchor } }
      return { ...s, nutrition: nutCopy, lastMealTs: latestMealTs(nutCopy) }
    }
    case 'delMeal': {
      const mNow = Date.now()
      const nutrition: AppState['nutrition'] = {}
      let deleted = false
      // el mtime del día solo se estampa en el bucket que SÍ perdió la comida
      for (const [k, v] of Object.entries(s.nutrition)) {
        const meals = v.meals.filter((m) => m.id !== a.id)
        if (meals.length !== v.meals.length) { deleted = true; nutrition[k] = { ...v, meals, m: mNow } }
        else nutrition[k] = v
      }
      // lápida de la comida: sin ella, el merge por id la resucitaría desde el otro dispositivo
      // recomputar lastMealTs: si se borró la última comida, el chip de ayuno debe dejar de mentir
      return {
        ...s, nutrition, lastMealTs: latestMealTs(nutrition),
        tombstones: deleted ? addTombstone(s.tombstones, 'meals', a.id, mNow) : s.tombstones,
      }
    }
    case 'editMeal': {
      const mNow = Date.now()
      const nutrition: AppState['nutrition'] = {}
      // el mtime del día solo se estampa en el bucket cuya comida se editó; la comida editada
      // re-estampa su m propio — así la edición gana el merge por id (aunque cambie el label)
      for (const [k, v] of Object.entries(s.nutrition)) {
        const touched = v.meals.some((m) => m.id === a.id)
        nutrition[k] = touched
          ? { ...v, meals: v.meals.map((m) => (m.id === a.id ? { ...m, ...a.patch, m: mNow } : m)), m: mNow }
          : v
      }
      // editar la hora de una comida puede cambiar cuál es la más reciente
      return { ...s, nutrition, lastMealTs: latestMealTs(nutrition) }
    }
    case 'delFav':
      // lápida de borrado: sin ella, el favorito resucitaría al fusionar con otro dispositivo
      return { ...s, foodLibrary: s.foodLibrary.filter((f) => f.id !== a.id), tombstones: addTombstone(s.tombstones, 'foodLibrary', a.id, Date.now()) }
    case 'editFav':
      return { ...s, foodLibrary: s.foodLibrary.map((f) => (f.id === a.id ? { ...f, ...a.patch, m: Date.now() } : f)) }
    case 'createFav': {
      if (!a.fav.label?.trim() || !(a.fav.kcal > 0)) return s
      const mNow = Date.now()
      // fusiona por etiqueta si ya existe
      const i = s.foodLibrary.findIndex((f) => f.label.toLowerCase() === a.fav.label.trim().toLowerCase())
      const entry: FoodFav = { id: genId(), usoCount: 0, defaultMultiplier: 1, hourBucket: {}, ...a.fav, label: a.fav.label.trim(), m: mNow }
      if (i >= 0) return { ...s, foodLibrary: s.foodLibrary.map((f, j) => (j === i ? { ...f, ...a.fav, label: a.fav.label.trim(), m: mNow } : f)) }
      return { ...s, foodLibrary: [entry, ...s.foodLibrary] }
    }
    case 'setMacroGoals':
      return { ...s, macroGoals: a.goals, syncMeta: stampUnits(s, Date.now(), 'goals') }
    case 'setKcalGoal':
      return { ...s, kcalGoal: a.value && a.value > 0 ? Math.round(a.value) : null, syncMeta: stampUnits(s, Date.now(), 'goals') }

    case 'deleteProduct': {
      // quita el producto del seguimiento. NO toca s.log → los registros pasados se conservan.
      if (!s.protocols[a.product]) return s
      const mNow = Date.now()
      const protocols = { ...s.protocols }
      delete protocols[a.product]
      // Limpiar cachés por-producto (si no, al re-agregarlo precarga recon/sitio/dosis viejos y el alias
      // sigue contando). El activo lo re-elige syncActive (filtra archivados/inexistentes).
      const productDoses = { ...s.productDoses }; delete productDoses[a.product]
      const productRecon = { ...s.productRecon }; delete productRecon[a.product]
      const lastInjectionSite = { ...s.lastInjectionSite }; delete lastInjectionSite[a.product]
      const productAliases = { ...s.productAliases }; delete productAliases[a.product]
      // lápida del protocolo (borrado real, no archivado) + lápidas mapKeys de las claves limpiadas
      // (sin ellas, el residuo por-producto resucitaría al fusionar) + mtime de los mapas limpiados
      let tombstones = addTombstone(s.tombstones, 'protocols', a.product, mNow)
      for (const mapa of ['productDoses', 'productRecon', 'lastInjectionSite', 'productAliases'] as const) {
        tombstones = addTombstone(tombstones, 'mapKeys', `${mapa}:${a.product}`, mNow)
      }
      return syncActive({
        ...s, protocols, productDoses, productRecon, lastInjectionSite, productAliases,
        tombstones,
        syncMeta: stampUnits(s, mNow, 'productDoses', 'productRecon', 'lastInjectionSite', 'productAliases'),
      })
    }

    // P0-3: la cadencia editada por el usuario es la fuente de verdad (protocolo activo)
    case 'setCadence':
      return s.activeProduct && s.protocols[s.activeProduct]
        ? syncActive({ ...s, protocols: { ...s.protocols, [s.activeProduct]: { ...s.protocols[s.activeProduct], cadence: a.cadence, m: Date.now() } } })
        : s

    // tunear el protocolo en foco de edición (cadencia, fases, fechas, etc.)
    case 'updateProtocol':
      return s.activeProduct && s.protocols[s.activeProduct]
        ? syncActive({ ...s, protocols: { ...s.protocols, [s.activeProduct]: { ...s.protocols[s.activeProduct], ...a.patch, m: Date.now() } } })
        : s

    // tunear un producto específico (p.ej. navegar fases de titulación de ESE producto)
    case 'updateProtocolFor':
      return s.protocols[a.product]
        ? syncActive({ ...s, protocols: { ...s.protocols, [a.product]: { ...s.protocols[a.product], ...a.patch, m: Date.now() } } })
        : s

    case 'importProducts': {
      // fusiona (no reemplaza) — crea un protocolo por cada producto nuevo del catálogo
      const mNow = Date.now()
      const protocols = { ...s.protocols }
      const recognized = a.names.filter((n) => n in PEPTIDES)
      const unknown = a.names.filter((n) => !(n in PEPTIDES))
      for (const name of recognized) {
        if (!protocols[name]) {
          const fp = freshProtocol(name, s.todayTs)
          if (fp) protocols[name] = { ...fp, m: mNow }
        }
      }
      const activeProduct = s.activeProduct ?? Object.keys(protocols)[0] ?? null
      // #58: no descartar en silencio — avisar cuáles no se reconocieron del catálogo.
      const toast = unknown.length
        ? `No se reconocieron del catálogo: ${unknown.join(', ')}`
        : s.toast
      // solo estampa 'activeProduct' si de verdad cambió (era null y ahora hay uno)
      const syncMeta = activeProduct !== s.activeProduct ? stampUnits(s, mNow, 'activeProduct') : s.syncMeta
      return syncActive({ ...s, protocols, activeProduct, toast, syncMeta })
    }

    // P0-1: la dosis tecleada ENTRA al diario; activa dashboard; suma racha. Respeta la hora elegida.
    case 'logDose': {
      const now = a.ts ? new Date(a.ts) : new Date()
      // #17: guard anti doble-tap — ignora una dosis IDÉNTICA (mismo producto/valor/unidad) registrada
      // < 5 s antes. Evita duplicar la dosis, descontar stock dos veces y romper la racha por un toque doble.
      const nowMsDup = now.getTime()
      const recentItems = s.log[0]?.items ?? []
      for (const it of recentItems) {
        if (
          it.type === 'dose' && it.product === a.product &&
          it.value === (a.value ?? null) && it.unit === a.unit &&
          nowMsDup - it.ts >= 0 && nowMsDup - it.ts < 5_000
        ) {
          return s // duplicado por doble-tap → no registrar de nuevo
        }
      }
      // Backstop anti-duplicado del MISMO DÍA: si ya existe una dosis IDÉNTICA (mismo producto+valor+unidad)
      // en el día de esta toma, no la dupliques y AVISA (no silencioso). La cadencia es 1/día por producto, así
      // que una segunda dosis idéntica el mismo día casi siempre es un re-registro accidental (p.ej. por dos
      // rutas distintas). Retorna ANTES de incrementar vialStock → no descuenta el vial dos veces. Una corrección
      // legítima usa otro valor (no se bloquea) o el editor del Diario.
      {
        const dayKey = isoKey(nowMsDup)
        const dayGroup = s.log.find((g) => g.dateKey === dayKey)
        if (dayGroup?.items.some((it) =>
          it.type === 'dose' && it.product === a.product &&
          it.value === (a.value ?? null) && it.unit === a.unit,
        )) {
          return { ...s, toast: `Ya hay una dosis de ${a.product} registrada ese día` }
        }
      }
      const rawNote = a.note?.trim().slice(0, 200)   // nota opcional (#29: 200, alineado con el input)
      const mNow = Date.now() // mtime de sync: el momento REAL del registro, no el ts (que puede ser backfill)
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: 'Dosis registrada',
        u: a.product + (a.value ? ` · ${a.value} ${a.unit}` : ''),
        cat: '#1B8A7D',
        ic: 'dose',
        type: 'dose',
        ts: now.getTime(),
        m: mNow,
        product: a.product,
        value: a.value ?? null, // valor/unidad crudos: el editor los pre-llena y editLog reconstruye 'u'
        unit: a.unit,
        doseMg: a.doseMg, // mg canónicos (para vida media/presencia); undefined si no se pudo convertir
        site: a.site,     // sitio de inyección (loop 140); undefined si el usuario lo omitió
        ...(rawNote ? { note: rawNote } : {}),        // loop 138: nota opcional
        ...(a.effect ? { effect: a.effect } : {}),    // loop 139: efecto opcional
        ...(a.effect && a.effectIntensity != null ? { effectIntensity: a.effectIntensity } : {}), // intensidad 0–100
      }
      // Stock del vial:
      //  - Si llega una reconstitución nueva (vialMg = mg totales del vial) y aún NO hay stock,
      //    se inicializa desde ahí → el dato de reconstitución alimenta el cálculo de stock.
      //  - Luego se descuenta la dosis registrada (inmutable).
      const proto = s.protocols[a.product]
      let updatedProtocols = s.protocols
      if (proto) {
        let vialStock = proto.vialStock
        if (!vialStock && a.recon && a.recon.vialMg > 0) {
          vialStock = { totalMg: a.recon.vialMg, usedMg: 0 }
        }
        if (vialStock && (a.doseMg ?? 0) > 0) {
          vialStock = { ...vialStock, usedMg: vialStock.usedMg + (a.doseMg ?? 0) }
        }
        if (vialStock && vialStock !== proto.vialStock) {
          updatedProtocols = { ...s.protocols, [a.product]: { ...proto, vialStock, m: mNow } }
        }
      }
      // unidades de mapa tocadas por esta dosis (para el merge por clave entre dispositivos)
      const touchedUnits: string[] = []
      if (a.value != null) touchedUnits.push('productDoses')
      if (a.recon) touchedUnits.push('productRecon')
      if (a.site) touchedUnits.push('lastInjectionSite')
      // Primera dosis: activar celebración
      const wasLogged = s.logged
      return syncActive({
        ...s,
        log: prependToLog(s.log, item),
        protocols: updatedProtocols,
        syncMeta: touchedUnits.length ? stampUnits(s, mNow, ...touchedUnits) : s.syncMeta,
        // recuerda la dosis tecleada por producto (alimenta "tus dosis de hoy")
        productDoses: a.value != null ? { ...s.productDoses, [a.product]: { value: a.value, unit: a.unit } } : s.productDoses,
        // recuerda la reconstitución del producto (para pre-llenar y para "hecho hoy" en UI/mL).
        // Si hay recon nueva: preserva reconDate ya existente (no se pisotea al registrar dosis posteriores)
        // o lo setea a now si es la primera vez (loop 167: fecha de mezcla del vial).
        productRecon: a.recon ? {
          ...s.productRecon,
          [a.product]: {
            ...a.recon,
            reconDate: (s.productRecon[a.product]?.reconDate) ?? now.getTime(),
          },
        } : s.productRecon,
        // loop 140: actualiza el último sitio de inyección por producto
        lastInjectionSite: a.site ? { ...s.lastInjectionSite, [a.product]: a.site } : s.lastInjectionSite,
        logged: true,
        // primera dosis: disparar celebración
        showFirstDoseCelebration: !wasLogged ? true : s.showFirstDoseCelebration,
        // keepSheet=true: el llamador maneja el cierre del sheet (p.ej. DoseConfirm mostrando paso de efecto)
        sheet: a.keepSheet ? s.sheet : null,
        toast: 'Dosis registrada',
        toastUndoId: item.id, // permite "Deshacer" desde el toast
      })
    }

    // loop 139: guarda el efecto post-dosis en un item ya registrado (p.ej. desde el mini-sheet de ¿Cómo te sientes?)
    case 'setLogEffect': {
      const log = s.log.map((g) => ({
        ...g,
        items: g.items.map((it) => (it.id === a.id ? { ...it, effect: a.effect, ...(a.effectIntensity != null ? { effectIntensity: a.effectIntensity } : {}), m: Date.now() } : it)),
      }))
      return { ...s, log }
    }

    // Skip intencional: inserta un LogItem type:'skip' sin contar como dosis ni como perdida
    case 'logSkip': {
      const now = a.ts ? new Date(a.ts) : new Date()
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: 'Dosis saltada',
        u: a.product,
        cat: '#94A3B8',   // gris neutro — no usa color de categoría
        ic: 'skip',
        type: 'skip',
        ts: now.getTime(),
        m: Date.now(),
        product: a.product,
        ...(a.late ? { late: true } : {}), // "tomada tarde": la dosis real se registró en otro día (hoy)
      }
      // keepSheet: el skip es parte de un flujo mayor (p.ej. al registrar una dosis atrasada "hoy" se marca
      // la ocurrencia programada como resuelta para que deje de aparecer como pendiente) → no cerrar ni toastear.
      if (a.keepSheet) return { ...s, log: prependToLog(s.log, item) }
      return {
        ...s,
        log: prependToLog(s.log, item),
        sheet: null,
        toast: 'Dosis marcada como "No hoy"',
        toastUndoId: item.id, // permite "Deshacer" desde el toast
      }
    }

    // P0-1 + P1-5: las medidas también entran al diario y activan el dashboard
    case 'saveMeasure': {
      const now = a.ts ? new Date(a.ts) : new Date()
      const nowMs = now.getTime()
      const nowKey = isoKey(nowMs)
      // Modo DELTA (steppers acumulados como electrolitos): la base es la última muestra del MISMO
      // día que nowMs, leída AQUÍ dentro — dos taps antes del re-render acumulan (debt-90), y un día
      // sin muestras arranca de cero (los acumulados diarios se reinician cada día).
      let value: number
      if (a.delta != null) {
        let base = 0
        let baseTs = -Infinity
        for (const sm of s.history[a.name] ?? []) {
          if (sm.ts > baseTs && isoKey(sm.ts) === nowKey) { base = sm.value; baseTs = sm.ts }
        }
        value = Math.max(0, base + a.delta)
      } else if (a.value != null) {
        value = a.value
      } else {
        return s // acción malformada: ni value ni delta
      }
      const ic = MEASURE_ICON[a.name] ?? { icon: 'medidas', cat: '#5FC9B8' }
      const uStr = fmtMeasureValue(a.name, value) + (a.nota ? ' · ' + a.nota : '')
      // COALESCE: si ya hay un registro de la MISMA medida en los últimos 60 s, se ACTUALIZA en vez
      // de crear otro (un stepper no debe ensuciar el diario con un registro por clic). La búsqueda
      // cubre el grupo de HOY y el de AYER — un stepper puede cruzar la medianoche y el item previo
      // vive en el grupo de ayer (debt-70). Excepción: en modo delta NO se coalesce a través de la
      // medianoche — el total de ayer de un acumulado diario debe sobrevivir como registro propio.
      const COALESCE_MS = 60_000
      const prevKey = isoKey(addDays(nowMs, -1).getTime())
      const candidateKeys = a.delta != null ? [nowKey] : [nowKey, prevKey]
      let target: { gi: number; ii: number } | null = null
      for (const key of candidateKeys) {
        if (target) break
        const gi = s.log.findIndex((g) => g.dateKey === key)
        if (gi === -1) continue
        // items ordenados ts desc → el primer match es el más reciente
        const ii = s.log[gi].items.findIndex(
          (it) => it.type === 'medida' && it.n === a.name && nowMs >= it.ts && nowMs - it.ts < COALESCE_MS,
        )
        if (ii !== -1) target = { gi, ii }
      }
      const mNow = Date.now() // mtime de sync: momento real de la edición (nowMs puede ser backfill)
      const coalesced = target != null
      let finalLog: LogGroup[]
      if (target) {
        const group = s.log[target.gi]
        const updated: LogItem = { ...group.items[target.ii], u: uStr, t: fmtTime(now), ts: nowMs, m: mNow }
        if (group.dateKey === nowKey) {
          const { gi, ii } = target
          finalLog = s.log.map((g, i) => (i === gi ? { ...g, items: g.items.map((it, j) => (j === ii ? updated : it)) } : g))
        } else {
          // el ts nuevo cambió el día del item (cruce de medianoche) → reagrupar vía prependToLog
          const { gi, ii } = target
          const without = s.log
            .map((g, i) => (i === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g))
            .filter((g) => g.items.length > 0)
          finalLog = prependToLog(without, updated)
        }
      } else {
        finalLog = prependToLog(s.log, { id: genId(), t: fmtTime(now), n: a.name, u: uStr, cat: ic.cat, ic: ic.icon, type: 'medida', ts: nowMs, m: mNow })
      }

      // history: reemplaza la última muestra reciente (<60 s) o agrega una nueva.
      // Limitación conocida (cross-device, aceptada): el coalesce CAMBIA el ts de la muestra; si la
      // versión anterior YA se sincronizó, el merge (unión por (medida, ts)) conserva ambas — queda
      // una muestra "fantasma" intermedia en el otro dispositivo. Coste acotado (ventana de 60 s) y
      // sin pérdida de datos; arreglarlo exigiría identidad estable por muestra en todo el history.
      let history = s.history
      if (coalesced) {
        const series = (s.history[a.name] ?? []).slice()
        if (series.length && nowMs - series[series.length - 1].ts < COALESCE_MS) {
          series[series.length - 1] = { ts: nowMs, value, m: mNow }
        } else {
          series.push({ ts: nowMs, value, m: mNow })
        }
        history = { ...s.history, [a.name]: series }
      } else {
        history = pushHistory(s.history, [{ name: a.name, value, ts: nowMs, m: mNow }])
      }

      const meta = MEASURE_META[a.name]
      const profile = { ...s.profile }
      if (meta?.prof) {
        profile[meta.prof] = value as never
        if (profile.peso != null && profile.est != null) profile.bmi = bmiCalc(profile.peso, profile.est)
      }
      return {
        ...s,
        log: finalLog,
        measureValues: { ...s.measureValues, [a.name]: value },
        history,
        profile,
        // el perfil solo cambió si la medida espeja un campo de perfil (peso/est/grasa/músculo)
        syncMeta: meta?.prof ? stampUnits(s, mNow, 'profile') : s.syncMeta,
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
      const mNow = Date.now() // mtime de sync (el ts puede ser backfill)
      const samples: { name: string; value: number; ts: number; m?: number }[] = []
      const mv: Record<string, number> = { ...s.measureValues }
      if (a.values.peso != null) { samples.push({ name: 'Peso', value: a.values.peso, ts, m: mNow }); mv['Peso'] = a.values.peso }
      // Altura: estática (no cambia) → NO se graba como medida con timeline; vive en el perfil (est) para BMI/TDEE.
      if (a.values.est != null) { mv['Altura'] = a.values.est }
      if (a.values.grasa != null) { samples.push({ name: '% grasa', value: a.values.grasa, ts, m: mNow }); mv['% grasa'] = a.values.grasa }
      if (a.values.musculo != null) { samples.push({ name: '% músculo', value: a.values.musculo, ts, m: mNow }); mv['% músculo'] = a.values.musculo }
      if (profile.bmi != null) { samples.push({ name: 'IMC', value: profile.bmi, ts, m: mNow }); mv['IMC'] = profile.bmi }

      const parts: string[] = []
      if (a.values.peso != null) parts.push(`${a.values.peso} kg`)
      if (profile.bmi != null) parts.push(`IMC ${profile.bmi}`)
      if (a.values.grasa != null) parts.push(`${a.values.grasa}% grasa`)
      if (a.values.musculo != null) parts.push(`${a.values.musculo}% músculo`)

      const item: LogItem = {
        id: genId(), t: fmtTime(now), n: 'Cambio de medidas', u: parts.join(' · ') || 'actualizado',
        cat: '#1B8A7D', ic: 'medidas', type: 'medida', ts, m: mNow,
      }
      return {
        ...s,
        log: prependToLog(s.log, item),
        history: pushHistory(s.history, samples),
        measureValues: mv,
        profile,
        syncMeta: stampUnits(s, mNow, 'profile'),
        logged: true,
        // NO cerramos la hoja aquí: CambioMedidasSheet controla su propio cierre para alcanzar a mostrar el
        // delta vs. el registro anterior (~1.8s) antes de cerrar, igual que MedidaSheet. Único caller que abre
        // hoja vía esta acción = CambioMedidasSheet (v2); Baseline la usa en el flow (sheet ya null → no-op) y
        // sheets/Medidas.tsx (v1) es código muerto. (#62)
        toast: 'Medidas actualizadas',
        toastUndoId: null,
      }
    }

    // P1-1: borrar un registro de verdad + reconciliar history/measureValues
    case 'deleteLog': {
      const mNow = Date.now()
      let deleted: LogItem | undefined
      for (const g of s.log) { const it = g.items.find((i) => i.id === a.id); if (it) { deleted = it; break } }
      const log = s.log
        .map((g) => ({ ...g, items: g.items.filter((it) => it.id !== a.id) }))
        .filter((g) => g.items.length > 0)
      let history = s.history
      let measureValues = s.measureValues
      let profile = s.profile
      let protocols = s.protocols
      const removedSamples: { name: string; sample: MeasureSample }[] = []
      if (deleted?.type === 'medida') {
        // Acotar a la medida de ESTE registro: si n es un nombre de medida con serie, solo esa medida; si es
        // un combo ('Cambio de medidas', no está en history) → todas las del mismo ts. Evita borrar muestras
        // de OTRA medida que casualmente comparta el ts.
        const singleName = deleted.n && s.history[deleted.n] ? deleted.n : null
        history = {}
        for (const k of Object.keys(s.history)) {
          if (singleName && k !== singleName) { history[k] = s.history[k]; continue } // otra medida: intacta
          const keep: MeasureSample[] = []
          for (const sm of s.history[k]) {
            if (sm.ts === deleted.ts) removedSamples.push({ name: k, sample: sm })
            else keep.push(sm)
          }
          if (keep.length) history[k] = keep
        }
        // recalcular measureValues + profile + bmi desde el history (caché ya no diverge de la verdad)
        const affected = [...new Set(removedSamples.map((r) => r.name))]
        const rebuilt = rebuildMeasureCaches(history, s.measureValues, s.profile, affected)
        measureValues = rebuilt.measureValues
        profile = rebuilt.profile
      } else if (deleted?.type === 'dose' && (deleted.doseMg ?? 0) > 0 && deleted.product) {
        // devolver al vial los mg que esta dosis había consumido (usedMg solo crecía → "queda X mg" mentía)
        const proto = s.protocols[deleted.product]
        if (proto?.vialStock) {
          protocols = { ...s.protocols, [deleted.product]: { ...proto, vialStock: { ...proto.vialStock, usedMg: Math.max(0, proto.vialStock.usedMg - (deleted.doseMg ?? 0)) }, m: mNow } }
        }
      }
      return {
        ...s,
        log,
        history,
        measureValues,
        profile,
        protocols,
        // lápida: sin ella, el item borrado resucitaría al fusionar con otro dispositivo que aún lo tiene
        tombstones: deleted ? addTombstone(s.tombstones, 'logItems', deleted.id, mNow) : s.tombstones,
        logged: log.length > 0,
        sheet: null,
        deletedLogBuffer: deleted ? { item: deleted, samples: removedSamples } : null,
        toast: deleted ? 'Registro borrado' : s.toast,
        toastUndoId: deleted ? `__undo_delete__${deleted.id}` : null,
      }
    }

    // loop 77/137: deshacer el borrado (re-inserta el item + restaura muestras/stock de vial)
    case 'undoDeleteLog': {
      if (!s.deletedLogBuffer) return s
      const mNow = Date.now()
      const { item: buffered, samples } = s.deletedLogBuffer
      // revivir = edición más nueva que la lápida: re-estampa m (para ganarle a una lápida ya sincronizada)
      const item: LogItem = { ...buffered, m: mNow }
      const log = prependToLog(s.log, item)
      let history = s.history
      let measureValues = s.measureValues
      let profile = s.profile
      let protocols = s.protocols
      if (samples.length) {
        history = { ...s.history }
        for (const { name, sample } of samples) {
          history[name] = [...(history[name] ?? []), sample].sort((x, y) => x.ts - y.ts)
        }
        const affected = [...new Set(samples.map((r) => r.name))]
        const rebuilt = rebuildMeasureCaches(history, s.measureValues, s.profile, affected)
        measureValues = rebuilt.measureValues
        profile = rebuilt.profile
      } else if (item.type === 'dose' && (item.doseMg ?? 0) > 0 && item.product) {
        const proto = s.protocols[item.product]
        if (proto?.vialStock) {
          protocols = { ...s.protocols, [item.product]: { ...proto, vialStock: { ...proto.vialStock, usedMg: proto.vialStock.usedMg + (item.doseMg ?? 0) }, m: mNow } }
        }
      }
      return {
        ...s,
        log,
        history,
        measureValues,
        profile,
        protocols,
        // deshacer LIMPIA la lápida — si quedara, el merge re-mataría el item recién revivido
        tombstones: clearTombstone(s.tombstones, 'logItems', item.id),
        logged: true,
        deletedLogBuffer: null,
        toast: null,
        toastUndoId: null,
      }
    }

    // limpia el buffer de borrado (tras expirar el timer de 5s)
    case 'clearDeletedLogBuffer':
      return { ...s, deletedLogBuffer: null, toast: null, toastUndoId: null }

    // loop 77: editar la hora de un registro existente
    case 'editLogTime': {
      const now = new Date(a.ts)
      const mNow = Date.now() // mtime de sync: momento real de la edición (a.ts es la hora elegida)
      // Eliminar de su grupo actual
      let movedItem: LogItem | undefined
      let oldTs: number | undefined
      let log = s.log.map((g) => {
        const it = g.items.find((i) => i.id === a.id)
        if (it) {
          oldTs = it.ts
          movedItem = { ...it, ts: a.ts, t: fmtTime(now), m: mNow }
          return { ...g, items: g.items.filter((i) => i.id !== a.id) }
        }
        return g
      }).filter((g) => g.items.length > 0)
      if (!movedItem) return s
      // Re-insertar en el grupo correcto (puede ser el mismo día u otro)
      log = prependToLog(log, movedItem)
      // Si es una medida, mover también su muestra en history del ts viejo al nuevo (si no, el punto de la
      // gráfica se queda en la fecha vieja y deleteLog ya no lo reconcilia por ts → muestra huérfana).
      let history = s.history
      let measureValues = s.measureValues
      let profile = s.profile
      if (movedItem.type === 'medida' && oldTs != null && oldTs !== a.ts) {
        // acotar a la medida editada (no mover muestras de OTRA medida que comparta ts)
        const singleName = movedItem.n && s.history[movedItem.n] ? movedItem.n : null
        const affected: string[] = []
        history = {}
        for (const k of Object.keys(s.history)) {
          if (singleName && k !== singleName) { history[k] = s.history[k]; continue }
          let moved = false
          history[k] = s.history[k].map((sm) => { if (sm.ts === oldTs) { moved = true; return { ...sm, ts: a.ts, m: mNow } } return sm }).sort((x, y) => x.ts - y.ts)
          if (moved) affected.push(k)
        }
        // mover la muestra puede cambiar cuál es la última-por-ts → recomputar measureValues/profile/bmi.
        // Incluye el caso COMPUESTO 'Cambio de medidas' (no es clave de history, pero movió Peso/IMC/%grasa/%músculo que sí lo son).
        if (affected.length) {
          const rebuilt = rebuildMeasureCaches(history, s.measureValues, s.profile, affected)
          measureValues = rebuilt.measureValues
          profile = rebuilt.profile
        }
      }
      return { ...s, log, history, measureValues, profile }
    }

    case 'setSetting': {
      // Simetría con setLocalOnly: optar por el respaldo en la nube desactiva el modo solo local
      // (la decisión explícita más reciente gana; nunca quedan ambos activos con la UI mintiendo).
      if (a.key === 'cloudSync' && a.value === true) {
        return { ...s, localOnly: false, settings: { ...s.settings, cloudSync: true } }
      }
      // los campos SOLO-de-dispositivo no viajan en el payload → tocarlos no debe volver "más nueva"
      // la unidad 'settings' local (pisaría cambios reales del otro dispositivo en el merge)
      const deviceOnly = a.key === 'pinEnabled' || a.key === 'pinHash' || a.key === 'cloudSync' || a.key === 'consentActive' || a.key === 'consentVersion'
      return { ...s, settings: { ...s.settings, [a.key]: a.value }, syncMeta: deviceOnly ? s.syncMeta : stampUnits(s, Date.now(), 'settings') }
    }
    case 'setThemeMode': {
      // 'light'/'dark' derivan darkMode para compat con código que aún lee settings.darkMode
      const darkMode = a.mode === 'dark' ? true : a.mode === 'light' ? false : s.settings.darkMode
      return { ...s, settings: { ...s.settings, themeMode: a.mode, darkMode }, syncMeta: stampUnits(s, Date.now(), 'settings') }
    }
    case 'setName':
      return { ...s, profile: { ...s.profile, name: a.name.trim() || null }, syncMeta: stampUnits(s, Date.now(), 'profile') }
    case 'setProfileFields':
      return { ...s, profile: { ...s.profile, ...a.patch }, syncMeta: stampUnits(s, Date.now(), 'profile') }
    case 'setReminderTime': {
      // #F3: actualiza SOLO el protocolo activo (el que muestra Ajustes), no todos. Antes homogeneizaba
      // todos → pisaba las horas per-producto fijadas en ProtocoloEditSheet. La hora per-producto es la
      // fuente de verdad; cada protocolo se edita por separado (o cambiando el activo).
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) return s
      const target = a.product ?? s.activeProduct
      if (!target || !s.protocols[target]) return s
      return syncActive({ ...s, protocols: { ...s.protocols, [target]: { ...s.protocols[target], reminderTime: a.time, m: Date.now() } } })
    }
    case 'setRescueWindow':
      return { ...s, settings: { ...s.settings, rescueWindowMin: a.minutes }, syncMeta: stampUnits(s, Date.now(), 'settings') }

    case 'setScale':
      // scale viaja junto con la unidad 'settings' en el merge (es un ajuste de usuario fuera del objeto settings)
      return { ...s, scale: a.scale, syncMeta: stampUnits(s, Date.now(), 'settings') }
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

    // Restaurar respaldo COMPLETO: antes el import solo recreaba productos + perfil y perdía log/nutrition/
    // history/measureValues/recon/aliases/settings. Ahora reemplaza todo el estado (defaults para campos
    // faltantes vía initialState) y resincroniza cachés.
    case 'replaceState': {
      // #F4: sanea el respaldo (descarta log items/protocolos inválidos) ANTES de hidratar.
      const { state: clean, dropped } = sanitizeImport(a.state)
      // hydrate aplica las migraciones del respaldo (agua vasos→ml, reconstrucción de protocols desde
      // protocol/importedProducts, estampado de dosis legado) y resincroniza cachés. Luego fijamos lo efímero.
      return {
        ...hydrate({ ...initialState, ...clean } as AppState),
        todayTs: startOfDay(new Date()).getTime(), // 'hoy' = ahora, no el día en que se exportó el respaldo
        screen: 's-app',
        sheet: null,
        toast: dropped > 0 ? `Respaldo restaurado · ${dropped} entrada(s) inválida(s) omitida(s)` : 'Respaldo restaurado correctamente',
        toastUndoId: null,
      }
    }

    case 'toast':
      return { ...s, toast: a.msg, toastUndoId: null } // un toast normal no trae acción de deshacer

    case 'setKpiOrder':
      return { ...s, kpiOrder: a.order.slice(0, 4), syncMeta: stampUnits(s, Date.now(), 'goals') }

    // ── Nuevas acciones ────────────────────────────────────────────────────────

    // editLog: muta un LogItem existente por id sin cambiar id/ts.
    // Si es una dosis y value!=null, también actualiza productDoses[product].
    case 'editLog': {
      const mNow = Date.now()
      let updatedProductDoses = s.productDoses
      let updatedProtocols = s.protocols
      const log = s.log.map((g) => ({
        ...g,
        items: g.items.map((it) => {
          if (it.id !== a.id) return it
          const patched: LogItem = { ...it, m: mNow }
          if (a.patch.value !== undefined) patched.value = a.patch.value
          if (a.patch.unit !== undefined) patched.unit = a.patch.unit
          if (a.patch.doseMg !== undefined) {
            patched.doseMg = a.patch.doseMg ?? undefined
            // mover el stock del vial por el delta de mg (si no, el "queda X mg" se desfasa al editar la dosis)
            if (it.type === 'dose' && it.product) {
              const delta = (a.patch.doseMg ?? 0) - (it.doseMg ?? 0)
              const proto = updatedProtocols[it.product]
              if (proto?.vialStock && delta !== 0) {
                updatedProtocols = { ...updatedProtocols, [it.product]: { ...proto, vialStock: { ...proto.vialStock, usedMg: Math.max(0, proto.vialStock.usedMg + delta) }, m: mNow } }
              }
            }
          }
          if (a.patch.note !== undefined) patched.note = a.patch.note ?? undefined
          // EFECTO ADVERSO: corregir la severidad después de registrarla (debt-122). Solo colorea el
          // badge — sin acoplamiento con history/vial, y sin tocar la rama exclusiva de doseMg de abajo.
          if (a.patch.severity !== undefined && it.type === 'efecto-adverso') {
            patched.severity = a.patch.severity ?? undefined
          }
          // DOSIS: reconstruir 'u' (diario/charts/chip Repetir parsean este string, no value/unit) + recordar dosis
          if (it.type === 'dose' && (a.patch.value !== undefined || a.patch.unit !== undefined)) {
            const v = a.patch.value !== undefined ? a.patch.value : (it.value ?? null)
            const u = (a.patch.unit !== undefined ? a.patch.unit : it.unit) ?? ''
            patched.u = (it.product ?? '') + (v != null ? ` · ${v} ${u}` : '')
            if (it.product && v != null) updatedProductDoses = { ...updatedProductDoses, [it.product]: { value: v, unit: u } }
            // Recalcular doseMg al editar valor/unidad (antes quedaba stale → vialStock y barra de presencia PK
            // se desfasaban). Aplica el delta a vialStock.usedMg. doseToMg null (UI/mL sin recon) → conserva el
            // doseMg anterior. GUARD a.patch.doseMg === undefined: si el caller YA mandó doseMg (p.ej. DayDetail
            // v1), la rama de arriba ya ajustó usedMg+doseMg → no recalculamos aquí (evita doble-conteo).
            if (it.product && v != null && a.patch.doseMg === undefined) {
              const recon = s.productRecon[it.product]
              const newDoseMg = doseToMg(v, u, recon?.vialMg, recon?.aguaMl) ?? it.doseMg
              patched.doseMg = newDoseMg
              const delta = (newDoseMg ?? 0) - (it.doseMg ?? 0)
              const proto = updatedProtocols[it.product]
              if (proto?.vialStock && delta !== 0) {
                updatedProtocols = { ...updatedProtocols, [it.product]: { ...proto, vialStock: { ...proto.vialStock, usedMg: Math.max(0, proto.vialStock.usedMg + delta) }, m: mNow } }
              }
            }
          }
          // MEDIDA: reconstruir 'u' + marcar para reconciliar history/measureValues/profile fuera del map
          if (it.type === 'medida' && a.patch.value != null && it.n) {
            patched.u = fmtMeasureValue(it.n, a.patch.value) + (patched.note ? ' · ' + patched.note : '')
          }
          return patched
        }),
      }))
      // reconciliar la medida editada: mover el valor de la muestra en history + recomputar measureValues/profile.
      // Buscamos el item por id en el log ORIGINAL (n/ts no cambian al editar) para evitar mutar estado en el closure.
      let history = s.history
      let measureValues = s.measureValues
      let profile = s.profile
      const editedItem = a.patch.value != null ? s.log.flatMap((g) => g.items).find((it) => it.id === a.id) : undefined
      if (editedItem && editedItem.type === 'medida' && editedItem.n && a.patch.value != null && s.history[editedItem.n]) {
        const name = editedItem.n, oldTs = editedItem.ts, newValue = a.patch.value
        // m: la edición del valor es lo que decide el conflicto (name, ts) entre dispositivos
        history = { ...s.history, [name]: s.history[name].map((sm) => (sm.ts === oldTs ? { ...sm, value: newValue, m: mNow } : sm)) }
        const rebuilt = rebuildMeasureCaches(history, s.measureValues, s.profile, [name])
        measureValues = rebuilt.measureValues
        profile = rebuilt.profile
      }
      return {
        ...s, log, productDoses: updatedProductDoses, protocols: updatedProtocols, history, measureValues, profile,
        syncMeta: updatedProductDoses !== s.productDoses ? stampUnits(s, mNow, 'productDoses') : s.syncMeta,
      }
    }

    case 'setCalcDraft':
      return { ...s, calcDraft: a.draft }

    case 'setRegistrarDraft':
      return { ...s, registrarDraft: a.draft }

    case 'loadRemoteState': {
      // Restaurar desde la nube: MISMAS defensas que el import de archivo (#F4/#46) — sanea entradas
      // inválidas y rechaza blobs vacíos (una fila '{}' en la nube no debe borrar lo local). El pinHash
      // no se toca aquí: el push ya lo excluye y el restore lo re-inyecta local río arriba (Ajustes).
      // El reducer es DUEÑO del toast de resultado (éxito limpio / N omitidas / vacío): Ajustes no
      // debe re-toastear encima, o taparía el aviso de entradas descartadas.
      const { state: clean, dropped } = sanitizeImport(a.state)
      if (!importHasData(clean)) return { ...s, toast: 'El respaldo en la nube está vacío — no se aplicó' }
      // Fusiona el blob saneado sobre los defaults y rehidrata (misma ruta que loadState del provider
      // → tan seguro como la carga inicial). Conserva 'hoy' y descarta lo efímero.
      const merged = {
        ...initialState,
        ...clean,
        sheet: null,
        sheetArg: null,
        toast: dropped > 0 ? `Restaurado · ${dropped} entrada(s) inválida(s) omitida(s)` : 'Restaurado desde la nube',
        toastUndoId: null,
        deletedLogBuffer: null,
        todayTs: s.todayTs,
      } as AppState
      return hydrate(merged)
    }

    // merge por registro (Opción C): aplica el estado fusionado — SILENCIOSO (el sync de fondo no toastea)
    case 'applyMerged':
      return applyMerged(s, a.merged)

    // saveRecon: agrega o fusiona (por label) una reconstitución guardada
    case 'saveRecon': {
      const idx = s.savedRecons.findIndex((r) => r.label.toLowerCase() === a.entry.label.toLowerCase())
      const entry: SavedRecon = { id: idx >= 0 ? s.savedRecons[idx].id : genId(), ...a.entry, m: Date.now() }
      const savedRecons = idx >= 0
        ? s.savedRecons.map((r, i) => (i === idx ? entry : r))
        : [...s.savedRecons, entry]
      return { ...s, savedRecons }
    }

    case 'deleteRecon':
      // lápida: sin ella, la reconstitución borrada resucitaría al fusionar con otro dispositivo
      return { ...s, savedRecons: s.savedRecons.filter((r) => r.id !== a.id), tombstones: addTombstone(s.tombstones, 'savedRecons', a.id, Date.now()) }

    // setMeasureGoal: establece o elimina la meta de una medida. Eliminar deja lápida mapKeys
    // (sin ella, la unión de claves del merge la resucitaría); re-establecer la limpia.
    case 'setMeasureGoal': {
      const measureGoals = { ...s.measureGoals }
      const mNow = Date.now()
      let tombstones = s.tombstones
      if (a.value == null) {
        delete measureGoals[a.name]
        tombstones = addTombstone(tombstones, 'mapKeys', `measureGoals:${a.name}`, mNow)
      } else {
        measureGoals[a.name] = a.value
        tombstones = clearTombstone(tombstones, 'mapKeys', `measureGoals:${a.name}`)
      }
      return { ...s, measureGoals, tombstones, syncMeta: stampUnits(s, mNow, 'measureGoals') }
    }

    // setMeasureReminder: establece o elimina el recordatorio de una medida (intervalo en días);
    // misma disciplina de lápida mapKeys que setMeasureGoal
    case 'setMeasureReminder': {
      const measureReminders = { ...s.measureReminders }
      const mNow = Date.now()
      let tombstones = s.tombstones
      if (a.intervalDays == null) {
        delete measureReminders[a.name]
        tombstones = addTombstone(tombstones, 'mapKeys', `measureReminders:${a.name}`, mNow)
      } else {
        measureReminders[a.name] = a.intervalDays
        tombstones = clearTombstone(tombstones, 'mapKeys', `measureReminders:${a.name}`)
      }
      return { ...s, measureReminders, tombstones, syncMeta: stampUnits(s, mNow, 'measureReminders') }
    }

    // setProductAlias: alias personalizado por producto; null = elimina el alias (con lápida mapKeys)
    case 'setProductAlias': {
      const productAliases = { ...s.productAliases }
      const mNow = Date.now()
      let tombstones = s.tombstones
      if (a.alias == null) {
        delete productAliases[a.product]
        tombstones = addTombstone(tombstones, 'mapKeys', `productAliases:${a.product}`, mNow)
      } else {
        productAliases[a.product] = a.alias
        tombstones = clearTombstone(tombstones, 'mapKeys', `productAliases:${a.product}`)
      }
      return { ...s, productAliases, tombstones, syncMeta: stampUnits(s, mNow, 'productAliases') }
    }

    // startFast: inicia un ayuno marcando el timestamp actual
    case 'startFast': {
      const mNow = Date.now()
      return { ...s, fastStartTs: mNow, syncMeta: stampUnits(s, mNow, 'fastStartTs') }
    }

    // endFast: inserta un LogItem type:'ayuno' con la duración en horas y limpia fastStartTs
    case 'endFast': {
      if (s.fastStartTs == null) return s
      const now = new Date()
      const durH = parseFloat(((now.getTime() - s.fastStartTs) / 3600000).toFixed(2))
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: 'Ayuno completado',
        u: `${durH} h`,
        cat: '#6366F1',
        ic: 'ayuno',
        type: 'ayuno',
        ts: now.getTime(),
        m: now.getTime(),
        value: durH,
        unit: 'h',
      }
      return {
        ...s,
        log: prependToLog(s.log, item),
        fastStartTs: null,
        syncMeta: stampUnits(s, now.getTime(), 'fastStartTs'),
        toast: `Ayuno de ${durH} h registrado`,
        toastUndoId: item.id,
      }
    }

    // setVialStock: abre un vial NUEVO de un producto (mg totales). #28: usedMg se REINICIA a 0
    // (es un vial fresco — antes arrastraba el usado del vial anterior, mostrando "queda menos" de lo real)
    // y openedAt se fija siempre (a.openedAt o ahora) para no perder la fecha de apertura al editar.
    case 'setVialStock': {
      const proto = s.protocols[a.product]
      if (!proto) return s
      return syncActive({
        ...s,
        protocols: {
          ...s.protocols,
          [a.product]: {
            ...proto,
            vialStock: { totalMg: a.totalMg, usedMg: 0, openedAt: a.openedAt ?? Date.now() },
            m: Date.now(),
          },
        },
      })
    }

    // setPurchase: registra datos de compra en el protocolo del producto
    case 'setPurchase': {
      const proto = s.protocols[a.product]
      if (!proto) return s
      return syncActive({
        ...s,
        protocols: {
          ...s.protocols,
          [a.product]: {
            ...proto,
            purchasedMg: a.purchasedMg,
            purchasedAt: a.purchasedAt,
            ...(a.cost != null ? { purchaseCost: a.cost } : {}),
            m: Date.now(),
          },
        },
      })
    }

    // logAdverseEffect: inserta un LogItem type:'efecto-adverso' con severity y descripción
    case 'logAdverseEffect': {
      const now = a.ts ? new Date(a.ts) : new Date()
      const item: LogItem = {
        id: genId(),
        t: fmtTime(now),
        n: 'Efecto adverso',
        u: a.description,
        cat: '#EF4444',
        ic: 'efecto-adverso',
        type: 'efecto-adverso',
        ts: now.getTime(),
        m: Date.now(),
        severity: a.severity,
        ...(a.product ? { product: a.product } : {}),
        // #103: la descripción ya vive en `u`; no duplicarla en `note` (el Diario la mostraba dos veces)
      }
      return {
        ...s,
        log: prependToLog(s.log, item),
        toast: 'Efecto adverso registrado',
        toastUndoId: item.id,
      }
    }

    // archiveProtocol / reactivateProtocol: oculta o restaura un protocolo del flujo activo
    // archivar es una EDICIÓN normal del protocolo (m nuevo), NUNCA una lápida: el historial se conserva
    case 'archiveProtocol': {
      const proto = s.protocols[a.product]
      if (!proto) return s
      const mNow = Date.now()
      return syncActive({
        ...s,
        protocols: { ...s.protocols, [a.product]: { ...proto, archived: true, archivedAt: mNow, m: mNow } },
      })
    }
    case 'reactivateProtocol': {
      const proto = s.protocols[a.product]
      if (!proto) return s
      return syncActive({
        ...s,
        protocols: { ...s.protocols, [a.product]: { ...proto, archived: false, archivedAt: null, m: Date.now() } },
      })
    }

    case 'dismissFirstDoseCelebration':
      return { ...s, showFirstDoseCelebration: false }

    // unlockAchievement: añade el id al array si no está ya
    case 'unlockAchievement':
      return s.achievements.includes(a.id) ? s : { ...s, achievements: [...s.achievements, a.id] }

    case 'setDayNote':
      return { ...s, dayNotes: { ...s.dayNotes, [a.dateKey]: a.text }, syncMeta: stampUnits(s, Date.now(), 'dayNotes') }

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
    d = addDays(d, 1) // caminata por día LOCAL, no +86 400 000 ms (DST-segura, debt-69)
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

export interface DoseTally { taken: number; missed: number; upcoming: number }

// núcleo ÚNICO de conteo de adherencia: cuenta dosis de todos los productos en [fromMs, toMs] (días, inclusive).
// Lo consumen adherence()/adherenceMonth() (store) y weekAdherencePct()/dayAdherencePct() (calendar) → un solo
// motor de adherencia para toda la app (antes calendar.ts tenía su propia copia divergente).
export function tallyDoses(s: AppState, fromMs: number, toMs: number, now: Date): DoseTally {
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
      // si hay un skip intencional ese día para este producto → excluir de due/missed/upcoming
      const skipped = !!g?.items.some((it) => it.type === 'skip' && it.product === t.product)
      if (skipped && !took) continue // skip intencional sin toma real: ni cumplida ni debida (la toma real SIEMPRE gana)
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
  return toStat(tallyDoses(s, addDays(today, -(days - 1)).getTime(), today, now))
}

// mes calendario actual: TODAS las dosis que tocarían en el mes (incl. futuras) — para Inicio
export function adherenceMonth(s: AppState, now: Date = new Date()): AdherenceStat | null {
  // #33: NO depender de s.protocol (producto "activo" único). tallyDoses cuenta TODOS los protocolos
  // activos; basta con que exista al menos uno, si no el anillo desaparecía teniendo protocolos activos.
  const activeProtos = Object.values(s.protocols).filter((p) => !p.archived)
  if (activeProtos.length === 0) return null
  const today = startOfDay(new Date(s.todayTs))
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  // #9: no penalizar desde el día 1 del mes si el protocolo empezó después (evita arrancar en 8%).
  // Tomamos el inicio MÁS TEMPRANO entre los protocolos activos y lo limitamos al mes en curso.
  const starts = Object.values(s.protocols).filter((p) => !p.archived).map((p) => p.startDate)
  const earliest = starts.length ? Math.min(...starts) : monthStart
  const from = Math.max(monthStart, startOfDay(new Date(earliest)).getTime())
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
    d = addDays(d, 1) // caminata por día LOCAL, no +86 400 000 ms (DST-segura, debt-69)
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
  return Object.values(s.protocols).filter((p) => !p.archived).map((p) => ({
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
