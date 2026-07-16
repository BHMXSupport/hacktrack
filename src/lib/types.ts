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
  email?: string | null        // dirección de correo del usuario
  avatarDataUrl?: string | null // data URL del avatar (opcional, se guarda fuera del estado persistido si es grande)
  metaFechaMs?: number | null  // fecha objetivo para alcanzar metaPesoKg (epoch ms)
}

// muestra histórica de una medida/KPI (para el dashboard de progreso)
export interface MeasureSample {
  ts: number
  value: number
  m?: number   // mtime de sync (última edición); ausente → cae a ts (registros legados)
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
  note?: string | null  // nota opcional de la comida
  m?: number            // mtime de sync (última edición); ausente → cae a ts (comidas legadas)
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
  m?: number                           // mtime de sync; ausente → 0 (legado)
}

// Día de nutrición ('YYYY-MM-DD' → hidratación + comidas). El mtime `m` del DÍA marca el bucket
// tocado; cada COMIDA lleva además su propio `m` — el merge las fusiona POR ID ESTABLE (Meal.id),
// con LWW por comida y lápidas (tombstones.meals). El agua se fusiona con max().
export interface NutritionDay {
  water: number   // mililitros del día
  meals: Meal[]
  m?: number      // mtime de sync del bucket; ausente → 0 (legado)
}

export type LogItemType = 'dose' | 'medida' | 'none' | 'skip' | 'efecto-adverso' | 'ayuno'

export type AdverseSeverity = 'leve' | 'moderado' | 'severo'
export type UnitSystem = 'metric' | 'imperial'
export type FontScale = 'sm' | 'md' | 'lg'
export type AppLang = 'es' | 'en'

export interface SavedRecon {
  id: string
  label: string
  vialMg: number
  aguaMl: number
  createdAt: number
  m?: number   // mtime de sync; ausente → 0 (legado)
}

export type RangeFilter = 7 | 30 | 90 | 'all'

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
  late?: boolean   // (solo type='skip') marca la ocurrencia programada como TOMADA TARDE — la dosis real se registró en otro día (hoy). Neutral para adherencia; se muestra "Tomada tarde", no "Saltada".
  note?: string    // nota libre del usuario (≤120 chars) — dato observacional, no consejo médico (loop 138)
  effect?: string  // efecto/síntoma auto-observado post-dosis (dato personal del usuario, no claim de eficacia) (loop 139)
  effectIntensity?: number  // intensidad 0–100 del efecto auto-observado (opcional; se muestra en Diario / última toma)
  value?: number | null        // valor numérico asociado (p.ej. duración de ayuno en horas, score adverso)
  unit?: string | null         // unidad del value (p.ej. 'h', 'mg')
  severity?: AdverseSeverity   // severidad de efecto adverso (solo type='efecto-adverso')
  photoUrl?: string | null     // URL de foto adjunta (opcional)
  m?: number                   // mtime de sync (última edición); ausente → cae a ts (registros legados)
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
  vialStock?: { totalMg: number; usedMg: number; openedAt?: number } | null  // stock del vial abierto (mg)
  purchaseCost?: number | null      // costo de compra del último lote (en la moneda del usuario)
  purchasedMg?: number | null       // mg comprados en el último lote
  purchasedAt?: number | null       // epoch ms de la fecha de compra del último lote
  archived?: boolean                // protocolo archivado (oculto del flujo activo, conservado en historial)
  archivedAt?: number | null        // epoch ms en que se archivó
  cadenceConfirmed?: boolean        // el usuario ya confirmó/ajustó la cadencia sugerida del catálogo (oculta el banner)
  m?: number                        // mtime de sync (última edición); ausente → 0 (legado)
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
  cloudSync?: boolean         // backend opt-in: respaldar/sincronizar el estado en la nube (Supabase). Default off.
  /** Ventana de rescate (min) tras el recordatorio principal. 0 = desactivado.
   *  Si el usuario no registra dentro de esta ventana se dispara un segundo aviso. */
  rescueWindowMin?: 0 | 15 | 30 | 60
  weeklySummary: boolean
  dailySummary?: boolean      // resumen diario ("hoy tienes programados …" de todos los protocolos activos)
  summaryTime?: string        // 'HH:MM' hora del resumen diario (default '08:00')
  emailNotices: boolean
  consentVersion: string
  consentActive: boolean
  premium: boolean            // suscripción Plus (gating de Alimentación + Resumen premium)
  unitSystem?: UnitSystem     // sistema de unidades: 'metric' (default) | 'imperial'
  fontScale?: FontScale       // escala de fuente: 'sm' | 'md' (default) | 'lg'
  lang?: AppLang              // idioma de la app: 'es' (default) | 'en'
  avatarColor?: string | null // color de fondo del avatar generado (hex)
  trialEndsAt?: number | null // epoch ms en que expira el período de prueba Premium
  pinHash?: string | null     // hash del PIN (SHA-256 hex); null = sin PIN configurado
  secondReminderMin?: number | null // minutos antes de la siguiente toma para el segundo recordatorio; null = desactivado
  highContrast?: boolean      // accesibilidad: sube el contraste del texto tenue (AA+) sin cambiar tamaños
  simpleMode?: boolean        // modo simple: oculta Vida/Comida/Semana de la navegación
}

export type Sexo = 'H' | 'M'
export type Actividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy-activo'

// ── Metadatos de sincronización (merge por registro, Opción C) ────────────────
// mtimes a nivel de UNIDAD LWW (las que no tienen mtime por registro): 'profile' | 'settings'
// (incluye scale) | 'goals' (curGoal/secondaryGoals/selectedMeasures/kpiOrder/macroGoals/kcalGoal) |
// 'activeProduct' | 'fastStartTs' | y los mapas por clave ('measureGoals', 'measureReminders',
// 'productAliases', 'productDoses', 'productRecon', 'lastInjectionSite', 'dayNotes'), cuyo mtime
// de mapa resuelve conflictos de VALOR en claves presentes en ambos lados.
export interface SyncMeta {
  units: Record<string, number>
}

// Lápidas de borrado (id/clave → epoch ms del borrado). Sin lápida, un registro borrado en un
// dispositivo resucitaría al fusionar con otro que aún lo tiene. Se recolectan (GC) al fusionar
// cuando son más viejas que el corte que pasa el caller (90 días).
// `meals`: por Meal.id (borrado de comidas). `mapKeys`: borrados de clave en mapas por-clave,
// con clave compuesta `${mapa}:${clave}` (p.ej. 'measureGoals:Peso', 'productAliases:BPC 157') —
// sin ella, mergePlainMap une claves y una clave borrada resucitaría desde el otro lado.
export interface Tombstones {
  logItems: Record<string, number>
  protocols: Record<string, number>
  savedRecons: Record<string, number>
  foodLibrary: Record<string, number>
  meals: Record<string, number>
  mapKeys: Record<string, number>
}
