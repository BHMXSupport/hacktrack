// Farmacocinética educativa: "vida del péptido en el cuerpo".
// Modelo de primer orden con superposición de dosis: A(t) = Σᵢ valueᵢ · 0.5^((t − tsᵢ)/t½)
// Las vidas medias son APROXIMADAS (literatura científica) — esto es una estimación educativa,
// no farmacocinética individual ni consejo médico. (Investigador PK del equipo multiagente.)
import type { AppState } from './store'
import { PEPTIDES, CATEGORY_COLOR } from './catalog'
import { doseToMg } from './calc'

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

// item 279: acumulación — true si una 2ª dosis se aplica antes de que la 1ª caiga al 10%.
// (Movido desde PharmaDashboard.tsx en el split — es lógica PK pura.)
export function hasAccumulation(doses: { ts: number; value: number; product: string }[], halfMs: number): boolean {
  if (doses.length < 2) return false
  const sorted = [...doses].sort((a, b) => a.ts - b.ts)
  for (let i = 1; i < sorted.length; i++) {
    const dtMs = sorted[i].ts - sorted[i - 1].ts
    const remaining = Math.pow(0.5, dtMs / halfMs) // fracción restante de dosis[i-1] al llegar dosis[i]
    if (remaining > 0.1) return true // >10% todavía circulando → acumulación real
  }
  return false
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
  outOfWindow: { product: string; lastTs: number }[]  // #10: registrados pero sin presencia en la ventana actual
  domainX: [number, number]
  domainY: [number, number]
  nowTs: number
  mode: Mode
  hasAnyDose: boolean
}

interface Dose { product: string; value: number; ts: number; approx?: boolean }

// recolecta dosis por producto. El valor numérico (mg) vive en `u` ("Producto · 2 mg").
// Convierte mcg/µg→mg, g→mg; omite unidades no convertibles (UI, mL) o sin número.
export function collectDosesByProduct(s: AppState): Map<string, Dose[]> {
  const byProduct = new Map<string, Dose[]>()
  for (const g of s.log) {
    for (const it of g.items) {
      if (it.type !== 'dose' || it.product == null) continue
      let value: number
      let approx = false // #9: true si el mg es un proxy no confiable (UI/mL/clics sin reconstitución)
      if (it.doseMg != null) {
        value = it.doseMg // mg canónicos ya convertidos (incluye UI/mL con reconstitución)
      } else {
        // Sin doseMg: parsear desde `u`. Toda dosis registrada DEBE graficar (no solo las que
        // tienen reconstitución): mg/mcg/g se convierten; UI/mL se convierten con la reconstitución
        // guardada del producto y, si no hay, se usa el valor crudo como proxy de magnitud.
        const m = it.u.match(/·\s*([\d.]+)\s*([^\s·]*)/)
        const raw = m ? parseFloat(m[1]) : NaN
        const unit = (m?.[2] ?? '').toLowerCase()
        if (unit === 'mcg' || unit === 'µg' || unit === 'ug' || unit === 'μg') value = raw / 1000
        else if (unit === 'g') value = raw * 1000
        else if (unit === 'ui' || unit === 'clics' || unit === 'ml') {
          const rec = s.productRecon[it.product]
          const unitNorm = unit === 'ml' ? 'mL' : unit === 'clics' ? 'clics' : 'UI'
          const mg = rec ? doseToMg(raw, unitNorm, rec.vialMg, rec.aguaMl) : null
          if (mg != null && mg > 0) value = mg
          else { value = raw; approx = true } // #9: sin reconstitución → magnitud cruda, marcada como aprox.
        } else {
          value = raw // mg o sin unidad
        }
      }
      if (!isFinite(value) || value <= 0) continue
      const arr = byProduct.get(it.product) ?? []
      arr.push({ product: it.product, value, ts: it.ts, approx })
      byProduct.set(it.product, arr)
    }
  }
  return byProduct
}

const THRESHOLD = 1e-5 // bajo esto (relativo al pico) → 0, evita artefactos de punto flotante

// Absorción BIFÁSICA (lag + absorción sc) — SOLO GLP-1 de acción prolongada. El resto = instantáneo.
// Parámetros clínicos (investigador PK): el Tmax resultante cae en el rango sc reportado (~1.4–1.7 días).
export const BIPHASIC: Record<string, { tHalfAbsH: number; tLagH: number }> = {
  'Semaglutida': { tHalfAbsH: 9, tLagH: 1 },  // Tmax ≈ 41 h (~1.7 d) — SmPC: Tmax 1–3 d
  'Tirzepatida': { tHalfAbsH: 8, tLagH: 1 },  // Tmax ≈ 35 h (~1.4 d)
  'Retatrutide': { tHalfAbsH: 9, tLagH: 1 },  // Tmax ≈ 39 h (~1.6 d)
}
export const isBiphasic = (product: string): boolean => product in BIPHASIC

// contribución de UNA dosis a la CONCENTRACIÓN PLASMÁTICA estimada (proxy de "efecto"), dt ms tras la inyección.
// Instantáneo: value·0.5^(dt/t½) (péptidos de absorción rápida → pico en la inyección, luego decae).
// Bifásico (GLP-1 sc): curva de Bateman (absorción de 1er orden ka + eliminación ke). EMPIEZA EN ~0 al
// inyectar, SUBE hasta el pico (~Tmax) conforme se absorbe del depósito sc, y LUEGO BAJA lento por la
// eliminación. Durante el breve lag aún no hay nada absorbido → 0. Esto es lo que pide la intuición
// "empezar bajo y efecto máximo después"; es una concentración plasmática estimada, no la cantidad
// total en el cuerpo (esa sería monótona decreciente). El pico de Bateman ≈ value·e^(−ke·Tmax) < value.
function contribution(product: string, value: number, dtMs: number, halfMs: number): number {
  if (dtMs < 0) return 0
  const b = BIPHASIC[product]
  if (!b) return value * Math.pow(0.5, dtMs / halfMs)
  const ke = Math.LN2 / halfMs
  let ka = Math.LN2 / (b.tHalfAbsH * H)
  const tau = dtMs - b.tLagH * H
  if (tau <= 0) return 0 // durante el lag: aún sin absorber → concentración plasmática ~0
  if (Math.abs(ka - ke) < 1e-12) ka = ke * 1.0001 // guard ka≈ke (singularidad)
  // Bateman: sube de 0 al pico (~Tmax) y luego decae con ke. Nunca supera ~value (pico = value·e^(−ke·Tmax)).
  return value * (ka / (ka - ke)) * (Math.exp(-ke * tau) - Math.exp(-ka * tau))
}

// offset (ms) del pico tras la inyección. Bifásico: Tmax analítico = tLag + ln(ka/ke)/(ka−ke) (donde la
// derivada de Bateman se anula). Instantáneo: el pico está en la propia inyección (offset 0).
function tmaxOffsetMs(product: string, halfMs: number): number {
  const b = BIPHASIC[product]
  if (!b) return 0
  const ke = Math.LN2 / halfMs
  let ka = Math.LN2 / (b.tHalfAbsH * H)
  if (Math.abs(ka - ke) < 1e-12) ka = ke * 1.0001
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
  const outOfWindow: { product: string; lastTs: number }[] = [] // #10: registrados, sin presencia en esta ventana
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
    if (dosesInWindow.length === 0 && maxRawWin <= peakMg * 0.005) {
      // #10: no desaparecerlo — registrarlo como "sin presencia en esta ventana" (t½ corta tras un
      // descanso). Vida lo lista con su última dosis en vez de mostrar empty-state "Sin datos".
      const lastTs = r.doses.reduce((m, d) => Math.max(m, d.ts), 0)
      outOfWindow.push({ product: r.product, lastTs })
      continue
    }
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
      // #9: punteada + "~" también cuando algún registro carece de reconstitución (mg aproximado).
      isEstimatedOnly: NO_HUMAN_PK_DATA.has(r.product) || r.doses.some((d) => d.approx),
    })
  }

  // serie con más presencia ahora primero (leyenda y orden de dibujo)
  series.sort((a, b) => b.currentMg - a.currentMg)

  const domainY: [number, number] = mode === 'percent' ? [0, 110] : [0, (maxMg || 1) * 1.1]
  return { series, skipped, outOfWindow, domainX, domainY, nowTs: now, mode, hasAnyDose }
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
  'Retatrutide': 'Triple agonista incretina; absorción sc lenta (pico ~1.5 días) y vida media larga (~6 días): la curva sube desde la inyección hasta su máximo y luego baja lento, sigue presente varios días.',
  'Tirzepatida': 'Doble agonista GIP/GLP-1; absorción sc lenta (pico ~1.4 días) y vida media ~5 días: la curva sube al máximo en el primer par de días y después desciende de forma gradual.',
  'Semaglutida': 'Agonista GLP-1; absorción sc lenta (pico ~1.7 días) y vida media ~7 días: la curva sube hasta su máximo y luego permanece presente casi una semana, de las más largas.',
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

// ── Análisis PK educativos ────────────────────────────────────────────────────
// ESTIMACIONES EDUCATIVAS. Modelo de primer orden (o bifásico según contribution()).
// NO son consejo médico ni recomendación de dosis. Los supuestos se documentan en cada función.
// ─────────────────────────────────────────────────────────────────────────────

// #275 — Ventana de re-dosificación óptima
// Supuesto: la "presencia" decae exponencialmente desde el pico observado (peakOf).
//   Cuando amountAt < targetPct × peakMg se considera ventana abierta.
//   No toma en cuenta tolerancia individual ni efectos farmacodinámicos.
// Retorna: timestamp estimado (ms) de cruce, o null si no hay dosis / ya está por debajo del umbral.
export function nextDoseWindow(
  doses: { product: string; value: number; ts: number }[],
  halfMs: number,
  targetPct = 0.25,
): number | null {
  if (doses.length === 0 || halfMs <= 0) return null
  const product = doses[0].product
  const peak = peakOf(doses, product, halfMs)
  if (peak <= 0) return null
  const target = targetPct * peak
  const now = Date.now()
  // Si ya estamos por debajo del umbral
  if (amountAt(doses, product, halfMs, now) <= target) return now
  // Bisección desde now hasta washout
  return _bisect(
    (t) => amountAt(doses, product, halfMs, t) - target,
    now,
    now + washoutMs(halfMs) * 2,
  )
}

// #276 — Cruce de umbral arbitrario (bisección)
// Supuesto: igual a nextDoseWindow; exposición de primer orden superposicionada.
// pct: fracción del pico (0–1). Retorna el primer ts (ms) donde la curva cruza pct×pico
// después de la última dosis; null si no hay datos o ya está por debajo.
export function thresholdCrossTs(
  doses: { product: string; value: number; ts: number }[],
  product: string,
  halfMs: number,
  pct: number,
): number | null {
  if (doses.length === 0 || halfMs <= 0 || pct <= 0 || pct > 1) return null
  const peak = peakOf(doses, product, halfMs)
  if (peak <= 0) return null
  const target = pct * peak
  const lastDoseTs = Math.max(...doses.map((d) => d.ts))
  const end = lastDoseTs + washoutMs(halfMs) * 2
  const now = Date.now()
  // La curva baja; buscamos el punto donde cruza el umbral (de arriba a abajo)
  const fNow = amountAt(doses, product, halfMs, now) - target
  if (fNow <= 0) return now // ya cruzó
  return _bisect((t) => amountAt(doses, product, halfMs, t) - target, now, end)
}

// Bisección interna: busca raíz de f(t)=0 donde f(lo)>0 y f(hi)<0 (curva decreciente).
// Itera hasta convergencia < 1 s o 60 iteraciones. Retorna null si no hay raíz.
function _bisect(
  f: (t: number) => number,
  lo: number,
  hi: number,
  maxIter = 60,
): number | null {
  if (f(lo) * f(hi) > 0) return null // sin raíz garantizada
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2
    if (hi - lo < 1000) return mid // convergió a < 1 s
    f(mid) > 0 ? (lo = mid) : (hi = mid)
  }
  return (lo + hi) / 2
}

// #285 — Ratio de AUC inter-producto (balance de exposición relativa)
// Supuesto: aucMgH de cada serie ya fue calculado trapezioidalmente en buildPharmaSeries sobre
//   la misma ventana temporal → comparable solo dentro de la misma ventana. No compara unidades
//   farmacodinámicas distintas entre productos; es un índice de exposición relativa, no eficacia.
// Retorna: mapa producto → fracción del AUC total (0–1). Vacío si sum=0.
export function aucRatios(series: Pick<PharmaSeries, 'product' | 'aucMgH'>[]): Record<string, number> {
  const total = series.reduce((s, r) => s + r.aucMgH, 0)
  if (total <= 0) return {}
  return Object.fromEntries(series.map((r) => [r.product, r.aucMgH / total]))
}

// #286 — Regularidad de dosificación (CV% de intervalos inter-dosis)
// Supuesto: intervalos calculados entre dosis CONSECUTIVAS del mismo producto, ordenadas por ts.
//   CV% alto (>50%) sugiere irregularidad que puede afectar steady-state; no es diagnóstico.
// Retorna: CV% (0–∞) o null si hay < 2 intervalos.
export function dosingRegularityCV(
  doses: { ts: number }[],
): number | null {
  if (doses.length < 2) return null
  const sorted = [...doses].sort((a, b) => a.ts - b.ts)
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) intervals.push(sorted[i].ts - sorted[i - 1].ts)
  if (intervals.length === 0) return null
  const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length
  if (mean <= 0) return null
  const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length
  return (Math.sqrt(variance) / mean) * 100
}

// #287 — Tiempo a steady-state (≈ 5 vidas medias)
// Supuesto: regla farmacocinética estándar: con dosis repetidas a intervalos regulares,
//   el steady-state se alcanza en ~5·t½ (>97% del nivel de meseta). No contempla acumulación
//   con bifásico ni dosis variables.
// Retorna: string formateado legible.
export function timeToSteadyState(halfLifeH: number): string {
  if (!isFinite(halfLifeH) || halfLifeH <= 0) return 'n/d'
  const ssH = 5 * halfLifeH
  if (ssH < 1) return `~${Math.round(ssH * 60)} min`
  if (ssH < 48) return `~${ssH % 1 === 0 ? ssH : ssH.toFixed(1)} h`
  const days = ssH / 24
  return `~${days % 1 === 0 ? days : days.toFixed(1)} días`
}

// #288 — Índice de fluctuación peak-trough (para GLP-1 en titulación)
// Supuesto: FI = (C_max − C_min) / C_avg dentro de UN intervalo de dosificación intervalMs.
//   Calculado numéricamente sobre la curva de superposición muestreada (100 puntos).
//   C_min tomado justo antes de la siguiente dosis. Solo significativo con dosis regulares.
// Retorna: FI (adimensional, ≥0) o null si no hay datos suficientes.
export function fluctuationIndex(
  doses: { product: string; value: number; ts: number }[],
  halfMs: number,
  intervalMs: number,
): number | null {
  if (doses.length < 2 || halfMs <= 0 || intervalMs <= 0) return null
  const product = doses[0].product
  // Analizar el último intervalo completo
  const sorted = [...doses].sort((a, b) => a.ts - b.ts)
  const last = sorted[sorted.length - 1]
  const start = last.ts - intervalMs
  if (start < 0) return null
  const N = 100
  let cMax = 0; let cMin = Infinity; let cSum = 0
  for (let i = 0; i <= N; i++) {
    const t = start + (intervalMs * i) / N
    const c = amountAt(doses, product, halfMs, t)
    if (c > cMax) cMax = c
    if (c < cMin) cMin = c
    cSum += c
  }
  const cAvg = cSum / (N + 1)
  if (cAvg <= 0) return null
  if (!isFinite(cMin)) cMin = 0
  return (cMax - cMin) / cAvg
}

// #290 — Histograma de intervalos entre dosis (horas)
// Supuesto: intervalos entre dosis CONSECUTIVAS, ordenadas por ts.
//   Útil para detectar patrones de dosificación (semanales, diarios, etc.).
// Retorna: array de intervalos en horas (h), o vacío si < 2 dosis.
export function doseIntervals(doses: { ts: number }[]): number[] {
  if (doses.length < 2) return []
  const sorted = [...doses].sort((a, b) => a.ts - b.ts)
  const result: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    result.push((sorted[i].ts - sorted[i - 1].ts) / H)
  }
  return result
}

// #293 — Estabilidad de AUC (texto educativo)
// Supuesto: si el CV% de los intervalos inter-dosis supera el 40% consideramos que la irregularidad
//   puede provocar fluctuaciones significativas en la exposición. Umbral conservador; no es diagnóstico.
// Retorna: string de orientación educativa, o null si no hay suficientes dosis.
export function aucStabilityHint(
  doses: { ts: number }[],
  halfMs: number,
): string | null {
  if (doses.length < 3) return null
  const cv = dosingRegularityCV(doses)
  if (cv === null) return null
  const halfLifeH = halfMs / H
  if (cv > 40) {
    return (
      `Variabilidad de intervalo alta (CV ≈ ${cv.toFixed(0)} %). ` +
      `Con t½ ≈ ${formatHalfLife(halfLifeH)}, intervalos irregulares pueden producir ` +
      `fluctuaciones de exposición relevantes. Estimación educativa — consulta a tu médico.`
    )
  }
  return (
    `Intervalos de dosificación regulares (CV ≈ ${cv.toFixed(0)} %). ` +
    `Con t½ ≈ ${formatHalfLife(halfLifeH)}, el perfil de exposición debería ser estable. ` +
    `Estimación educativa — no es un indicador de eficacia clínica.`
  )
}

// #283 — Co-presencia de productos (ventanas de solapamiento)
// Supuesto: dos productos se consideran "simultáneamente presentes" cuando ambos tienen
//   amountAt > PRESENCE_FLOOR_PCT% de su pico respectivo en un instante dado.
//   Muestreo de 200 puntos sobre la ventana [ahora − washout_max, ahora + washout_max].
//   No implica interacción farmacológica; es solo detección de solapamiento temporal.
export interface CoPresenceWindow {
  productA: string
  productB: string
  startTs: number
  endTs: number
  durationH: number
}

export function coPresenceWindows(
  series: Pick<PharmaSeries, 'product' | 'peakMg'>[],
  now: number,
  byProduct: Map<string, { product: string; value: number; ts: number }[]>,
): CoPresenceWindow[] {
  if (series.length < 2) return []

  // Determinar ventana de análisis: desde la dosis más antigua hasta washout del t½ más largo
  let tStart = now
  let tEnd = now
  const halfMsMap: Record<string, number> = {}
  for (const s of series) {
    const h = HALF_LIFE_H[s.product]
    if (h == null) continue
    halfMsMap[s.product] = h * H
    const doses = byProduct.get(s.product) ?? []
    const earliest = doses.reduce((m, d) => Math.min(m, d.ts), now)
    tStart = Math.min(tStart, earliest)
    tEnd = Math.max(tEnd, now + washoutMs(h))
  }
  if (tEnd <= tStart) return []

  const N = 200
  const step = (tEnd - tStart) / N
  const floor = PRESENCE_FLOOR_PCT / 100

  // Para cada par de productos, detectar ventanas de co-presencia
  const result: CoPresenceWindow[] = []
  const products = series.filter((s) => HALF_LIFE_H[s.product] != null)

  for (let ai = 0; ai < products.length; ai++) {
    for (let bi = ai + 1; bi < products.length; bi++) {
      const sA = products[ai]; const sB = products[bi]
      if (sA.peakMg <= 0 || sB.peakMg <= 0) continue
      const halfA = halfMsMap[sA.product]; const halfB = halfMsMap[sB.product]
      if (!halfA || !halfB) continue
      const dosesA = byProduct.get(sA.product) ?? []
      const dosesB = byProduct.get(sB.product) ?? []
      const thA = floor * sA.peakMg; const thB = floor * sB.peakMg

      let windowStart: number | null = null
      for (let i = 0; i <= N; i++) {
        const t = tStart + i * step
        const inA = amountAt(dosesA, sA.product, halfA, t) >= thA
        const inB = amountAt(dosesB, sB.product, halfB, t) >= thB
        const both = inA && inB
        if (both && windowStart === null) {
          windowStart = t
        } else if (!both && windowStart !== null) {
          const dh = (t - windowStart) / H
          if (dh > 0.01) { // ignorar ventanas < ~36 s (artefacto de muestreo)
            result.push({
              productA: sA.product,
              productB: sB.product,
              startTs: windowStart,
              endTs: t,
              durationH: dh,
            })
          }
          windowStart = null
        }
      }
      // Cerrar ventana abierta al final del período
      if (windowStart !== null) {
        const dh = (tEnd - windowStart) / H
        if (dh > 0.01) {
          result.push({
            productA: sA.product,
            productB: sB.product,
            startTs: windowStart,
            endTs: tEnd,
            durationH: dh,
          })
        }
      }
    }
  }
  return result
}
