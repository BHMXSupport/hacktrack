// Hacktrack — Sistema de logros/hitos (item 460)
// `computeAchievements` es pura (stateless): evalúa el AppState y devuelve qué logros
// están desbloqueados. El store compara con `state.achievements` para disparar animaciones.
// No hay consejo médico — son hitos de seguimiento.
import type { AppState } from './store'
import { isoKey } from './store'

export interface Achievement {
  id: string
  title: string
  description: string
  /** id del glyph (components/glyphs.tsx) para el icono del logro */
  glyph: string
  /** Marca si el usuario ya lo desbloqueó (set = ids en state.achievements) */
  unlocked: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const DAY = 86_400_000

function doseStreak(s: AppState, today = s.todayTs): number {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const k = isoKey(d.getTime())
    const g = s.log.find((x) => x.dateKey === k)
    if (g?.items.some((it) => it.type === 'dose')) streak++
    else if (i === 0) continue // hoy en curso
    else break
  }
  return streak
}

function adherenceLastMonth(s: AppState): number {
  const today = new Date(s.todayTs)
  let planned = 0, taken = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const k = isoKey(d.getTime())
    // Si hay protocolo activo, contar días que tocaba
    for (const proto of Object.values(s.protocols)) {
      if (!proto || (proto.archived)) continue
      // Simplificación: si hubo alguna dosis ese día para ese producto → tomada
      const g = s.log.find((x) => x.dateKey === k)
      const taken_today = g?.items.some((it) => it.type === 'dose' && it.product === proto.product) ?? false
      planned++
      if (taken_today) taken++
    }
  }
  if (planned === 0) return 0
  return taken / planned
}

function totalDoses(s: AppState): number {
  return s.log.reduce((n, g) => n + g.items.filter((it) => it.type === 'dose').length, 0)
}

function totalProducts(s: AppState): number {
  return Object.keys(s.protocols).length
}

function kgLost(s: AppState): number {
  const peso = (s.history['Peso'] ?? []).sort((a, b) => a.ts - b.ts)
  if (peso.length < 2) return 0
  return Math.max(0, peso[0].value - peso[peso.length - 1].value)
}

function hasMeasureLastDays(s: AppState, days: number): boolean {
  const cutoff = s.todayTs - days * DAY
  return Object.values(s.history).some((series) =>
    (series ?? []).some((p) => p.ts >= cutoff),
  )
}

// ── Definición de logros ───────────────────────────────────────────────────────
// Orden: el primero que sea verdadero dispara `unlockAchievement`.
interface AchievementDef {
  id: string
  title: string
  description: string
  glyph: string
  /** Evalúa si el logro está desbloqueado dado el estado. */
  check: (s: AppState) => boolean
}

const DEFS: AchievementDef[] = [
  {
    id: 'primera-dosis',
    title: 'Primera dosis registrada',
    description: '¡Comenzaste tu seguimiento! El primer paso es el más importante.',
    glyph: 'logro-dosis',
    check: (s) => s.logged,
  },
  {
    id: 'racha-7',
    title: 'Racha de 7 días',
    description: 'Llevas 7 días consecutivos de registro. ¡Constancia!',
    glyph: 'logro-racha',
    check: (s) => doseStreak(s) >= 7,
  },
  {
    id: 'racha-30',
    title: 'Racha de 30 días',
    description: 'Un mes completo de seguimiento. Eso sí es compromiso.',
    glyph: 'logro-racha-30',
    check: (s) => doseStreak(s) >= 30,
  },
  {
    id: 'racha-90',
    title: 'Racha de 90 días',
    description: '90 días son un hábito sólido. ¡Impresionante!',
    glyph: 'logro-racha-90',
    check: (s) => doseStreak(s) >= 90,
  },
  {
    id: 'racha-180',
    title: 'Racha de 180 días',
    description: 'Medio año de seguimiento consistente.',
    glyph: 'logro-racha-180',
    check: (s) => doseStreak(s) >= 180,
  },
  {
    id: 'adherencia-95',
    title: 'Adherencia ≥95%',
    description: '95% de tus dosis registradas en el último mes. ¡Excelente disciplina!',
    glyph: 'logro-adherencia',
    check: (s) => adherenceLastMonth(s) >= 0.95,
  },
  {
    id: 'primer-kilo',
    title: 'Primer kilo',
    description: 'Registraste 1 kg de cambio de peso. Tu historial habla por sí solo.',
    glyph: 'logro-peso',
    check: (s) => kgLost(s) >= 1,
  },
  {
    id: 'tres-protocolos',
    title: 'Stack de 3 protocolos',
    description: 'Tienes 3 o más productos en tu stack. Un biohacker serio.',
    glyph: 'logro-stack',
    check: (s) => totalProducts(s) >= 3,
  },
  {
    id: 'medidas-activo',
    title: 'Medidas al día',
    description: 'Registraste una medida en los últimos 7 días. Los datos mandan.',
    glyph: 'logro-medidas',
    check: (s) => hasMeasureLastDays(s, 7),
  },
  {
    id: '100-dosis',
    title: '100 registros de dosis',
    description: 'Cien entradas en tu diario. Esto es ciencia personal.',
    glyph: 'logro-100',
    check: (s) => totalDoses(s) >= 100,
  },
  {
    id: 'explorador',
    title: 'Explorador',
    description: 'Probaste un péptido fuera de tu objetivo principal. ¡Curiosidad científica!',
    glyph: 'logro-explorar',
    check: (s) => {
      const primaryCat = s.curGoal
      if (!primaryCat) return false
      return Object.values(s.protocols).some((p) => {
        const import_cat = s.protocols[p.product]
        // Evaluar si hay protocolos de categorías distintas a la primaria
        void import_cat
        return false // placeholder — requiere PEPTIDES lookup (no importar aquí para evitar ciclo)
      })
    },
  },
]

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Calcula los logros desbloqueados a partir del estado completo.
 * Pure function — no muta nada.
 *
 * @param s  AppState actual.
 * @returns  Array de Achievement con `unlocked = true` si el hito se alcanzó,
 *           independientemente de si ya estaba en `s.achievements`.
 */
export function computeAchievements(s: AppState): Achievement[] {
  const unlockedSet = new Set(s.achievements ?? [])
  return DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    glyph: def.glyph,
    unlocked: unlockedSet.has(def.id) || def.check(s),
  }))
}

/**
 * Devuelve los ids de logros que acaban de desbloquearse (están en `computed`
 * pero NO en `s.achievements`). Útil para disparar animaciones y la acción
 * `unlockAchievement` desde un efecto.
 */
export function newlyUnlocked(s: AppState, computed: Achievement[]): string[] {
  const existing = new Set(s.achievements ?? [])
  return computed.filter((a) => a.unlocked && !existing.has(a.id)).map((a) => a.id)
}

/** Todos los logros (desbloqueados y pendientes) para mostrar en el panel de logros. */
export function allAchievements(s: AppState): Achievement[] {
  return computeAchievements(s)
}
