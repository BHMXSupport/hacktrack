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
  down?: boolean           // true = la dirección deseada es BAJAR (peso, dolor, náusea) — para tinte de tendencia
}

export interface Profile {
  name: string | null      // nombre del usuario (personalización)
  peso: number | null
  est: number | null       // altura cm
  grasa: number | null     // % grasa
  musculo: number | null   // % masa musculoesquelética
  bmi: number | null       // derivado, nunca tecleado
  edad?: number | null     // años (para TDEE)
  sexo?: Sexo | null       // H|M (para TDEE)
  actividad?: Actividad | null // nivel de actividad (para TDEE)
  metaPesoKg?: number | null   // peso objetivo (para proyección)
}

// muestra histórica de una medida/KPI (para el dashboard de progreso)
export interface MeasureSample {
  ts: number
  value: number
}

// Alimentación: comida registrada (kcal + macros opcionales) y comida favorita (1-tap)
export interface Meal {
  id: string
  kcal: number
  ts: number
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  label?: string | null
  portion?: number      // multiplicador usado (1, 1.5…)
  favId?: string        // favorito de origen (para aprendizaje)
}
export interface FoodFav {
  id: string
  label: string
  kcal: number
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  usoCount: number
  hourBucket?: Record<string, number> // uso por franja horaria (predicción)
  defaultMultiplier?: number           // porción aprendida
}

export type LogItemType = 'dose' | 'medida' | 'none' | 'skip'

// Sitios de inyección en rotación fija (abdomen → muslo → glúteo, izq → der)
export type InjectionSite =
  | 'abdomen-izq'
  | 'abdomen-der'
  | 'muslo-izq'
  | 'muslo-der'
  | 'gluteo-izq'
  | 'gluteo-der'

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
  doseMg?: number  // dosis en mg CANÓNICOS (convertida desde UI/mL con la reconstitución) — para vida media/presencia
  site?: InjectionSite // sitio de inyección elegido por el usuario (loop 140)
  note?: string    // nota libre del usuario (≤120 chars) — dato observacional, no consejo médico (loop 138)
  effect?: string  // efecto/síntoma auto-observado post-dosis (dato personal del usuario, no claim de eficacia) (loop 139)
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

// ── Reconstitución de vial con fecha de mezcla (loop 166/167) ────────────────
// productRecon[product] = { vialMg, aguaMl, reconDate? }
// reconDate: epoch ms del momento en que se reconstituyó el vial (lo setea el primer logDose con recon).
// Retrocompatible: registros previos sin reconDate simplemente no muestran caducidad ni nivel.
export interface ProductReconEntry {
  vialMg: number
  aguaMl: number
  reconDate?: number   // epoch ms — cuándo se reconstituyó el vial (guía de manejo, no consejo médico)
}

// Capacidad del barril de la jeringa en unidades (todas escala U-100): 0.3 mL=30U, 0.5 mL=50U, 1 mL=100U
export type SyringeScale = 30 | 50 | 100

export type ThemeMode = 'auto' | 'light' | 'dark'

export interface UserSettings {
  pinEnabled: boolean
  darkMode: boolean
  themeMode?: ThemeMode       // 'auto' = oscuro 18–7 h | 'light' | 'dark' | undefined → usa darkMode (compat)
  remindersEnabled: boolean   // recordatorios locales de toma (Notification API)
  weeklySummary: boolean
  emailNotices: boolean
  consentVersion: string
  consentActive: boolean
  premium: boolean            // suscripción Plus (gating de Alimentación + Resumen premium)
}

export type Sexo = 'H' | 'M'
export type Actividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy-activo'
