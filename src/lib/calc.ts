// Hacktrack — calculadora de reconstitución (solo convierte; fix P0-6 escala U-40/50/100)
import type { SyringeScale } from './types'

export interface ReconInput {
  vial: number          // mg en el vial
  agua: number          // mL de agua bacteriostática
  dosis: number         // dosis del usuario
  unit: 'mg' | 'mcg'
  scale: SyringeScale   // capacidad del barril en unidades (30 | 50 | 100), todas U-100
}

export interface ReconResult {
  ui: number            // marcas (unidades) en jeringa U-100 (1 decimal)
  mL: number            // volumen (2 decimales)
  conc: number          // concentración mg/mL (2 decimales)
  scale: SyringeScale   // capacidad del barril (unidades)
  mlBarril: number      // capacidad del barril en mL (0.3 | 0.5 | 1)
  overCapacity: boolean // la dosis no cabe en el barril elegido
  lowPrecision: boolean // < 5 UI: difícil de medir con precisión
}

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

// Las jeringas de insulina/péptidos son U-100 (100 unidades = 1 mL, SIEMPRE). La capacidad del barril
// (0.3/0.5/1 mL = 30/50/100 U) solo limita el máximo; NO cambia la conversión.
// FIX: antes ui = mL × scale, tratando "U-50" como una concentración inexistente.
// La calculadora SOLO convierte la dosis que el usuario teclea; no la decide.
export function calcRecon(i: ReconInput): ReconResult | null {
  const { vial, agua, dosis, unit, scale } = i
  if (!(vial > 0) || !(agua > 0) || !(dosis > 0)) return null
  const conc = vial / agua                          // mg/mL
  const doseMg = unit === 'mcg' ? dosis / 1000 : dosis
  const mL = doseMg / conc                          // volumen a inyectar
  const ui = mL * 100                               // U-100: 100 U = 1 mL
  const uiR = r1(ui)
  return {
    ui: uiR,
    mL: r2(mL),
    conc: r2(conc),
    scale,
    mlBarril: scale / 100,
    overCapacity: ui > scale,
    lowPrecision: ui > 0 && ui < 5, // usa ui crudo (no redondeado) para no perder 4.96→5.0
  }
}

// copy de cumplimiento — verifica con tu jeringa
export function copyToRegisterToast(r: ReconResult): string {
  return `Copiado a tu registro: ${r.ui} UI (jeringa U-100) — verifica con tu jeringa`
}

// ── Vida útil del vial reconstituido (loop 167) ──────────────────────────────

/** Días restantes de vida útil del vial.
 *  reconDate: epoch ms del momento de reconstitución.
 *  shelfDays: vida útil en días del producto (ver VIAL_SHELF_DAYS / DEFAULT_SHELF_DAYS en catalog).
 *  Retorna un número que puede ser negativo (caducado). */
export function vialDaysLeft(reconDate: number, shelfDays: number): number {
  const elapsed = (Date.now() - reconDate) / 86_400_000   // días transcurridos
  return Math.floor(shelfDays - elapsed)                   // días restantes (entero hacia abajo)
}

/** Estado de caducidad del vial.
 *  'ok'     → >3 días restantes (verde / sin indicador)
 *  'soon'   → 0–3 días restantes (naranja: próximo a caducar)
 *  'expired'→ <0 días (rojo: ya caducó)
 *  Nota: esta es una guía de manejo, no consejo médico. */
export function vialExpiryStatus(daysLeft: number): 'ok' | 'soon' | 'expired' {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 3) return 'soon'
  return 'ok'
}

// ── Nivel del vial (loop 166) ─────────────────────────────────────────────────

/** mg consumidos del vial desde la fecha de reconstitución.
 *  Suma todos los doseMg registrados para `product` con ts >= reconDate en el log.
 *  Si reconDate es undefined, retorna 0 (sin reconstitución registrada → sin nivel). */
export function vialMgConsumed(
  log: Array<{ items: Array<{ type: string; product?: string; doseMg?: number; ts: number }> }>,
  product: string,
  reconDate: number | undefined,
): number {
  if (reconDate == null) return 0
  let total = 0
  for (const g of log) {
    for (const it of g.items) {
      if (it.type === 'dose' && it.product === product && it.ts >= reconDate && it.doseMg != null && it.doseMg > 0) {
        total += it.doseMg
      }
    }
  }
  return total
}

/** mg restantes en el vial. Nunca negativo (bottom-out en 0). */
export function vialMgRemaining(vialMg: number, consumed: number): number {
  return Math.max(0, vialMg - consumed)
}

/** Dosis restantes estimadas, dado mg restantes y la dosis típica usada (en mg).
 *  Retorna null si doseMg <= 0 (no se puede calcular). */
export function vialDosesRemaining(remainingMg: number, doseMg: number): number | null {
  if (!(doseMg > 0)) return null
  return Math.floor(remainingMg / doseMg)
}

// ── Media histórica de dosis (hallazgo #A5 — warning de dosis atípica) ────────

/** Devuelve el promedio de los `value` registrados como type='dose' para el
 *  producto e unidad dados, considerando solo registros con value > 0.
 *  Requiere al menos 2 registros para devolver un número (de lo contrario null).
 *  Acepta el log completo de la app (array de LogGroup-compatible). */
export function historicalMeanDose(
  log: Array<{ items: Array<{ type: string; product?: string; value?: number | null; unit?: string | null }> }>,
  product: string,
  unit: string,
): number | null {
  const values: number[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (
        it.type === 'dose' &&
        it.product === product &&
        it.unit === unit &&
        it.value != null &&
        it.value > 0
      ) {
        values.push(it.value)
      }
    }
  }
  if (values.length < 2) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// ¿la unidad necesita la reconstitución del vial para convertirse a mg?
export function needsRecon(unit: string): boolean {
  return unit === 'UI' || unit === 'clics' || unit === 'mL'
}

// convierte una dosis a mg CANÓNICOS (para chart de vida media, presencia, etc.).
// mg/mcg/g se convierten directo. UI/clics y mL requieren la reconstitución (vial mg + agua mL).
// Devuelve null si no se puede convertir (UI/mL sin reconstitución válida).
export function doseToMg(value: number, unit: string, vialMg?: number, aguaMl?: number): number | null {
  if (!(value > 0)) return null
  switch (unit) {
    case 'mg':  return value
    case 'mcg': return value / 1000
    case 'g':   return value * 1000
    case 'UI':
    case 'clics': {
      if (!(vialMg! > 0) || !(aguaMl! > 0)) return null
      const conc = vialMg! / aguaMl!        // mg/mL
      return (value / 100) * conc           // U-100: value U = value/100 mL
    }
    case 'mL': {
      if (!(vialMg! > 0) || !(aguaMl! > 0)) return null
      return value * (vialMg! / aguaMl!)
    }
    default: return null
  }
}
