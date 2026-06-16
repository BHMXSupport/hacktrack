// Farmacocinética educativa: "vida del péptido en el cuerpo".
// Modelo de primer orden con superposición de dosis: A(t) = Σᵢ valueᵢ · 0.5^((t − tsᵢ)/t½)
// Las vidas medias son APROXIMADAS (literatura científica) — esto es una estimación educativa,
// no farmacocinética individual ni consejo médico. (Investigador PK del equipo multiagente.)
import type { AppState } from './store'
import { PEPTIDES, CATEGORY_COLOR } from './catalog'

const H = 3_600_000 // ms por hora

// Vida media de eliminación aproximada (horas). NAD+ se OMITE a propósito:
// es precursor/metabolito, no modela decaimiento plasmático estándar → se marca como "no graficable".
export const HALF_LIFE_H: Record<string, number> = {
  'Retatrutide': 155,
  'Tirzepatida': 120,
  'Semaglutida': 165,
  'Tesamorelin': 0.15,
  'MOTS-c': 1,
  '5-Amino-1MQ': 3,
  'SLU-PP-332': 2,
  'BPC-157': 2,
  'TB-500': 1.5,
  'GHK-Cu': 0.75,
  'ARA 290': 0.75,
  'GLOW 70': 1.5,   // blend → t½ representativo del componente de mayor t½ (BPC-157)
  'KLOW 80': 1.5,   // blend → idem
  'SS-31': 2.5,
  'L-Glutathione': 0.2,
  'Semax': 0.33,
  'Selank': 0.33,
  'DSIP': 0.75,
  'Oxytocin': 0.05,
  'CJC 1295 (No DAC)': 0.5,
  'Ipamorelin': 2,
  'Kisspeptin-10': 0.2,
  'PT-141': 2,
}

export type Mode = 'percent' | 'absolute'
export type Pt = [number, number] // [epoch ms, y]

export interface PharmaSeries {
  product: string
  color: string
  halfLifeH: number
  points: Pt[]        // curva (y en % del pico o en mg según mode)
  markers: Pt[]       // inyecciones dentro de la ventana (mismo eje y que points)
  currentMg: number   // mg estimados presentes AHORA (siempre en mg, para la leyenda)
  peakMg: number      // pico de mg en todo el historial (para normalizar)
}

export interface PharmaData {
  series: PharmaSeries[]
  skipped: string[]   // productos consumidos sin vida media (p.ej. NAD+)
  domainX: [number, number]
  domainY: [number, number]
  nowTs: number
  mode: Mode
  hasAnyDose: boolean
}

interface Dose { product: string; value: number; ts: number }

// recolecta dosis por producto. El valor numérico (mg) vive en `u` ("Producto · 2 mg").
// Convierte mcg/µg→mg, g→mg; omite unidades no convertibles (UI, mL) o sin número.
export function collectDosesByProduct(s: AppState): Map<string, Dose[]> {
  const byProduct = new Map<string, Dose[]>()
  for (const g of s.log) {
    for (const it of g.items) {
      if (it.type !== 'dose' || it.product == null) continue
      const m = it.u.match(/·\s*([\d.]+)\s*([^\s·]*)/)
      let value = m ? parseFloat(m[1]) : NaN
      const unit = (m?.[2] ?? '').toLowerCase()
      if (unit === 'mcg' || unit === 'µg' || unit === 'ug' || unit === 'μg') value = value / 1000
      else if (unit === 'g') value = value * 1000
      else if (!(unit === 'mg' || unit === '')) continue
      if (!isFinite(value) || value <= 0) continue
      const arr = byProduct.get(it.product) ?? []
      arr.push({ product: it.product, value, ts: it.ts })
      byProduct.set(it.product, arr)
    }
  }
  return byProduct
}

const THRESHOLD = 1e-5 // bajo esto (relativo al pico) → 0, evita artefactos de punto flotante

// Absorción BIFÁSICA (lag + absorción sc) — SOLO GLP-1 de acción prolongada. El resto = instantáneo.
// Parámetros clínicos (investigador PK): tmax resultante cae en el rango sc reportado.
export const BIPHASIC: Record<string, { tHalfAbsH: number; tLagH: number }> = {
  'Semaglutida': { tHalfAbsH: 15, tLagH: 8 },
  'Tirzepatida': { tHalfAbsH: 12, tLagH: 6 },
  'Retatrutide': { tHalfAbsH: 16, tLagH: 8 },
}
export const isBiphasic = (product: string): boolean => product in BIPHASIC

// contribución de UNA dosis a la cantidad presente, dt ms después de la inyección.
// Instantáneo: value·0.5^(dt/t½). Bifásico: un compartimento con absorción de 1er orden.
function contribution(product: string, value: number, dtMs: number, halfMs: number): number {
  if (dtMs < 0) return 0
  const b = BIPHASIC[product]
  if (!b) return value * Math.pow(0.5, dtMs / halfMs)
  const ke = Math.LN2 / halfMs
  let ka = Math.LN2 / (b.tHalfAbsH * H)
  const tau = dtMs - b.tLagH * H
  if (tau <= 0) return 0
  if (Math.abs(ka - ke) < 1e-12) ka = ke * 1.0001 // guard ka≈ke (singularidad)
  return value * (ka / (ka - ke)) * (Math.exp(-ke * tau) - Math.exp(-ka * tau))
}

// offset (ms) del pico tras la inyección: 0 para instantáneo, tlag+ln(ka/ke)/(ka−ke) para bifásico
function tmaxOffsetMs(product: string, halfMs: number): number {
  const b = BIPHASIC[product]
  if (!b) return 0
  const ke = Math.LN2 / halfMs
  const ka = Math.LN2 / (b.tHalfAbsH * H)
  if (Math.abs(ka - ke) < 1e-12) return b.tLagH * H + 1 / ke
  return b.tLagH * H + Math.log(ka / ke) / (ka - ke)
}

// mg presentes de un producto en el instante t = superposición de sus dosis pasadas
function amountAt(doses: Dose[], product: string, halfMs: number, t: number): number {
  let a = 0
  for (const d of doses) {
    if (d.ts > t) continue
    a += contribution(product, d.value, t - d.ts, halfMs)
  }
  return a
}

// pico de mg del producto = máx en los instantes analíticos de pico (ts y ts+tmax), con superposición
function peakOf(doses: Dose[], product: string, halfMs: number): number {
  const off = tmaxOffsetMs(product, halfMs)
  let peak = 0
  for (const d of doses) {
    peak = Math.max(peak, amountAt(doses, product, halfMs, d.ts))
    if (off > 0) peak = Math.max(peak, amountAt(doses, product, halfMs, d.ts + off))
  }
  return peak
}

export interface BuildOpts { now: number; windowMs: number; mode: Mode }

export function buildPharmaSeries(s: AppState, opts: BuildOpts): PharmaData {
  const { now, windowMs, mode } = opts

  const byProduct = collectDosesByProduct(s)

  const hasAnyDose = byProduct.size > 0
  const domainX: [number, number] = [now - windowMs, now + windowMs * 0.08]
  const skipped: string[] = []
  const rawSeries: { product: string; doses: Dose[]; halfMs: number; halfLifeH: number }[] = []

  for (const [product, doses] of byProduct) {
    const halfLifeH = HALF_LIFE_H[product]
    if (halfLifeH == null) { skipped.push(product); continue }
    rawSeries.push({ product, doses, halfMs: halfLifeH * H, halfLifeH })
  }

  // puntos de muestreo: 120 uniformes + breakpoints en cada inyección dentro de la ventana (salto visible)
  const N = 120
  const sampleTs = new Set<number>()
  for (let i = 0; i < N; i++) sampleTs.add(domainX[0] + ((domainX[1] - domainX[0]) * i) / (N - 1))
  for (const r of rawSeries) {
    const off = tmaxOffsetMs(r.product, r.halfMs) // bifásico: añade subida (ts+tlag) y pico (ts+tmax)
    const lagMs = BIPHASIC[r.product] ? BIPHASIC[r.product].tLagH * H : 0
    for (const d of r.doses) {
      for (const bp of [d.ts - 1, d.ts, d.ts + lagMs, d.ts + off]) {
        if (bp >= domainX[0] && bp <= domainX[1]) sampleTs.add(bp)
      }
    }
  }
  const ts = [...sampleTs].sort((a, b) => a - b)

  // pico de cada producto = máx mg en instantes analíticos de pico (ts y ts+tmax), con superposición
  const series: PharmaSeries[] = []
  let maxMg = 0
  for (const r of rawSeries) {
    // pico = máx de los instantes analíticos (peakOf) Y de la línea muestreada (captura el pico
    // combinado de dosis superpuestas que cae entre instantes — fix red-team: evita % > 100)
    let peakMg = peakOf(r.doses, r.product, r.halfMs)
    for (const t of ts) peakMg = Math.max(peakMg, amountAt(r.doses, r.product, r.halfMs, t))
    if (peakMg <= 0) continue
    maxMg = Math.max(maxMg, peakMg)

    const color = CATEGORY_COLOR[PEPTIDES[r.product]?.cat ?? 'Explorar'] ?? 'var(--brand-700)'
    const toY = (mg: number) => {
      const v = mode === 'percent' ? (mg / peakMg) * 100 : mg
      return Math.abs(v) < THRESHOLD * (mode === 'percent' ? 100 : peakMg) ? 0 : v
    }
    const points: Pt[] = ts.map((t) => [t, toY(amountAt(r.doses, r.product, r.halfMs, t))])
    const markers: Pt[] = r.doses
      .filter((d) => d.ts >= domainX[0] && d.ts <= domainX[1])
      .map((d) => [d.ts, toY(amountAt(r.doses, r.product, r.halfMs, d.ts))])

    series.push({
      product: r.product,
      color,
      halfLifeH: r.halfLifeH,
      points,
      markers,
      currentMg: amountAt(r.doses, r.product, r.halfMs, now),
      peakMg,
    })
  }

  // serie con más presencia ahora primero (leyenda y orden de dibujo)
  series.sort((a, b) => b.currentMg - a.currentMg)

  const domainY: [number, number] = mode === 'percent' ? [0, 110] : [0, (maxMg || 1) * 1.1]
  return { series, skipped, domainX, domainY, nowTs: now, mode, hasAnyDose }
}

export interface Presence { product: string; color: string; currentMg: number; pct: number }

// Presencia estimada AHORA por producto (para surfacing en Inicio). pct = % del pico de ese producto.
// Solo productos con vida media conocida y presencia > 0. Ordenado desc por presencia.
export function presenceNow(s: AppState, now: number): Presence[] {
  const byProduct = collectDosesByProduct(s)
  const out: Presence[] = []
  for (const [product, doses] of byProduct) {
    const halfLifeH = HALF_LIFE_H[product]
    if (halfLifeH == null) continue
    const halfMs = halfLifeH * H
    const currentMg = amountAt(doses, product, halfMs, now)
    if (currentMg <= 0) continue
    const peakMg = peakOf(doses, product, halfMs)
    if (peakMg <= 0) continue
    const color = CATEGORY_COLOR[PEPTIDES[product]?.cat ?? 'Explorar'] ?? 'var(--brand-700)'
    out.push({ product, color, currentMg, pct: Math.min(100, (currentMg / peakMg) * 100) })
  }
  return out.sort((a, b) => b.pct - a.pct)
}

// valor "presente ahora" formateado para la leyenda (siempre mg, con ~ de estimación)
export function fmtMg(mg: number): string {
  if (mg <= 0) return '<0.01 mg'
  if (mg < 0.01) return '<0.01 mg'
  if (mg < 1) return `${mg.toFixed(2)} mg`
  if (mg < 10) return `${mg.toFixed(1)} mg`
  return `${Math.round(mg)} mg`
}
