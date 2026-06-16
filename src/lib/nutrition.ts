// Analítica de Alimentación + Resumen (features premium). Todo es OBSERVACIONAL sobre los datos del usuario:
// nunca causalidad, nunca se nombra un péptido junto a un resultado de peso, sin consejo médico.
import type { AppState } from './store'
import { isoKey } from './store'
import type { MeasureSample } from './types'

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

// "Tu fecha de inicio" del protocolo (sin nombrar el péptido): el inicio más antiguo registrado.
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

// ── kcal por día (últimos N días) ──
export function kcalSeries(s: AppState, days: number, now = s.todayTs): { ts: number; kcal: number; has: boolean }[] {
  const out: { ts: number; kcal: number; has: boolean }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * DAY
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
  for (let i = 0; i < 90; i++) {
    const ts = s.todayTs - i * DAY
    const k = isoKey(ts)
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
