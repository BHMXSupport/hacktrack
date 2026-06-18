// Analítica de Alimentación + Resumen (features premium). Todo es OBSERVACIONAL sobre los datos del usuario:
// nunca causalidad, nunca se nombra un péptido junto a un resultado de peso, sin consejo médico.
import type { AppState } from './store'
import { isoKey, mealSlot, trackedProtocols, productsOnDay } from './store'
import type { MeasureSample, FoodFav } from './types'
import { PEPTIDES, MEASURES_BY, MEASURE_META, CATEGORY_COLOR } from './catalog'

const DAY = 86_400_000

export interface DayMacros { protein: number; carbs: number; fat: number; hasMacros: boolean }

export function dayKcal(meals: { kcal: number }[]): number {
  return meals.reduce((s, m) => s + m.kcal, 0)
}
export function dayMacros(meals: { protein?: number | null; carbs?: number | null; fat?: number | null }[]): DayMacros {
  let protein = 0, carbs = 0, fat = 0, hasMacros = false
  for (const m of meals) {
    if (m.protein != null) { protein += m.protein; hasMacros = true }
    if (m.carbs != null) { carbs += m.carbs; hasMacros = true }
    if (m.fat != null) { fat += m.fat; hasMacros = true }
  }
  return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), hasMacros }
}

// Producto ancla: el de inicio más antiguo (para nombrar el protocolo en las tarjetas).
export function anchorProduct(s: AppState): string | null {
  let best: { product: string; ts: number } | null = null
  for (const [product, p] of Object.entries(s.protocols)) {
    if (!best || p.startDate < best.ts) best = { product, ts: p.startDate }
  }
  return best?.product ?? null
}

// Fecha de inicio del protocolo: el inicio más antiguo registrado.
export function protocolStartTs(s: AppState): number | null {
  const starts = Object.values(s.protocols).map((p) => p.startDate)
  if (starts.length) return Math.min(...starts)
  let earliest: number | null = null
  for (const g of s.log) for (const it of g.items) if (it.type === 'dose' && (earliest == null || it.ts < earliest)) earliest = it.ts
  return earliest
}

function sortedAsc(samples: MeasureSample[] | undefined): MeasureSample[] {
  return [...(samples ?? [])].sort((a, b) => a.ts - b.ts)
}
// valor de la serie más cercano a (o el primero a partir de) un instante — la "basal" al inicio
function baselineAt(samples: MeasureSample[], ts: number): MeasureSample | null {
  if (!samples.length) return null
  let best = samples[0], bestD = Math.abs(samples[0].ts - ts)
  for (const sm of samples) { const d = Math.abs(sm.ts - ts); if (d < bestD) { best = sm; bestD = d } }
  return best
}

// ── Composición en movimiento: delta de cada métrica desde el inicio del protocolo ──
export interface CompDelta {
  metric: string; unit: string; last: number; delta: number | null
  points: number[]; goodDown: boolean
}
const COMP = [
  { metric: 'Peso', unit: 'kg', goodDown: true },
  { metric: '% grasa', unit: '%', goodDown: true },
  { metric: '% músculo', unit: '%', goodDown: false },
  { metric: 'Cintura', unit: 'cm', goodDown: true },
]
export function compositionDeltas(s: AppState): CompDelta[] {
  const start = protocolStartTs(s)
  const out: CompDelta[] = []
  for (const c of COMP) {
    const series = sortedAsc(s.history[c.metric])
    if (series.length === 0) continue
    const last = series[series.length - 1].value
    const base = start != null ? baselineAt(series, start) : series[0]
    const delta = base && series.length >= 2 ? last - base.value : null
    out.push({ metric: c.metric, unit: c.unit, last, delta, points: series.slice(-7).map((x) => x.value), goodDown: c.goodDown })
  }
  return out
}

// ── Per-producto: lista de protocolos + KPIs de su categoría ──
export interface ProtocolInfo { product: string; cat: string; color: string; startDate: number; daysActive: number }
export function protocolList(s: AppState): ProtocolInfo[] {
  return Object.values(s.protocols)
    .map((p) => {
      const cat = PEPTIDES[p.product]?.cat ?? 'Explorar'
      return { product: p.product, cat, color: CATEGORY_COLOR[cat] ?? 'var(--brand-700)', startDate: p.startDate, daysActive: Math.max(0, Math.floor((s.todayTs - p.startDate) / DAY)) }
    })
    .sort((a, b) => b.startDate - a.startDate)
}

export interface KpiRow { measure: string; unit: string; last: number | null; delta: number | null; points: number[]; down: boolean }
// KPIs relevantes de un producto (por su categoría), con delta+sparkline desde el inicio de ESE producto.
export function productKpis(s: AppState, product: string, n = 4): KpiRow[] {
  const proto = s.protocols[product]
  if (!proto) return []
  const cat = PEPTIDES[product]?.cat ?? 'Explorar'
  const measures = (MEASURES_BY[cat] ?? MEASURES_BY['Explorar']).slice(0, n)
  return measures.map((m) => {
    const meta = MEASURE_META[m]
    const series = sortedAsc(s.history[m]).filter((p) => p.ts >= proto.startDate)
    const last = series.length ? series[series.length - 1].value : null
    const delta = series.length >= 2 ? series[series.length - 1].value - series[0].value : null
    const unit = meta?.kind === 'num' ? (meta.unit ? ` ${meta.unit}` : '') : meta?.max ? `/${meta.max}` : ''
    return { measure: m, unit, last, delta: delta != null ? Math.round(delta * 10) / 10 : null, points: series.slice(-8).map((p) => p.value), down: !!meta?.down }
  })
}

// ── Predicción contextual de comida por franja horaria + búsqueda en la biblioteca ──
export function predictions(s: AppState, now: number, n = 3): FoodFav[] {
  const slot = mealSlot(now)
  return [...s.foodLibrary]
    .map((f) => ({ f, score: (f.hourBucket?.[slot] ?? 0) * 3 + f.usoCount }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.f)
}

// Confianza relativa de cada predicción (para badges /↑)
// Devuelve 'habitual' si es la más frecuente en la franja, 'frecuente' si sube, null si solo es reciente
export function predictionConfidence(s: AppState, fav: FoodFav, now: number): 'habitual' | 'frecuente' | null {
  const slot = mealSlot(now)
  const slotCount = fav.hourBucket?.[slot] ?? 0
  const totalCount = fav.usoCount
  if (slotCount >= 2) return 'habitual'
  if (totalCount >= 3) return 'frecuente'
  return null
}

// ── Fuzzy search con trigramas (tolerante a typos) + fallback substring ──
function trigrams(s: string): Set<string> {
  const tg = new Set<string>()
  const pad = '  ' + s + '  '
  for (let i = 0; i < pad.length - 2; i++) tg.add(pad.slice(i, i + 3))
  return tg
}
function trigramSim(a: string, b: string): number {
  const ta = trigrams(a), tb = trigrams(b)
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return (2 * inter) / (ta.size + tb.size || 1)
}

export function fuzzySearch(library: FoodFav[], q: string, n = 8): FoodFav[] {
  const query = q.trim().toLowerCase()
  if (!query) return []
  return library
    .map((f) => {
      const l = f.label.toLowerCase()
      let score = 0
      if (l.startsWith(query)) score = 4
      else if (l.includes(query)) score = 3
      else {
        const sim = trigramSim(query, l)
        if (sim > 0.25) score = sim * 2  // tolerante a typos
      }
      return { f, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.f.usoCount - a.f.usoCount)
    .slice(0, n)
    .map((x) => x.f)
}

// ── kcal por día (últimos N días) ──
export function kcalSeries(s: AppState, days: number, now = s.todayTs): { ts: number; kcal: number; has: boolean }[] {
  const out: { ts: number; kcal: number; has: boolean }[] = []
  const base = new Date(now)
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i) // día calendario local (DST-safe)
    const ts = day.getTime()
    const d = s.nutrition[isoKey(ts)]
    out.push({ ts, kcal: d ? dayKcal(d.meals) : 0, has: !!d && d.meals.length > 0 })
  }
  return out
}

// ── ANCLA: calorías y peso, antes vs desde el inicio del protocolo (observacional) ──
export interface ProtocolNumbers {
  startTs: number
  preKcal: number | null; postKcal: number | null; deltaKcal: number | null
  weightDelta: number | null
  weightPoints: number[]   // peso desde la basal de inicio → último (para la gráfica de tendencia)
  kcalPoints: { ts: number; kcal: number }[]
  enoughData: boolean   // ≥14 días con registro de kcal
}
export function protocolNumbers(s: AppState): ProtocolNumbers | null {
  const startTs = protocolStartTs(s)
  if (startTs == null) return null
  const now = s.todayTs
  // promedio de kcal en días CON registro, antes y desde el inicio
  let preSum = 0, preN = 0, postSum = 0, postN = 0
  const kcalPoints: { ts: number; kcal: number }[] = []
  for (const [k, d] of Object.entries(s.nutrition)) {
    if (!d.meals.length) continue
    const ts = new Date(k + 'T12:00:00').getTime()
    const kcal = dayKcal(d.meals)
    kcalPoints.push({ ts, kcal })
    if (ts < startTs) { preSum += kcal; preN++ } else { postSum += kcal; postN++ }
  }
  kcalPoints.sort((a, b) => a.ts - b.ts)
  const preKcal = preN ? Math.round(preSum / preN) : null
  const postKcal = postN ? Math.round(postSum / postN) : null
  const deltaKcal = preKcal != null && postKcal != null ? postKcal - preKcal : null
  // delta de peso desde la basal al inicio
  const peso = sortedAsc(s.history['Peso'])
  let weightDelta: number | null = null
  let weightPoints: number[] = []
  if (peso.length >= 2) {
    const base = baselineAt(peso, startTs)
    if (base) weightDelta = Math.round((peso[peso.length - 1].value - base.value) * 10) / 10
    // serie para la gráfica: peso desde el inicio del protocolo, anclada en la basal
    const since = peso.filter((p) => p.ts >= startTs)
    weightPoints = since.map((p) => p.value)
    if (base && base.ts < startTs) weightPoints = [base.value, ...weightPoints]
  }
  const daysWithKcal = kcalPoints.filter((p) => p.ts >= now - 30 * DAY).length
  return { startTs, preKcal, postKcal, deltaKcal, weightDelta, weightPoints, kcalPoints, enoughData: postN >= 14 || daysWithKcal >= 14 }
}

// ── TDEE (Mifflin-St Jeor) ──
const ACT_FACTOR: Record<string, number> = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, 'muy-activo': 1.9 }
export function tdee(s: AppState): number | null {
  const p = s.profile
  if (!(p.peso && p.peso > 0) || !(p.est && p.est > 0) || !(p.edad && p.edad > 0) || !p.sexo || !p.actividad) return null
  const bmr = 10 * p.peso + 6.25 * p.est - 5 * p.edad + (p.sexo === 'H' ? 5 : -161)
  return Math.round(bmr * (ACT_FACTOR[p.actividad] ?? 1.2))
}
export function avgKcal(s: AppState, days: number): number | null {
  const series = kcalSeries(s, days).filter((d) => d.has)
  if (!series.length) return null
  return Math.round(series.reduce((a, b) => a + b.kcal, 0) / series.length)
}

// ── Chip TDEE: Déficit / Mantenimiento / Superávit ──
export type TdeeZone = 'deficit-agresivo' | 'deficit' | 'mantenimiento' | 'superavit'
export function tdeeZone(kcal: number, tdeeVal: number): TdeeZone {
  const ratio = kcal / tdeeVal
  if (ratio < 0.7) return 'deficit-agresivo'
  if (ratio < 0.95) return 'deficit'
  if (ratio <= 1.05) return 'mantenimiento'
  return 'superavit'
}
export interface TdeeChip {
  zone: TdeeZone
  label: string
  color: string
  detail: string
}
export function tdeeChip(kcal: number, tdeeVal: number): TdeeChip {
  const zone = tdeeZone(kcal, tdeeVal)
  const diff = Math.abs(kcal - tdeeVal)
  switch (zone) {
    case 'deficit-agresivo': return { zone, label: 'Déficit agresivo', color: 'var(--error)', detail: `−${Math.round(diff)} kcal bajo TDEE (>${Math.round((1 - kcal / tdeeVal) * 100)}%)` }
    case 'deficit':          return { zone, label: 'Déficit', color: 'var(--brand-700)', detail: `−${Math.round(diff)} kcal bajo tu TDEE estimado` }
    case 'mantenimiento':    return { zone, label: 'Mantenimiento', color: 'var(--success)', detail: `Cerca de tu TDEE (${tdeeVal} kcal)` }
    case 'superavit':        return { zone, label: 'Superávit', color: 'var(--warning)', detail: `+${Math.round(diff)} kcal sobre tu TDEE estimado` }
  }
}

// ── Proyección de meta de peso (regresión lineal sobre history.Peso) — item 461 ──
// `etaTs` ya existía. Se añade `etaLabel` (fecha estimada formateada) y `weeksLeft`.
export interface WeightProjection {
  current: number
  goal: number
  slopePerDay: number   // kg/día (negativo = bajando)
  etaTs: number | null  // epoch ms de llegada estimada a la meta (null = no proyectable)
  etaLabel: string | null // 'ene 2027' | '3 semanas' | null
  weeksLeft: number | null // semanas completas hasta la meta (null si no proyectable)
  points: number[]       // últimos puntos de peso para la gráfica
}
export function weightProjection(s: AppState): WeightProjection | null {
  const goal = s.profile.metaPesoKg
  const series = sortedAsc(s.history['Peso'])
  if (!goal || series.length < 5) return null
  const recent = series.slice(-28)
  const t0 = recent[0].ts
  const xs = recent.map((p) => (p.ts - t0) / DAY)
  const ys = recent.map((p) => p.value)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  const slope = den === 0 ? 0 : num / den // kg/día
  const current = ys[ys.length - 1]
  // ETA solo si la pendiente va HACIA la meta
  let etaTs: number | null = null
  const need = goal - current
  if (slope !== 0 && Math.sign(slope) === Math.sign(need)) {
    const days = need / slope
    if (days > 0 && days < 365 * 2) etaTs = s.todayTs + days * DAY
  }
  // etaLabel + weeksLeft (item 461)
  let etaLabel: string | null = null
  let weeksLeft: number | null = null
  if (etaTs != null) {
    const daysToEta = Math.round((etaTs - s.todayTs) / DAY)
    weeksLeft = Math.ceil(daysToEta / 7)
    if (daysToEta <= 28) {
      etaLabel = `${weeksLeft} ${weeksLeft === 1 ? 'semana' : 'semanas'}`
    } else {
      const d = new Date(etaTs)
      const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      etaLabel = `${MESES[d.getMonth()]} ${d.getFullYear()}`
    }
  }
  return { current, goal, slopePerDay: slope, etaTs, etaLabel, weeksLeft, points: recent.map((p) => p.value) }
}

// ── Racha compuesta: días consecutivos (hasta hoy) con ≥1 dosis y ≥1 comida y agua≥meta ──
// nut.water está en MILILITROS; la meta es la del perfil en litros → ML. Antes se comparaba contra 8
// (ml>=8 = un sorbo) → el requisito de agua era trivial.
export function compositeStreak(s: AppState): number {
  const goalMl = waterGoalLiters(s.profile.peso) * 1000
  const tracked = trackedProtocols(s)
  let streak = 0
  const base = new Date(s.todayTs)
  for (let i = 0; i < 365; i++) { // tope 365 (antes 90 truncaba rachas largas)
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i) // día calendario local (DST-safe)
    const k = isoKey(day.getTime())
    const nut = s.nutrition[k]
    const g = s.log.find((x) => x.dateKey === k)
    // dosis cumplida: se registró, O la cadencia no programaba toma ese día (descanso) / sin protocolo.
    // (Antes exigía dosis TODOS los días → un protocolo no-diario rompía la racha cada descanso.)
    const dose = productsOnDay(day, tracked).length === 0 || !!g?.items.some((it) => it.type === 'dose')
    const meal = !!nut && nut.meals.length > 0
    const water = !!nut && nut.water >= goalMl
    if (dose && meal && water) streak++
    else if (i === 0) continue // hoy aún en curso: no rompe la racha
    else break
  }
  return streak
}

// ── Detalle de racha + hito siguiente (gamificación) ──
const MILESTONES = [7, 14, 30, 60, 90, 180, 365]
export interface StreakDetail {
  streak: number
  today: { dose: boolean; water: boolean; meal: boolean }
  prevMilestone: number
  nextMilestone: number | null
}
export function streakDetail(s: AppState): StreakDetail {
  const goalMl = waterGoalLiters(s.profile.peso) * 1000
  const streak = compositeStreak(s)
  const k = isoKey(s.todayTs)
  const nut = s.nutrition[k]
  const g = s.log.find((x) => x.dateKey === k)
  // dosis de hoy cumplida si se registró o si hoy es día de descanso/sin protocolo (coherente con compositeStreak)
  const doseScheduledToday = productsOnDay(new Date(s.todayTs), trackedProtocols(s)).length > 0
  const today = {
    dose: !doseScheduledToday || !!g?.items.some((it) => it.type === 'dose'),
    water: !!nut && nut.water >= goalMl,
    meal: !!nut && nut.meals.length > 0,
  }
  const next = MILESTONES.find((m) => m > streak) ?? null
  const prev = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0
  return { streak, today, prevMilestone: prev, nextMilestone: next }
}

// ── Utilidades de metas personales ──
export function kcalFromMacros(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9)
}
export function proteinSuggestion(pesoKg: number): number {
  return Math.round(pesoKg * 1.6)
}
export function waterGoalGlasses(pesoKg: number): number {
  return Math.max(8, Math.round(pesoKg * 0.033))
}

// ── Agua en LITROS ────────────────────────────────────────────────────────────
// El agua se guarda como CONTEO DE VASOS, pero el tamaño del vaso (ml) es configurable, así que
// "8 vasos" no es comparable entre tamaños. Para KPIs/dashboards/gráficas mostramos litros.
const STD_GLASS_ML = 250 // vaso estándar para calibrar la META (la meta en L no depende del vaso real)
// tamaño del vaso configurado por el usuario (Alimentación lo guarda en localStorage); default 250 ml
export function getGlassMl(): number {
  try { return Number(localStorage.getItem('hacktrack-glass-ml') ?? '250') || 250 } catch { return 250 }
}
// litros consumidos = vasos × tamaño real del vaso, redondeado a 1 decimal
export function glassesToLiters(glasses: number, glassMl: number = getGlassMl()): number {
  return Math.round((glasses * glassMl) / 100) / 10
}
// El agua se almacena en MILILITROS (volumen acumulado). litros = ml / 1000, redondeado a 1 decimal.
export function litersFromMl(ml: number): number {
  return Math.round(ml / 100) / 10
}
// meta diaria de agua en litros (calibrada a vasos de 250 ml → ~2 L; independiente del vaso del usuario)
export function waterGoalLiters(pesoKg: number | null): number {
  const glasses = pesoKg ? waterGoalGlasses(pesoKg) : 8
  return Math.round((glasses * STD_GLASS_ML) / 100) / 10
}

// ── Proteína restante accionable: "Faltan X g en Y comidas → ~Z g/comida" ──
export interface ProteinRemaining {
  remaining: number       // g que faltan para la meta
  mealsLeft: number       // comidas restantes en el día según franja actual
  perMeal: number | null  // g sugeridos por comida (null si mealsLeft === 0)
}
export function proteinRemaining(protein: number, goalP: number, now: number): ProteinRemaining {
  const remaining = Math.max(0, goalP - protein)
  // estimar comidas restantes según franjas del día (comida/colación tarde/cena = 2-3 después del almuerzo)
  const h = new Date(now).getHours()
  const mealsLeft = h < 12 ? 3 : h < 14 ? 2 : h < 19 ? 2 : h < 21 ? 1 : 0
  const perMeal = mealsLeft > 0 ? Math.ceil(remaining / mealsLeft) : null
  return { remaining, mealsLeft, perMeal }
}

// ── Ventana de ayuno: minutos transcurridos desde la última comida ──
export function fastingMinutes(lastMealTs: number | null, now: number): number | null {
  if (!lastMealTs) return null
  const diff = now - lastMealTs
  if (diff < 0) return null
  return Math.floor(diff / 60_000)
}
export function fastingLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min sin comer`
  if (m === 0) return `${h} h sin comer`
  return `${h} h ${m} min sin comer`
}

// ── Distribución calórica por franja horaria (chrono-nutrición) ──
const SLOT_ORDER = ['desayuno', 'colación de la mañana', 'comida', 'colación de la tarde', 'cena', 'antojo nocturno']
export interface SlotKcal { slot: string; kcal: number; pct: number }
export function kcalBySlot(meals: { kcal: number; ts: number }[]): SlotKcal[] {
  const totals: Record<string, number> = {}
  for (const m of meals) {
    const s = mealSlot(m.ts)
    totals[s] = (totals[s] ?? 0) + m.kcal
  }
  const total = Object.values(totals).reduce((a, b) => a + b, 0)
  return SLOT_ORDER
    .filter((s) => totals[s] > 0)
    .map((s) => ({ slot: s, kcal: totals[s], pct: total > 0 ? Math.round((totals[s] / total) * 100) : 0 }))
}

// ── Toggle macro display: g absolutos ↔ % de kcal ──
export interface MacroPct { protein: number; carbs: number; fat: number }
export function macroPercents(protein: number, carbs: number, fat: number): MacroPct {
  const kcalP = protein * 4, kcalC = carbs * 4, kcalF = fat * 9
  const total = kcalP + kcalC + kcalF
  if (total === 0) return { protein: 0, carbs: 0, fat: 0 }
  return {
    protein: Math.round((kcalP / total) * 100),
    carbs: Math.round((kcalC / total) * 100),
    fat: Math.round((kcalF / total) * 100),
  }
}

// ── Índice calidad proteica del día (animal vs vegetal) — semáforo observacional ──
// Se infiere del label: items con carne/pollo/huevo/pescado/lácteo → animal; legumbres/soya/tofu → vegetal.
// Sin datos → 'sin-datos'
const ANIMAL_KEYS = ['pollo', 'res', 'cerdo', 'atún', 'salmón', 'huevo', 'leche', 'yogur', 'queso', 'pavo', 'camarón', 'pescado', 'proteína']
const VEGETAL_KEYS = ['frijol', 'lenteja', 'garbanzo', 'soya', 'tofu', 'edamame', 'chícharo', 'quinoa', 'chayote']
export type ProteinQuality = 'alta' | 'media' | 'baja' | 'sin-datos'
export function proteinQualityScore(meals: { label?: string | null; protein?: number | null }[]): ProteinQuality {
  let animal = 0, vegetal = 0
  for (const m of meals) {
    if (!m.label || !m.protein) continue
    const l = m.label.toLowerCase()
    if (ANIMAL_KEYS.some((k) => l.includes(k))) animal += m.protein!
    else if (VEGETAL_KEYS.some((k) => l.includes(k))) vegetal += m.protein!
  }
  const total = animal + vegetal
  if (total < 5) return 'sin-datos'
  const animalPct = animal / total
  if (animalPct >= 0.5) return 'alta'
  if (animalPct >= 0.25) return 'media'
  return 'baja'
}

// ── Distribución proteína por toma: alerta silenciosa de reparto desigual ──
// Devuelve true si una sola toma concentra >60% de la proteína total del día
export function isProteinUnbalanced(meals: { protein?: number | null; ts: number }[]): boolean {
  const total = meals.reduce((s, m) => s + (m.protein ?? 0), 0)
  if (total < 20) return false
  const grouped: Record<string, number> = {}
  for (const m of meals) {
    const s = mealSlot(m.ts)
    grouped[s] = (grouped[s] ?? 0) + (m.protein ?? 0)
  }
  return Object.values(grouped).some((v) => v / total > 0.6)
}

// ── Índice de diversidad alimentaria semanal (Shannon simplificado) ──
// Cuenta etiquetas únicas en los últimos 7 días; >10 = alta, 5-9 = media, <5 = baja
export interface DiversityScore { unique: number; level: 'alta' | 'media' | 'baja' }
export function weeklyDiversityScore(s: AppState): DiversityScore {
  const labels = new Set<string>()
  const series = kcalSeries(s, 7)
  for (const { ts } of series) {
    const d = s.nutrition[isoKey(ts)]
    if (!d) continue
    for (const m of d.meals) {
      if (m.label) labels.add(m.label.toLowerCase().trim())
    }
  }
  const unique = labels.size
  const level: DiversityScore['level'] = unique >= 10 ? 'alta' : unique >= 5 ? 'media' : 'baja'
  return { unique, level }
}

// ── Señales de la semana: observaciones por plantilla fija (cumplimiento) ──
export function weeklyInsights(s: AppState): string[] {
  const out: string[] = []
  const last7 = avgKcal(s, 7)
  const prev = kcalSeries(s, 14).slice(0, 7).filter((d) => d.has)
  const prevAvg = prev.length ? Math.round(prev.reduce((a, b) => a + b.kcal, 0) / prev.length) : null
  if (last7 != null && prevAvg != null && prevAvg > 0) {
    const pct = Math.round(((last7 - prevAvg) / prevAvg) * 100)
    if (Math.abs(pct) >= 5) out.push(`Tus calorías promediaron ${last7} kcal/día (${pct > 0 ? '+' : ''}${pct}% vs la semana previa).`)
  }
  const peso = sortedAsc(s.history['Peso'])
  if (peso.length >= 2) {
    const wk = peso.filter((p) => p.ts >= s.todayTs - 7 * DAY)
    if (wk.length >= 2) {
      const d = Math.round((wk[wk.length - 1].value - wk[0].value) * 10) / 10
      if (Math.abs(d) >= 0.1) out.push(`Tu peso registrado cambió ${d > 0 ? '+' : ''}${d} kg esta semana.`)
    }
  }
  const water7 = kcalSeries(s, 7).map((d) => s.nutrition[isoKey(d.ts)]?.water ?? 0)
  const daysHydrated = water7.filter((w) => w >= waterGoalLiters(s.profile.peso) * 1000).length // ml vs meta en ML
  if (daysHydrated > 0) out.push(`Cumpliste tu meta de hidratación en ${daysHydrated} de 7 días.`)
  const macro = dayMacros((s.nutrition[isoKey(s.todayTs)]?.meals) ?? [])
  if (macro.hasMacros && macro.protein > 0) out.push(`Hoy llevas ${macro.protein} g de proteína registrada.`)
  // Insight semanal de proteína: si hay meta y ≥3 días con datos
  if (s.macroGoals?.protein) {
    const goalProt = s.macroGoals.protein
    const last7Keys = kcalSeries(s, 7).map((d) => isoKey(d.ts))
    const protDays = last7Keys
      .map((k) => s.nutrition[k])
      .filter((d) => d && d.meals.length > 0 && d.meals.some((m) => m.protein != null && m.protein > 0))
    if (protDays.length >= 3) {
      const avgProt = Math.round(protDays.reduce((sum, d) => {
        const pm = dayMacros(d!.meals); return sum + pm.protein
      }, 0) / protDays.length)
      out.push(`Promediaste ${avgProt} g de proteína/día (meta ${goalProt} g).`)
    }
  }
  // Diversidad alimentaria
  const div = weeklyDiversityScore(s)
  if (div.unique > 0) out.push(`Registraste ${div.unique} alimentos distintos esta semana (variedad ${div.level}).`)
  return out
}

// ── Racha de calidad nutricional (solo proteína — fibra no disponible en tipos actuales) ──
// Días consecutivos cumpliendo ≥80% de la meta de proteína
export function proteinQualityStreak(s: AppState): number {
  const goal = s.macroGoals?.protein
  if (!goal || goal <= 0) return 0
  let streak = 0
  const base = new Date(s.todayTs)
  for (let i = 0; i < 90; i++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)
    const k = isoKey(day.getTime())
    const d = s.nutrition[k]
    if (!d || d.meals.length === 0) {
      if (i === 0) continue // hoy en curso
      break
    }
    const { protein } = dayMacros(d.meals)
    if (protein >= goal * 0.8) streak++
    else if (i === 0) continue
    else break
  }
  return streak
}

// ── Recientes: alimentos de los últimos 7 días para registro 1-toque ──
export function recentFoods(s: AppState, n = 8): FoodFav[] {
  const seen = new Map<string, { fav: FoodFav; lastTs: number }>()
  const series = kcalSeries(s, 7)
  for (const { ts } of [...series].reverse()) {
    const d = s.nutrition[isoKey(ts)]
    if (!d) continue
    for (const m of [...d.meals].reverse()) {
      if (!m.label) continue
      // intentar encontrar en la biblioteca de favoritos
      const fav = s.foodLibrary.find((f) => f.label.toLowerCase() === m.label!.toLowerCase())
      if (fav && !seen.has(fav.id)) {
        seen.set(fav.id, { fav, lastTs: m.ts })
      } else if (!fav && !seen.has('_raw_' + m.label.toLowerCase())) {
        // crear FoodFav efímero desde el meal (para mostrar en UI)
        const ephemeral: FoodFav = {
          id: '_raw_' + m.label.toLowerCase(),
          label: m.label,
          kcal: m.kcal,
          protein: m.protein ?? null,
          carbs: m.carbs ?? null,
          fat: m.fat ?? null,
          usoCount: 1,
        }
        seen.set('_raw_' + m.label.toLowerCase(), { fav: ephemeral, lastTs: m.ts })
      }
      if (seen.size >= n) break
    }
    if (seen.size >= n) break
  }
  return [...seen.values()].sort((a, b) => b.lastTs - a.lastTs).map((x) => x.fav).slice(0, n)
}

// ── Exportar log de nutrición como CSV (7 ó 30 días) ──
export function exportNutritionCsv(s: AppState, days: 7 | 30 = 7): string {
  const header = 'Fecha,Franja,Alimento,kcal,Proteína (g),Carbos (g),Grasa (g)'
  const rows: string[] = [header]
  const series = kcalSeries(s, days)
  for (const { ts } of series) {
    const k = isoKey(ts)
    const d = s.nutrition[k]
    if (!d || d.meals.length === 0) continue
    for (const m of d.meals) {
      const row = [
        k,
        mealSlot(m.ts),
        (m.label ?? '').replace(/,/g, ';'),
        m.kcal,
        m.protein ?? '',
        m.carbs ?? '',
        m.fat ?? '',
      ].join(',')
      rows.push(row)
    }
  }
  return rows.join('\n')
}

// ── Compartir el día como texto plano ──
export function shareDayText(s: AppState): string {
  const k = isoKey(s.todayTs)
  const d = s.nutrition[k]
  if (!d || d.meals.length === 0) return 'Sin comidas registradas hoy.'
  const total = dayKcal(d.meals)
  const macros = dayMacros(d.meals)
  let text = `Mi alimentación de hoy — ${k}\n`
  text += `Total: ${total} kcal`
  if (macros.hasMacros) text += ` · P: ${macros.protein} g · C: ${macros.carbs} g · G: ${macros.fat} g`
  text += '\n\n'
  const SLOT_ORDER_ES = ['desayuno', 'colación de la mañana', 'comida', 'colación de la tarde', 'cena', 'antojo nocturno']
  const grouped: Record<string, typeof d.meals> = {}
  for (const m of d.meals) {
    const sl = mealSlot(m.ts)
    if (!grouped[sl]) grouped[sl] = []
    grouped[sl].push(m)
  }
  for (const sl of SLOT_ORDER_ES) {
    if (!grouped[sl]?.length) continue
    text += `${sl.charAt(0).toUpperCase() + sl.slice(1)}:\n`
    for (const m of grouped[sl]) {
      text += `  · ${m.label ?? 'Comida'} — ${m.kcal} kcal`
      if (m.protein) text += ` (P: ${m.protein} g)`
      text += '\n'
    }
  }
  text += '\nRegistrado con Hacktrack'
  return text
}
