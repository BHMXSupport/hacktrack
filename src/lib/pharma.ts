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
  'Retatrutide': 144,   // ~6 días (mediana fase 1, Coskun 2022)
  'Tirzepatida': 120,   // ~5 días (Frias 2021)
  'Semaglutida': 168,   // ~7 días (SmPC Ozempic/Wegovy)
  'Tesamorelin': 0.15,
  'MOTS-c': 1,
  '5-Amino-1MQ': 3,
  'SLU-PP-332': 2,      // sin PK humana publicada — estimación; ver disclaimer
  'BPC-157': 0.5,       // t½ plasmática del péptido intacto ~minutos (sc/iv); 0.5h = cota superior conservadora
  'TB-500': 1.5,
  'GHK-Cu': 0.75,
  'ARA 290': 0.75,
  'GLOW 70': 1.5,   // blend → t½ representativo del componente de mayor t½ (TB-500)
  'KLOW 80': 1.5,   // blend → idem (TB-500)
  'SS-31': 2,
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

// Productos SIN farmacocinética humana publicada: su curva es una estimación de referencia
// (se dibuja punteada y su chip lleva "~"). No omitimos a Tesamorelin de BIPHASIC porque con t½
// ~10 min su absorción es indistinguible de un bolo en ventanas ≥24h (se modela instantáneo).
export const NO_HUMAN_PK_DATA = new Set<string>(['SLU-PP-332'])

// t½ formateada legible (min / h / d) para la leyenda
export function formatHalfLife(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h % 1 === 0 ? h : h.toFixed(1)} h`
  return `${Math.round(h / 24)} d`
}

// tiempo (ms) hasta ~5% restante (≈4.32 vidas medias) — "washout" práctico
export function washoutMs(halfLifeH: number): number {
  return halfLifeH * 4.32 * H
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
  aucMgH: number      // exposición acumulada en la ventana = ∫ mg dt (mg·h) — estimación teórica
  isEstimatedOnly: boolean // sin PK humana publicada (p.ej. SLU-PP-332) → curva punteada + "~"
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
      let value: number
      if (it.doseMg != null) {
        value = it.doseMg // mg canónicos ya convertidos (incluye UI/mL con reconstitución)
      } else {
        // legado: parsear mg desde `u`. mg/mcg/g convertibles; UI/mL sin doseMg no se pueden graficar.
        const m = it.u.match(/·\s*([\d.]+)\s*([^\s·]*)/)
        value = m ? parseFloat(m[1]) : NaN
        const unit = (m?.[2] ?? '').toLowerCase()
        if (unit === 'mcg' || unit === 'µg' || unit === 'ug' || unit === 'μg') value = value / 1000
        else if (unit === 'g') value = value * 1000
        else if (!(unit === 'mg' || unit === '')) continue
      }
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

// contribución de UNA dosis a la CANTIDAD TOTAL EN EL CUERPO, dt ms después de la inyección.
// Instantáneo: value·0.5^(dt/t½).
// Bifásico (GLP-1 sc): cantidad total = depósito sc (aún sin absorber) + circulante. Empieza en la
// dosis completa (recién inyectada NO es 0) y baja lento por la eliminación. Durante el lag, toda la
// dosis está en el depósito (en el cuerpo); tras el lag, el depósito decae (ka) y lo circulante se
// elimina (ke). Así "presente ahora" coincide con que acabas de inyectarte.
function contribution(product: string, value: number, dtMs: number, halfMs: number): number {
  if (dtMs < 0) return 0
  const b = BIPHASIC[product]
  if (!b) return value * Math.pow(0.5, dtMs / halfMs)
  const ke = Math.LN2 / halfMs
  let ka = Math.LN2 / (b.tHalfAbsH * H)
  const tau = dtMs - b.tLagH * H
  if (tau <= 0) return value // dosis íntegra en el depósito sc → en el cuerpo
  if (Math.abs(ka - ke) < 1e-12) ka = ke * 1.0001 // guard ka≈ke (singularidad)
  const depot = value * Math.exp(-ka * tau)
  const central = value * (ka / (ka - ke)) * (Math.exp(-ke * tau) - Math.exp(-ka * tau))
  return depot + central // monótona decreciente desde la dosis
}

// offset (ms) del pico tras la inyección. Con el modelo de cantidad total el máximo está en la propia
// inyección (meseta del depósito); el "hombro" (fin del lag) se muestrea aparte. Firma estable para el muestreo.
function tmaxOffsetMs(_product: string, _halfMs: number): number {
  return 0
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
    // mg crudos en cada instante de la ventana; rastrea el máximo presente DENTRO de la ventana
    let maxRawWin = 0
    const rawByT = ts.map((t) => {
      const mg = amountAt(r.doses, r.product, r.halfMs, t)
      if (mg > maxRawWin) maxRawWin = mg
      return mg
    })
    // pico (para normalizar) = máx de los instantes analíticos (peakOf, todo el historial) y de la ventana
    const peakMg = Math.max(peakOf(r.doses, r.product, r.halfMs), maxRawWin)
    if (peakMg <= 0) continue

    const dosesInWindow = r.doses.filter((d) => d.ts >= domainX[0] && d.ts <= domainX[1])
    // FILTRO DE VENTANA: muestra el producto SOLO si tiene una inyección en la ventana
    // o presencia no-despreciable en ella. Evita que un producto ya decaído (p.ej. SLU-PP, t½ 2h,
    // inyectado hace días) quede como serie/chip fantasma cuando su presencia es ~0.
    if (dosesInWindow.length === 0 && maxRawWin <= peakMg * 0.005) continue
    maxMg = Math.max(maxMg, peakMg)

    const color = CATEGORY_COLOR[PEPTIDES[r.product]?.cat ?? 'Explorar'] ?? 'var(--brand-700)'
    const toY = (mg: number) => {
      const v = mode === 'percent' ? (mg / peakMg) * 100 : mg
      return Math.abs(v) < THRESHOLD * (mode === 'percent' ? 100 : peakMg) ? 0 : v
    }
    const points: Pt[] = ts.map((t, i) => [t, toY(rawByT[i])])
    const markers: Pt[] = dosesInWindow.map((d) => [d.ts, toY(amountAt(r.doses, r.product, r.halfMs, d.ts))])

    // exposición acumulada en la ventana = ∫ mg dt (trapezoidal sobre los mg crudos) → mg·h
    let auc = 0
    for (let i = 1; i < ts.length; i++) auc += ((rawByT[i - 1] + rawByT[i]) / 2) * (ts[i] - ts[i - 1])

    series.push({
      product: r.product,
      color,
      halfLifeH: r.halfLifeH,
      points,
      markers,
      currentMg: amountAt(r.doses, r.product, r.halfMs, now),
      peakMg,
      aucMgH: auc / 3_600_000,
      isEstimatedOnly: NO_HUMAN_PK_DATA.has(r.product),
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

// piso de presencia para considerar un producto "activo ahora" (% del pico). Centraliza el umbral.
export const PRESENCE_FLOOR_PCT = 2

// ── Notas educativas por producto ────────────────────────────────────────────
// Describen la clase y el comportamiento de su curva (velocidad de eliminación).
// Estimación educativa basada en la literatura científica — sin claims médicos ni dosis.
// Movido de PharmaDashboard.tsx para poder exponerlo en ActiveNowChips y MedidaDetail. (item 151)
const PRODUCT_NOTE: Record<string, string> = {
  'Retatrutide': 'Triple agonista incretina; vida media larga (~6 días): la curva arranca alta y baja lento, sigue presente varios días tras la inyección.',
  'Tirzepatida': 'Doble agonista GIP/GLP-1; vida media ~5 días: presencia prolongada, la curva desciende de forma gradual.',
  'Semaglutida': 'Agonista GLP-1; vida media ~7 días: de las curvas más largas, permanece presente casi una semana tras la dosis.',
  'Tesamorelin': 'Análogo de GHRH; vida media muy corta (~10 min): se elimina del plasma casi de inmediato, la curva cae de golpe.',
  'MOTS-c': 'Péptido mitocondrial; vida media corta (~1 h): presente solo unas horas. PK extrapolada de modelos animales.',
  '5-Amino-1MQ': 'Molécula pequeña; vida media corta (~3 h): presencia de pocas horas tras la toma.',
  'SLU-PP-332': 'Agonista ERR (investigación); sin farmacocinética humana publicada — su curva es una estimación de referencia, no un dato clínico.',
  'BPC-157': 'Péptido de acción local; vida media plasmática muy corta (minutos–½ h): desaparece rápido de la sangre tras la dosis. Efectos principalmente locales; la curva refleja presencia sistémica, no acción tisular.',
  'TB-500': 'Fracción de timosina β4; vida media corta (~1.5 h): se elimina del plasma en pocas horas.',
  'GHK-Cu': 'Péptido de cobre; vida media muy corta (~45 min): presencia plasmática breve tras la dosis.',
  'ARA 290': 'Péptido derivado de EPO; vida media muy corta (~45 min): la curva cae en menos de una hora.',
  'GLOW 70': 'Blend (BPC-157 + TB-500 + GHK-Cu); curva estimada con la vida media del componente más largo (TB-500, ~1.5 h).',
  'KLOW 80': 'Blend (KPV + BPC-157 + TB-500 + GHK-Cu); curva estimada con la vida media del componente más largo (TB-500, ~1.5 h).',
  'NAD+': 'Coenzima, no un péptido con eliminación de primer orden: no se grafica su decaimiento plasmático.',
  'SS-31': 'Péptido mitocondrial (Elamipretida); vida media corta (~2 h): presente unas horas tras la dosis.',
  'L-Glutathione': 'Antioxidante; vida media plasmática muy corta (~10–15 min, vía parenteral): la curva cae casi de inmediato; la vía oral no es graficable.',
  'Semax': 'Péptido derivado de ACTH; vida media muy corta (~20 min): presencia plasmática fugaz tras la dosis.',
  'Selank': 'Péptido análogo de tuftsina; vida media muy corta (~20 min): se elimina del plasma en minutos.',
  'DSIP': 'Péptido (delta sleep); vida media corta (~45 min): presencia plasmática breve.',
  'Oxytocin': 'Hormona peptídica; vida media ultracorta (~3 min): la curva cae a cero en minutos; sus efectos centrales pueden durar más que su presencia en sangre.',
  'CJC 1295 (No DAC)': 'Análogo de GHRH sin DAC; vida media corta (~30 min): pulso breve, la curva desciende rápido.',
  'Ipamorelin': 'Secretagogo de GH; vida media corta (~2 h): presente unas horas tras la dosis.',
  'Kisspeptin-10': 'Péptido del eje reproductivo; vida media muy corta (~12 min): la curva cae en minutos.',
  'PT-141': 'Análogo de melanocortina (Bremelanotida); vida media corta (~2 h): presencia de pocas horas tras la dosis.',
}

/** Nota educativa curada para un producto. Fallback generado si no hay nota curada. Nunca claims clínicos. */
export function getProductNote(product: string): string {
  if (product in PRODUCT_NOTE) return PRODUCT_NOTE[product]
  const h = HALF_LIFE_H[product]
  if (h == null) return 'Sin vida media de eliminación estándar — no se grafica su decaimiento.'
  if (h < 0.5) return `Vida media muy corta (~${Math.round(h * 60)} min): presencia plasmática fugaz tras la dosis.`
  if (h < 6) return `Vida media corta (~${h} h): presente unas horas tras la dosis.`
  return `Vida media larga (~${Math.round(h / 24)} días): la curva baja lento y sigue presente varios días.`
}

// mg presentes ahora, formateado. Es dosis-equivalente residual (no nivel en sangre); ver disclaimer.
export function fmtMg(mg: number): string {
  if (mg <= 0) return '0 mg'
  if (mg < 0.01) return '<0.01 mg'
  if (mg < 1) return `${mg.toFixed(2)} mg`
  if (mg < 10) return `${mg.toFixed(1)} mg`
  return `${Math.round(mg)} mg`
}

// etiqueta con "~" de estimación, salvo trazas (evita el glitch "~<0.01 mg")
export function fmtApproxMg(mg: number): string {
  if (mg <= 0) return '0 mg'
  if (mg < 0.01) return 'trazas'
  return `~${fmtMg(mg)}`
}
