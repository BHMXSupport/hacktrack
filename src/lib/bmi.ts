// Hacktrack — IMC (detección cm vs metros; consolidado, audit P1-4)

export function bmiCalc(w: number, h: number): number | null {
  if (!(w > 0) || !(h > 0)) return null
  const m = h > 3 ? h / 100 : h // si h>3 asumimos cm; si no, metros
  const v = w / (m * m)
  return v > 0 && v < 200 ? Math.round(v * 10) / 10 : null // tope 200: cubre casos clínicos/atletas extremos
}

export function bmiBand(bmi: number | null): string {
  if (bmi == null) return '—'
  if (bmi < 18.5) return 'bajo'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'sobrepeso'
  return 'alto'
}
