// Analítica de Alimentación + Resumen (features premium). Todo es OBSERVACIONAL sobre los datos del usuario:
// nunca causalidad, nunca se nombra un péptido junto a un resultado de peso, sin consejo médico.
import type { AppState } from './store'
import { isoKey, mealSlot } from './store'
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
export function fuzzySearch(library: FoodFav[], q: string, n = 8): FoodFav[] {
  const query = q.trim().toLowerCase()
  if (!query) return []
  return library
    .map((f) => {
      const l = f.label.toLowerCase()
      return { f, score: l.startsWith(query) ? 3 : l.includes(query) ? 2 : 0 }
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
  if (peso.length >= 2) {
    const base = baselineAt(peso, startTs)
    if (base) weightDelta = Math.round((peso[peso.length - 1].value - base.value) * 10) / 10
  }
  const daysWithKcal = kcalPoints.filter((p) => p.ts >= now - 30 * DAY).length
  return { startTs, preKcal, postKcal, deltaKcal, weightDelta, kcalPoints, enoughData: postN >= 14 || daysWithKcal >= 14 }
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

// ── Proyección de meta de peso (regresión lineal sobre history.Peso) ──
export interface WeightProjection { current: number; goal: number; slopePerDay: number; etaTs: number | null; points: number[] }
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
  return { current, goal, slopePerDay: slope, etaTs, points: recent.map((p) => p.value) }
}

// ── Racha compuesta: días consecutivos (hasta hoy) con ≥1 dosis y ≥1 comida y agua≥meta ──
export function compositeStreak(s: AppState, waterGoal = 8): number {
  let streak = 0
  const base = new Date(s.todayTs)
  for (let i = 0; i < 90; i++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i) // día calendario local (DST-safe)
    const k = isoKey(day.getTime())
    const nut = s.nutrition[k]
    const g = s.log.find((x) => x.dateKey === k)
    const dose = !!g?.items.some((it) => it.type === 'dose')
    const meal = !!nut && nut.meals.length > 0
    const water = !!nut && nut.water >= waterGoal
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
export function streakDetail(s: AppState, waterGoal = 8): StreakDetail {
  const streak = compositeStreak(s, waterGoal)
  const k = isoKey(s.todayTs)
  const nut = s.nutrition[k]
  const g = s.log.find((x) => x.dateKey === k)
  const today = {
    dose: !!g?.items.some((it) => it.type === 'dose'),
    water: !!nut && nut.water >= waterGoal,
    meal: !!nut && nut.meals.length > 0,
  }
  const next = MILESTONES.find((m) => m > streak) ?? null
  const prev = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0
  return { streak, today, prevMilestone: prev, nextMilestone: next }
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
  const daysHydrated = water7.filter((w) => w >= 8).length
  if (daysHydrated > 0) out.push(`Cumpliste tu meta de hidratación en ${daysHydrated} de 7 días.`)
  const macro = dayMacros((s.nutrition[isoKey(s.todayTs)]?.meals) ?? [])
  if (macro.hasMacros && macro.protein > 0) out.push(`Hoy llevas ${macro.protein} g de proteína registrada.`)
  return out
}
