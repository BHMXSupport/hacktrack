// Hacktrack — calculadora de reconstitución (solo convierte; fix P0-6 escala U-40/50/100)
import type { SyringeScale } from './types'

export interface ReconInput {
  vial: number          // mg en el vial
  agua: number          // mL de agua bacteriostática
  dosis: number         // dosis del usuario
  unit: 'mg' | 'mcg'
  scale: SyringeScale   // 40 | 50 | 100, default 100
}

export interface ReconResult {
  ui: number            // marcas en la jeringa (1 decimal)
  mL: number            // volumen (2 decimales)
  conc: number          // concentración mg/mL (2 decimales)
  scale: SyringeScale
}

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

// La calculadora NO decide la dosis — solo convierte la que el usuario teclea.
export function calcRecon(i: ReconInput): ReconResult | null {
  const { vial, agua, dosis, unit, scale } = i
  if (!(vial > 0) || !(agua > 0) || !(dosis > 0)) return null
  const conc = vial / agua                          // mg/mL
  const doseMg = unit === 'mcg' ? dosis / 1000 : dosis
  const mL = doseMg / conc                          // volumen
  const ui = mL * scale                             // marcas según escala de jeringa (P0-6)
  return { ui: r1(ui), mL: r2(mL), conc: r2(conc), scale }
}

// copy de cumplimiento — incluye la escala para que el usuario verifique con su jeringa
export function copyToRegisterToast(r: ReconResult): string {
  return `Copiado a tu registro: ${r.ui} UI (jeringa U-${r.scale}) — verifica con tu jeringa`
}
