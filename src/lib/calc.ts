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
