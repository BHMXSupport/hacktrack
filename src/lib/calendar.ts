// Hacktrack — helpers del calendario (estados por día, fases, adherencia semanal, agenda, export .ics).
import type { AppState } from './store'
import { trackedProtocols, productsOnDay, isoKey } from './store'
import { startOfDay, dayDiff } from './cadence'
import { PEPTIDES } from './catalog'

export type DayState = 'taken' | 'missed' | 'scheduled' | 'none'
/** DayState extendido: 'rest' = no tocaba dosis (día libre por cadencia); 'missed' = tocaba y no se tomó. */
export type DayStateEx = 'taken' | 'missed' | 'rest' | 'scheduled' | 'none'

const nextLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

// productos programados ese día
export function dayProducts(s: AppState, d: Date): string[] {
  return productsOnDay(d, trackedProtocols(s))
}

// ¿se registró una dosis de ESTE producto ese día? (las dosis legado ya se estamparon en hydrate)
// NOTA: un skip intencional NO cuenta como dosis tomada.
export function doseTakenOnProduct(s: AppState, d: Date, product: string): boolean {
  const g = s.log.find((x) => x.dateKey === isoKey(d.getTime()))
  return !!g?.items.some((it) => it.type === 'dose' && it.product === product)
}

// ¿se marcó como skip intencional ESTE producto ese día?
export function doseSkippedOnProduct(s: AppState, d: Date, product: string): boolean {
  const g = s.log.find((x) => x.dateKey === isoKey(d.getTime()))
  return !!g?.items.some((it) => it.type === 'skip' && it.product === product)
}

// hora de la toma ese día según el reminderTime DE ESE producto (cada uno puede tener el suyo)
export function dueTime(s: AppState, d: Date, product?: string): Date {
  const rt = (product && s.protocols[product]?.reminderTime) || s.protocol?.reminderTime || '08:00'
  const [hh, mm] = rt.split(':').map(Number)
  const at = startOfDay(d)
  at.setHours(hh || 0, mm || 0, 0, 0)
  return at
}

// estado agregado del día: 'taken' si TODOS los productos del día están tomados.
// 'missed' solo si TODOS los pendientes ya vencieron (su propia hora); si alguno aún no vence → 'scheduled'.
// `now` debe ser la hora REAL (new Date()), no todayTs (medianoche).
export function dayStatus(s: AppState, d: Date, now: Date): DayState {
  const prods = dayProducts(s, d)
  if (prods.length === 0) return 'none'
  // Los productos con skip intencional se excluyen: no cuentan ni como tomados ni como pendientes.
  const effective = prods.filter((p) => doseTakenOnProduct(s, d, p) || !doseSkippedOnProduct(s, d, p))
  if (effective.length === 0) return 'none'  // todos saltados → día neutral
  const unfulfilled = effective.filter((p) => !doseTakenOnProduct(s, d, p))
  if (unfulfilled.length === 0) return 'taken'
  const allPast = unfulfilled.every((p) => now.getTime() > dueTime(s, d, p).getTime())
  return allPast ? 'missed' : 'scheduled'
}

/**
 * dayStatusEx: igual que dayStatus pero devuelve 'rest' cuando no hay dosis programadas
 * en lugar de 'none', para distinguir "día de descanso por cadencia" de "no hay protocolo".
 * 'rest'     = hay protocolo activo pero la cadencia no programa toma este día
 * 'none'     = sin protocolo en absoluto (sin tracks)
 * 'taken'    = todas las dosis del día registradas
 * 'missed'   = tocaba y no se tomó (ya venció la hora)
 * 'scheduled'= toca hoy pero aún no vence la hora
 */
export function dayStatusEx(s: AppState, d: Date, now: Date): DayStateEx {
  const hasAnyProtocol = Object.keys(s.protocols).length > 0
  const prods = dayProducts(s, d)
  if (prods.length === 0) return hasAnyProtocol ? 'rest' : 'none'
  const effective = prods.filter((p) => doseTakenOnProduct(s, d, p) || !doseSkippedOnProduct(s, d, p))
  if (effective.length === 0) return 'rest'
  const unfulfilled = effective.filter((p) => !doseTakenOnProduct(s, d, p))
  if (unfulfilled.length === 0) return 'taken'
  const allPast = unfulfilled.every((p) => now.getTime() > dueTime(s, d, p).getTime())
  return allPast ? 'missed' : 'scheduled'
}

/**
 * productStreak: días consecutivos con ≥1 dosis de ESE producto (hacia atrás desde hoy).
 * Ignora días en que la cadencia no programa toma (días de descanso no rompen la racha).
 */
export function productStreak(s: AppState, product: string, today: Date): number {
  const tracked = trackedProtocols(s).find((t) => t.product === product)
  if (!tracked) return 0
  let count = 0
  let d = startOfDay(today)
  for (let i = 0; i < 365; i++) {
    // si ese día no programaba toma, lo ignoramos (día de descanso por cadencia)
    const scheduled = dayProducts(s, d).includes(product)
    if (!scheduled) {
      // retroceder, pero solo si ya empezó el protocolo (no contar hacia antes del start)
      if (d.getTime() < startOfDay(tracked.start).getTime()) break
      d = new Date(d.getTime() - 86400000)
      continue
    }
    const took = doseTakenOnProduct(s, d, product)
    if (!took) break
    count++
    d = new Date(d.getTime() - 86400000)
  }
  return count
}

/**
 * weekAdherencePctLast8: adherencia por semana de las últimas 8 semanas completas (más reciente primero).
 * Retorna un array de 8 valores 0..100 (o null si no hubo dosis programadas esa semana).
 */
export function weekAdherencePctLast8(s: AppState, today: Date): (number | null)[] {
  const now = new Date()
  // Semana ISO L→D de hoy
  const thisMonday = startOfDay(today)
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const results: (number | null)[] = []
  for (let w = 0; w < 8; w++) {
    const monday = new Date(thisMonday.getTime() - w * 7 * 86400000)
    const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000))
    results.push(weekAdherencePct(s, days, now))
  }
  return results
}

// items del diario de ese día
export function loggedItemsForDay(s: AppState, d: Date) {
  return s.log.find((x) => x.dateKey === isoKey(d.getTime()))?.items ?? []
}

// fase de titulación a la que cae una fecha para un PRODUCTO (null si no aplica) — DST-safe
export function phaseForDate(s: AppState, d: Date, product?: string): number | null {
  const p = product ? s.protocols[product] : s.protocol
  if (!p?.progOn) return null
  const phaseWeeks = PEPTIDES[p.product]?.phaseWeeks
  if (!phaseWeeks) return null
  const weeks = Math.floor(dayDiff(startOfDay(d), startOfDay(new Date(p.startDate))) / 7)
  if (weeks < 0) return null
  return Math.min((p.progN ?? 1) - 1, Math.max(0, Math.floor(weeks / phaseWeeks)))
}

// adherencia de una semana (7 fechas L→D) — POR PRODUCTO programado. `now` = hora real.
export function weekAdherencePct(s: AppState, weekDays: Date[], now: Date): number | null {
  let due = 0
  let taken = 0
  for (const d of weekDays) {
    for (const p of dayProducts(s, d)) {
      if (doseSkippedOnProduct(s, d, p) && !doseTakenOnProduct(s, d, p)) continue  // skip sin toma real: ignorar (la toma gana)
      if (doseTakenOnProduct(s, d, p)) { due++; taken++ }
      else if (now.getTime() > dueTime(s, d, p).getTime()) { due++ }
    }
  }
  return due === 0 ? null : Math.round((taken / due) * 100)
}

/**
 * dayAdherencePct: adherencia de UN día (0-100) o null si no hay dosis programadas ese día.
 * Solo cuenta dosis cuyo dueTime ya venció (no cuenta tomas futuras).
 * Usado por el heat-map de intensidad en CalendarMonth.
 */
export function dayAdherencePct(s: AppState, d: Date, now: Date): number | null {
  const prods = dayProducts(s, d)
  if (prods.length === 0) return null
  // excluir skips sin toma real
  const effective = prods.filter((p) => doseTakenOnProduct(s, d, p) || !doseSkippedOnProduct(s, d, p))
  if (effective.length === 0) return null
  // solo contar dosis cuya hora ya venció (como hace weekAdherencePct)
  let due = 0
  let taken = 0
  for (const p of effective) {
    if (doseTakenOnProduct(s, d, p)) { due++; taken++ }
    else if (now.getTime() > dueTime(s, d, p).getTime()) { due++ }
  }
  return due === 0 ? null : Math.round((taken / due) * 100)
}

export interface PendingDose { date: Date; product: string; id?: string }

/**
 * pendingDoses: tomas de HOY o ATRASADAS que aún NO se han registrado y cuya dueTime ya venció.
 * Usadas en CalendarAgenda para mostrar el botón "✓ Marcar".
 * `now` = hora real. Retorna un array con { date (la dueTime exacta), product }.
 */
export function pendingDoses(s: AppState, now: Date): PendingDose[] {
  const tracked = trackedProtocols(s)
  if (!tracked.length) return []
  const today = startOfDay(now)
  const out: PendingDose[] = []
  // Mirar desde (hoy - 30 días) hasta hoy para cubrir atrasos razonables
  for (let offset = -30; offset <= 0; offset++) {
    const d = new Date(today.getTime() + offset * 86400000)
    for (const t of tracked) {
      const prods = dayProducts(s, d)
      if (!prods.includes(t.product)) continue
      if (doseTakenOnProduct(s, d, t.product)) continue
      if (doseSkippedOnProduct(s, d, t.product)) continue
      const due = dueTime(s, d, t.product)
      if (now.getTime() > due.getTime()) {
        out.push({ date: due, product: t.product })
      }
    }
  }
  return out
}

export interface UpcomingDose { date: Date; product: string }

// próximas tomas (vista agenda): cada producto-día con su hora, desde `now`
export function upcomingDoses(s: AppState, now: Date, n = 30, lookaheadDays = 120): UpcomingDose[] {
  const tracked = trackedProtocols(s)
  if (!tracked.length) return []
  const out: UpcomingDose[] = []
  let d = startOfDay(now)
  for (let i = 0; i < lookaheadDays && out.length < n; i++) {
    for (const p of productsOnDay(d, tracked)) {
      const at = dueTime(s, d, p)
      if (at.getTime() > now.getTime()) out.push({ date: at, product: p })
    }
    d = nextLocalDay(d)
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, n)
}

// ── Export .ics (calendario del sistema) ─────────────────────────────────────
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
function icsEsc(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}
// plegado de líneas a 75 octetos (RFC 5545): continuación con CRLF + espacio
function icsFold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = [line.slice(0, 74)]
  let i = 74
  while (i < line.length) { parts.push(' ' + line.slice(i, i + 73)); i += 73 }
  return parts.join('\r\n')
}

export function buildIcs(s: AppState, now: Date): string {
  const events = upcomingDoses(s, now, 60, 120)
  const raw = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hacktrack//ES//', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const e of events) {
    const end = new Date(e.date.getTime() + 30 * 60000)
    const slug = e.product.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    raw.push(
      'BEGIN:VEVENT',
      `UID:hacktrack-${slug}-${icsStamp(e.date)}@hacktrack.app`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART:${icsStamp(e.date)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:Hacktrack · ${icsEsc(e.product)}`,
      'DESCRIPTION:Es hora de tu registro de hoy.',
      'BEGIN:VALARM',
      'TRIGGER:-PT0M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Es hora de tu registro de hoy.',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  raw.push('END:VCALENDAR')
  return raw.map(icsFold).join('\r\n')
}

// dispara la descarga del .ics (cliente)
export function downloadIcs(content: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'hacktrack-calendario.ics'
  a.click()
  URL.revokeObjectURL(url)
}
