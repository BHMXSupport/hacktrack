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
  const i = wdsIndex(d)
  switch (cad.mode) {
    case 'dia':
      return !!cad.days[i]
    case 'sem': {
      const weeks = Math.floor(dayDiff(d, start) / 7)
      return weeks % Math.max(1, cad.every) === 0 && !!cad.semDays[i]
    }
    case 'mes': {
      const months =
        (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth())
      return months >= 0 && months % Math.max(1, cad.every) === 0 && d.getDate() === start.getDate()
    }
    case 'cadaN': {
      const day = dayDiff(d, start)
      return day >= 0 && day % Math.max(1, cad.n ?? 1) === 0
    }
    case 'ciclo': {
      const m = (cad.on ?? 1) + (cad.off ?? 0)
      const day = dayDiff(d, start)
      const pos = ((day % m) + m) % m
      return pos < (cad.on ?? 1)
    }
    default:
      return false // 'uso'
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

// tira de la semana actual (lunes ISO → domingo)
export function weekStrip(today: Date): Date[] {
  const monday = startOfDay(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY))
}
