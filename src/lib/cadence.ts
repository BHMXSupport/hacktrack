// Hacktrack — motor de cadencias (port del prototipo + fix P0-3: única fuente de verdad)
import type { PeptideEntry, UserCadence } from './types'
import { WD, MON, WDS } from './catalog'

const DAY = 86400000

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY)
}

// índice en el orden WDS (L Ma Mi J V S D) a partir de getDay() (0=Dom)
function wdsIndex(d: Date): number {
  const g = d.getDay()
  return WDS.findIndex(([, n]) => n === g)
}

// ── Cadencia del catálogo (para derivar próximas tomas sugeridas) ──────────────
export function diaTocaCatalog(d: Date, p: PeptideEntry, start: Date): boolean {
  const day = dayDiff(d, start)
  if (p.type === 'diaria') return true
  if (p.type === 'lv') return d.getDay() >= 1 && d.getDay() <= 5
  if (p.type === 'semanal') return d.getDay() === (p.weekday ?? start.getDay())
  if (p.type === 'cadaN') return day >= 0 && day % (p.n ?? 1) === 0
  if (p.type === 'ciclo') {
    const m = (p.on ?? 1) + (p.off ?? 0)
    const pos = ((day % m) + m) % m
    return pos < (p.on ?? 1)
  }
  return false // 'por-demanda'
}

// ── Cadencia del usuario (fuente de verdad real, P0-3) ─────────────────────────
export function diaTocaCadence(d: Date, cad: UserCadence, start: Date): boolean {
  const day = dayDiff(d, start)
  if (day < 0) return false // no marcar días antes de iniciar el protocolo (fix red-team)
  const i = wdsIndex(d)
  switch (cad.mode) {
    case 'dia':
      return !!cad.days[i]
    case 'sem': {
      const weeks = Math.floor(day / 7)
      return weeks % Math.max(1, cad.every) === 0 && !!cad.semDays[i]
    }
    case 'mes': {
      const months =
        (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth())
      // mes corto: si el día de inicio no existe (p.ej. 31), cae al último del mes
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const targetDay = Math.min(start.getDate(), dim)
      return months >= 0 && months % Math.max(1, cad.every) === 0 && d.getDate() === targetDay
    }
    case 'cadaN':
      return day % Math.max(1, cad.n ?? 1) === 0
    case 'ciclo': {
      const m = (cad.on ?? 1) + (cad.off ?? 0)
      const pos = day % m // day>=0 garantizado
      return pos < (cad.on ?? 1)
    }
    default:
      return false // 'uso'
  }
}

// etiqueta legible de la cadencia REAL del usuario (no la del catálogo) — fix red-team #3
export function cadenceLabel(cad: UserCadence): string {
  switch (cad.mode) {
    case 'uso':
      return 'Por uso'
    case 'cadaN':
      return `Cada ${cad.n} días`
    case 'ciclo':
      return `${cad.on} on / ${cad.off} off`
    case 'mes':
      return cad.every > 1 ? `Cada ${cad.every} meses` : 'Cada mes'
    case 'sem': {
      const days = WDS.filter((_, i) => cad.semDays[i]).map(([l]) => l).join(' ')
      const w = cad.every > 1 ? `Cada ${cad.every} sem` : 'Cada semana'
      return days ? `${w} · ${days}` : w
    }
    case 'dia': {
      const on = cad.days.filter(Boolean).length
      if (on === 7) return 'Cada día'
      const lv = cad.days[0] && cad.days[1] && cad.days[2] && cad.days[3] && cad.days[4] && !cad.days[5] && !cad.days[6]
      if (lv) return 'Lun a Vie'
      const days = WDS.filter((_, i) => cad.days[i]).map(([l]) => l).join(' ')
      return days || 'Sin días'
    }
    default:
      return 'Por uso'
  }
}

// próximas n tomas desde hoy (máx 60 días de lookahead)
export function proximasCadence(
  cad: UserCadence,
  start: Date,
  today: Date,
  n = 3,
): Date[] {
  const out: Date[] = []
  let d = startOfDay(today)
  for (let i = 0; i < 60 && out.length < n; i++) {
    if (diaTocaCadence(d, cad, start)) out.push(new Date(d))
    d = new Date(d.getTime() + DAY)
  }
  return out
}

export function fmtDate(d: Date, today: Date): string {
  const diff = dayDiff(d, today)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`
}

export function fmtTime(d: Date): string {
  let h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ap}`
}

// etiqueta del día para agrupar en el diario
export function dayLabel(d: Date, today: Date): string {
  const diff = dayDiff(d, today)
  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  return `${WD[d.getDay()].slice(0, 3)} ${d.getDate()} ${MON[d.getMonth()]}`
}

// fallback con `?? 'Por uso'` (P0 ya aplicado en el prototipo para 'por-demanda')
export function rhythmLabel(p: PeptideEntry): string {
  return (
    {
      diaria: 'Cada día',
      lv: 'Lun a Vie',
      semanal: 'Cada semana',
      cadaN: `Cada ${p.n} días`,
      ciclo: `${p.on} on / ${p.off} off`,
      'por-demanda': 'Por uso',
    } as Record<string, string>
  )[p.type] ?? 'Por uso'
}

export function rhythmBadge(p: PeptideEntry): string {
  return (
    {
      diaria: 'diario',
      lv: '5 on / 2 off',
      semanal: 'semanal',
      cadaN: `cada ${p.n} días`,
      ciclo: `${p.on}/${p.off}`,
      'por-demanda': 'por uso',
    } as Record<string, string>
  )[p.type] ?? 'por uso'
}

/**
 * cyclePhaseInfo: si la cadencia del usuario es 'ciclo' (on/off), devuelve la fase actual.
 * Retorna null si la cadencia no es de tipo ciclo.
 *
 * @returns { day: number; total: number; phase: 'on' | 'off' }
 *   day   = día 1-based dentro del ciclo actual (p.ej. "Día 3 de 7")
 *   total = duración de la fase activa (on o off)
 *   phase = 'on' | 'off'
 */
export function cyclePhaseInfo(
  cad: UserCadence,
  start: Date,
  today: Date,
): { day: number; total: number; phase: 'on' | 'off' } | null {
  if (cad.mode !== 'ciclo') return null
  const on = cad.on ?? 1
  const off = cad.off ?? 0
  if (on + off === 0) return null
  const elapsed = dayDiff(startOfDay(today), startOfDay(start))
  if (elapsed < 0) return null
  const cycleLen = on + off
  const posInCycle = elapsed % cycleLen
  if (posInCycle < on) {
    return { day: posInCycle + 1, total: on, phase: 'on' }
  } else {
    return { day: posInCycle - on + 1, total: off, phase: 'off' }
  }
}

// preset de cadencia desde el catálogo — maneja los 6 tipos (fix P0-3, ya no degrada a diario)
export function presetCad(p?: PeptideEntry): UserCadence {
  const base: UserCadence = {
    mode: 'dia',
    days: [true, true, true, true, true, true, true],
    every: 1,
    semDays: [true, false, false, false, false, false, false],
  }
  if (!p) return base
  switch (p.type) {
    case 'diaria':
      return base
    case 'lv':
      return { ...base, mode: 'dia', days: [true, true, true, true, true, false, false] }
    case 'semanal': {
      const wd = p.weekday ?? 1
      return { ...base, mode: 'sem', every: 1, semDays: WDS.map(([, n]) => n === wd) }
    }
    case 'cadaN':
      return { ...base, mode: 'cadaN', n: p.n ?? 1 }
    case 'ciclo':
      return { ...base, mode: 'ciclo', on: p.on ?? 1, off: p.off ?? 0 }
    case 'por-demanda':
      return { ...base, mode: 'uso' }
    default:
      return base
  }
}

// matriz mensual (semanas L→D) para el calendario de dosis. null = celda de relleno.
export function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7 // 0=L … 6=D
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// tira de la semana actual (lunes ISO → domingo)
export function weekStrip(today: Date): Date[] {
  const monday = startOfDay(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY))
}
