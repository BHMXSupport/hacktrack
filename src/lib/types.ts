// Hacktrack — tipos centrales (port del prototipo, con los fixes del audit)

export type Category =
  | 'Metabolismo'
  | 'Recuperación'
  | 'Cognitivo'
  | 'Piel'
  | 'Anti-Aging'
  | 'Crecimiento'
  | 'Reproductivo'
  | 'Explorar'

export type CadenceType =
  | 'diaria'        // cada día
  | 'lv'            // lunes a viernes
  | 'semanal'       // una vez por semana, día fijo
  | 'cadaN'         // cada N días
  | 'ciclo'         // on/off
  | 'por-demanda'   // por uso, sin días fijos

export interface PeptideEntry {
  cat: Category
  type: CadenceType
  weekday?: number    // 0=Dom…6=Sáb (solo 'semanal')
  n?: number          // intervalo (solo 'cadaN')
  on?: number         // días on (solo 'ciclo')
  off?: number        // días off (solo 'ciclo')
  phases?: number     // nº de fases de titulación (2–5)
  phaseWeeks?: number // semanas por fase
  howto?: string
}

export type MeasureKind = 'num' | 'scale'

export interface MeasureMeta {
  kind: MeasureKind
  unit?: string            // para kind='num'
  max?: number             // para kind='scale'
  prof?: keyof Profile     // enlaza a campo de perfil
}

export interface Profile {
  name: string | null      // nombre del usuario (personalización)
  peso: number | null
  est: number | null       // altura cm
  grasa: number | null     // % grasa
  musculo: number | null   // % masa musculoesquelética
  bmi: number | null       // derivado, nunca tecleado
}

// muestra histórica de una medida/KPI (para el dashboard de progreso)
export interface MeasureSample {
  ts: number
  value: number
}

export type LogItemType = 'dose' | 'medida' | 'none'

export interface LogItem {
  id: string
  t: string        // hora, ej. '9:00 PM'
  n: string        // nombre: 'Dosis registrada' | nombre de la medida
  u: string        // valor: 'Retatrutide · 2 mg' | '82.4 kg' | '4 / 5'
  cat: string      // color hex del icono
  ic: string       // id del glyph
  type: LogItemType
  ts: number       // timestamp epoch (ms) del registro real
  product?: string // producto de la dosis (para adherencia por producto)
}

export interface LogGroup {
  dateKey: string  // 'YYYY-MM-DD' local — identidad ESTABLE (no la etiqueta relativa, fix red-team)
  items: LogItem[]
}

// P0-3: la cadencia es la única fuente de verdad, persistida en el protocolo del usuario.
// Modos editables en la hoja de dosis: dia | sem | mes | uso.
// cadaN | ciclo provienen del preset del catálogo y diaToca() los respeta sin degradar a "diario".
export type CadMode = 'dia' | 'sem' | 'mes' | 'uso'
export type CadenceMode = CadMode | 'cadaN' | 'ciclo'

export interface UserCadence {
  mode: CadenceMode
  days: boolean[]      // 7 elementos (mode='dia'), orden WDS: L Ma Mi J V S D
  every: number        // mode='sem'|'mes'
  semDays: boolean[]   // 7 elementos (mode='sem')
  n?: number           // mode='cadaN'
  on?: number          // mode='ciclo'
  off?: number         // mode='ciclo'
}

export interface UserProtocol {
  product: string
  cadence: UserCadence
  progOn: boolean
  progN: number
  curPhase: number
  phaseDoses?: (number | null)[]  // mg por fase de titulación (el usuario la define; la app no prescribe)
  startDate: number    // epoch ms — cuándo empieza el protocolo
  endDate?: number | null // epoch ms — cuándo termina (opcional; null = indefinido)
  reminderTime: string // 'HH:MM' hora del recordatorio/toma (para cuenta regresiva)
}

// Capacidad del barril de la jeringa en unidades (todas escala U-100): 0.3 mL=30U, 0.5 mL=50U, 1 mL=100U
export type SyringeScale = 30 | 50 | 100

export interface UserSettings {
  pinEnabled: boolean
  darkMode: boolean
  remindersEnabled: boolean   // recordatorios locales de toma (Notification API)
  weeklySummary: boolean
  emailNotices: boolean
  consentVersion: string
  consentActive: boolean
}
