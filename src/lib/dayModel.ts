// ── Fuente ÚNICA de verdad del estado del día (demanda integral de Jan) ──────────────────────────────
// dayModel(s, date, now) combina la CADENCIA (obligaciones) con el LOG (lo que realmente pasó) en UN objeto,
// del que cuelgan todas las pantallas → calendario, detalle, Inicio, Semana, Diario derivan lo MISMO y no se
// contradicen. Módulo HOJA: importa de calendar/store/cadence; NADIE de esos lo importa de vuelta (sin ciclos).
//
// INVARIANTE CRÍTICO (torneo + Codex): los ejes están SEPARADOS en campos, no colapsados en un enum.
//  - `scheduleStatus` y la adherencia/racha dependen SOLO de lo PROGRAMADO (cadencia) → una dosis off-cadencia
//    JAMÁS infla racha/adherencia (`tallyDoses`/`protocolStreak` se quedan intactos y siguen siendo la fuente).
//  - `hasVisibleEvent`/`offCadenceProducts`/`visibleProducts` son la señal de "hubo un evento real" para la UI
//    (puntos del calendario, detalle, Diario) — independiente del estado de adherencia.
// Reloj: el modelo recibe `now` real (hora); la identidad del día es `date` (startOfDay implícito vía isoKey).
import type { AppState } from './store'
import { isoKey } from './store'
import {
  dayProducts,
  doseTakenOnProduct,
  doseSkippedOnProduct,
  loggedDoseTs,
  dueTime,
  loggedItemsForDay,
  dayStatusEx,
  type DayStateEx,
} from './calendar'

export interface DayProductEvent {
  product: string
  scheduled: boolean        // la cadencia programa este producto este día (OBLIGACIÓN de adherencia)
  taken: boolean            // hay un item type:'dose' de este producto este día (LOG)
  skipped: boolean          // hay un item type:'skip' intencional este día (LOG)
  offCadence: boolean       // taken && tiene protocolo && NO estaba programado ese día (evento, no obligación)
  takenTs: number | null    // ts REAL del log (hora a mostrar para tomadas), o null
  due: Date                 // hora programada del día para ese producto (reminderTime propio)
}

export interface DayModel {
  dateKey: string
  scheduledProducts: string[]   // SOLO cadencia → base de status/adherencia/racha (NO incluye off-cadencia)
  takenProducts: string[]       // dosis logueadas ese día
  skippedProducts: string[]     // skips intencionales ese día
  offCadenceProducts: string[]  // tomadas de un producto con protocolo en día NO programado (evento, no obligación)
  visibleProducts: string[]     // unión para la UI: programados ∪ logueados (orden: programado → off-cadencia → standalone)
  events: DayProductEvent[]     // una entrada por producto en visibleProducts, con todos los flags
  scheduleStatus: DayStateEx    // IDÉNTICO a dayStatusEx (scheduled-only) — color del calendario, NO se modifica
  hasVisibleEvent: boolean      // ¿hubo alguna dosis/skip real ese día? (señal de evento, separada de la adherencia)
}

export function dayModel(s: AppState, date: Date, now: Date): DayModel {
  const scheduledProducts = dayProducts(s, date)
  const items = loggedItemsForDay(s, date)
  const takenProducts = [...new Set(items.filter((it) => it.type === 'dose' && it.product).map((it) => it.product as string))]
  const skippedProducts = [...new Set(items.filter((it) => it.type === 'skip' && it.product).map((it) => it.product as string))]
  const loggedProducts = [...new Set([...takenProducts, ...skippedProducts])]

  const isOff = (p: string) => takenProducts.includes(p) && !!s.protocols[p] && !scheduledProducts.includes(p)
  const offCadenceProducts = loggedProducts.filter(isOff)
  // Orden = programados → off-cadencia (con protocolo) → standalone (sin protocolo). Mismo orden que el detalle.
  const orphanLogged = loggedProducts.filter((p) => !!s.protocols[p] && !scheduledProducts.includes(p))
  const standaloneLogged = loggedProducts.filter((p) => !s.protocols[p] && !scheduledProducts.includes(p))
  const visibleProducts = [...new Set([...scheduledProducts, ...orphanLogged, ...standaloneLogged])]

  const events: DayProductEvent[] = visibleProducts.map((product) => {
    const taken = takenProducts.includes(product)
    const skipped = skippedProducts.includes(product)
    const scheduled = scheduledProducts.includes(product)
    return {
      product,
      scheduled,
      taken,
      skipped,
      offCadence: isOff(product),
      takenTs: taken ? loggedDoseTs(s, date, product) : null,
      due: dueTime(s, date, product),
    }
  })

  return {
    dateKey: isoKey(date.getTime()),
    scheduledProducts,
    takenProducts,
    skippedProducts,
    offCadenceProducts,
    visibleProducts,
    events,
    // scheduleStatus se computa con la MISMA función de hoy (cadencia-only) → racha/adherencia intactas.
    scheduleStatus: dayStatusEx(s, date, now),
    hasVisibleEvent: loggedProducts.length > 0,
  }
}
