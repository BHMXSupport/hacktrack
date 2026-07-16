// Hacktrack — recordatorios locales (Notification API). Sin backend: notifica con la app abierta /
// vía service worker mientras esté registrado. Copy de auto-registro (compliance: nunca "inyéctate").
//
// ── Rescue window (item 168) ────────────────────────────────────────────────
// Cuando el usuario activa una ventana de rescate (rescueWindowMin: 15 | 30 | 60),
// se programa un segundo aviso de "rescate" si no ha registrado dentro de ese período.
//
// Flujo de rescate:
//   1. showReminder() → aviso principal ("Es hora de tu registro")
//   2. scheduleRescueReminder(windowMin, hasRegistered) → si windowMin > 0, llama a
//      setTimeout(windowMin * 60_000) y, al vencer, si hasRegistered() devuelve false,
//      llama a showReminder con el copy de rescate.
//
// ── Recordatorios via SW (item 401) ──────────────────────────────────────────
// El SW real (src/sw.ts, registrado por virtual:pwa-register en provider.tsx) escucha mensajes
// 'SCHEDULE_NOTIF'. Es entrega best-effort (el SO mata SWs ociosos): el setTimeout del hilo
// principal sigue siendo el camino primario con la app abierta. Con la app CERRADA solo entrega
// el push real del servidor (VAPID + push-scheduler — fase cloud).
//
// ── Recordatorios de medida periódica (item 404) ─────────────────────────────
// scheduleMeasureReminder(name, intervalDays, lastTs): programa un recordatorio
// GENÉRICO (sin nombrar la medida — privacidad) calculando cuándo vence el intervalo desde el último
// registro. Si nunca se registró o ya venció, agenda el intervalo completo desde ahora (nunca al instante).

import { rachaLabel } from './buildFlags'
import { scheduleNativeNotif } from './native/notifications'

export function notifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifPermission(): NotificationPermission | 'unsupported' {
  return notifSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotif(): Promise<NotificationPermission> {
  if (!notifSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

// ── Click en notificación → enrutar a la hoja del destino ──────────────────────
// El `tag` codifica el destino (hacktrack-measure-<medida>, hacktrack-dose-<producto>, …). La app
// (provider) registra aquí un manejador que recibe el tag y abre la hoja correcta. Sin esto, picar la
// notificación sólo traía la app al frente, NO a la medida/dosis que ibas a registrar.
let _clickHandler: ((tag: string) => void) | null = null
export function setNotifClickHandler(fn: ((tag: string) => void) | null): void {
  _clickHandler = fn
}

// ── Mostrar notificación (item 380: copia con nombre del producto) ─────────────
export async function showReminder(
  title: string,
  body: string,
  opts?: { tag?: string; product?: string },
): Promise<void> {
  if (!notifSupported() || Notification.permission !== 'granted') return
  const tag = opts?.tag ?? 'hacktrack-reminder'
  try {
    // Icono relativo a BASE_URL: con '/pwa-192.png' absoluto daba 404 bajo /hacktrack/ en gh-pages.
    const icon = `${import.meta.env.BASE_URL}pwa-192.png`
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      // Con SW real, el click lo maneja notificationclick (lee data.tag). data viaja también al push del backend.
      await reg.showNotification(title, { body, icon, badge: icon, tag, data: { tag } } as NotificationOptions)
    } else {
      // App abierta sin SW (caso real en iOS PWA): onclick en el hilo principal → enfoca la app y enruta por tag.
      const n = new Notification(title, { body, icon, tag, data: { tag } } as NotificationOptions)
      n.onclick = () => {
        try { window.focus() } catch { /* noop */ }
        n.close()
        _clickHandler?.(tag)
      }
    }
  } catch {
    /* noop */
  }
}

// ── Registro del Service Worker (item 401) ────────────────────────────────────
let _swReg: ServiceWorkerRegistration | null = null

/**
 * Obtiene la registración del SW para postMessage. El REGISTRO real lo hace virtual:pwa-register
 * (provider.tsx) — registrar aquí también crearía una segunda ruta de registro sin lógica de
 * recarga en controllerchange. No-op si el navegador no soporta SW.
 */
export async function registerSW(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    _swReg = (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    /* SW no disponible (localhost sin HTTPS, Firefox private, etc.) */
  }
}

/**
 * Programa UNA notificación local. CLAVE: siempre usa setTimeout en el hilo principal (que SÍ dispara
 * con la app ABIERTA) Y además postMessage al SW (src/sw.ts), que es best-effort: el SO puede matar el
 * SW ocioso antes de que venza su timer. Mismo `tag` → si ambos llegaran, el navegador muestra solo una.
 * Limitación: con la app CERRADA no llega sin servidor de push (web push / VAPID) — fase cloud.
 */
export async function scheduleNotif(title: string, body: string, delayMs: number, tag: string): Promise<void> {
  // Nativo (Capacitor): LocalNotifications entrega con la app CERRADA y sin tope de 24 h —
  // si el OS agendó, no hace falta el camino web. En web es no-op (false) y seguimos abajo.
  if (delayMs > 0 && (await scheduleNativeNotif(title, body, delayMs, tag))) return
  if (delayMs <= 0 || delayMs > 24 * 60 * 60_000) return // solo hasta 24 h adelante
  try {
    const reg = _swReg ?? (await navigator.serviceWorker?.getRegistration()) ?? null
    reg?.active?.postMessage({ type: 'SCHEDULE_NOTIF', title, body, delayMs, tag })
  } catch { /* sin SW: el setTimeout de abajo cubre el caso app-abierta */ }
  window.setTimeout(() => { void showReminder(title, body, { tag }) }, delayMs)
}

/**
 * Programa un recordatorio via postMessage al SW activo (item 401).
 * El SW usa setTimeout interno para disparar la notificación a la hora indicada.
 * Funciona con la pantalla apagada en Chrome/Edge Android; en iOS sólo en foreground.
 *
 * @param product   Nombre del producto (para copy personalizado, item 380).
 * @param delayMs   Milisegundos hasta mostrar la notificación.
 */
export async function scheduleSwReminder(product: string, delayMs: number): Promise<void> {
  // Título SIN "Hacktrack" (iOS ya muestra "de Hacktrack" debajo). Copy que invita a abrir + engancha con la racha.
  // rachaLabel: en tienda dice "racha de registro" (Apple 1.4.3); PWA sin cambio.
  await scheduleNotif(`Hora de tu ${product}`, `Márcalo en un toque y conserva tu ${rachaLabel()}.`, delayMs, `hacktrack-dose-${product}`)
}

/** Pre-aviso "se acerca" N minutos antes de la dosis (distinto del recordatorio a la hora exacta). */
export async function schedulePreReminder(product: string, minutes: number, delayMs: number): Promise<void> {
  await scheduleNotif(`${product} se acerca`, `Tu toma es en ${minutes} min. Déjalo listo para registrarlo a tiempo.`, delayMs, `hacktrack-pre-${product}`)
}

/** Resumen diario: una notificación con TODOS los protocolos programados para hoy. */
export async function scheduleDailySummary(body: string, delayMs: number): Promise<void> {
  await scheduleNotif('Tu plan de hoy', body, delayMs, 'hacktrack-daily-summary')
}

/** Resumen semanal (lunes): adherencia + racha de la semana. */
export async function scheduleWeeklySummary(body: string, delayMs: number): Promise<void> {
  await scheduleNotif('Tu semana', body, delayMs, 'hacktrack-weekly-summary')
}

/**
 * Aviso de RESCATE: se dispara `delayMs` después (= hora de la dosis + ventana) SOLO si al vencer el
 * usuario AÚN no registró (hasRegistered() === false). Condicional → solo hilo principal (app abierta).
 * @returns función de cancelación (limpiar al re-agendar / desmontar).
 */
export function scheduleRescue(product: string, delayMs: number, hasRegistered: () => boolean): () => void {
  if (delayMs <= 0 || delayMs > 24 * 60 * 60_000) return () => { /* fuera de rango */ }
  const timer = window.setTimeout(() => {
    if (hasRegistered()) return // ya lo registró → no molestar
    void showReminder(
      `¿Registraste tu ${product}?`,
      // rachaLabel: en tienda dice "racha de registro" (Apple 1.4.3); PWA sin cambio.
      `Aún no lo veo hoy. Ábrelo y márcalo para no romper tu ${rachaLabel()}.`,
      { tag: `hacktrack-rescue-${product}` },
    )
  }, delayMs)
  return () => window.clearTimeout(timer)
}

/**
 * Programar un recordatorio de medida periódica (item 404).
 *
 * @param name         Nombre de la medida (p.ej. 'Peso', 'Cintura').
 * @param intervalDays Intervalo en días entre mediciones.
 * @param lastTs       Epoch ms del último registro de esta medida (null → programar para hoy).
 * @returns Función de cancelación del timer.
 */
export function scheduleMeasureReminder(
  name: string,
  intervalDays: number,
  lastTs: number | null,
): () => void {
  if (intervalDays <= 0) return () => { /* noop */ }
  const now = Date.now()
  const intervalMs = intervalDays * 86_400_000
  // Ancla en el último registro de ESTA medida + intervalo. Si nunca se registró (lastTs == null) o ese
  // momento YA pasó (vencido / recién configuraste la frecuencia), agenda el intervalo COMPLETO desde ahora.
  // Antes, esos casos daban delay 0 → la notificación disparaba al instante al cambiar la frecuencia.
  let nextTs = lastTs != null ? lastTs + intervalMs : now + intervalMs
  if (nextTs <= now) nextTs = now + intervalMs
  const delay = nextTs - now
  // setTimeout desborda más allá de ~24.8 días (límite int32) → dispararía al instante. Para esos plazos
  // largos (p.ej. 30 días) no agendamos en cliente: requiere push del servidor (handoff backend).
  const MAX_TIMEOUT = 2_147_483_647
  if (delay <= 0 || delay > MAX_TIMEOUT) return () => { /* fuera de rango fiable de setTimeout */ }

  const dias = `${intervalDays} ${intervalDays === 1 ? 'día' : 'días'}`
  const timer = window.setTimeout(() => {
    void showReminder(
      'Es hora de tu registro',
      // Privacidad: NO nombramos la medida (puede ser sensible, p.ej. función sexual). Solo la cadencia que pidió.
      `Me pediste recordarte registrar una medida cada ${dias}. ¡Hoy toca! Ábrela y anótala para ver tu evolución.`,
      { tag: `hacktrack-measure-${name}` },
    )
  }, delay)

  return () => window.clearTimeout(timer)
}

/**
 * Programa un recordatorio de "rescate" si el usuario no ha registrado dentro de la ventana.
 *
 * @param windowMin  Minutos de tolerancia (0 = desactivado; 15 | 30 | 60 = activo).
 * @param hasRegistered  Callback que devuelve `true` si el usuario ya registró su dosis
 *                       desde que se programó este rescate. Se evalúa al vencer la ventana.
 * @returns Función de cancelación (llama para limpiar el timer, p.ej. al desmontar o si se registra antes).
 *
 * Compliance: el copy de rescate es informativo, nunca instructivo ni médico.
 */
export function scheduleRescueReminder(
  windowMin: 0 | 15 | 30 | 60,
  hasRegistered: () => boolean,
): () => void {
  if (windowMin === 0) return () => { /* noop: ventana desactivada */ }

  const timer = window.setTimeout(async () => {
    if (hasRegistered()) return // ya lo registró — no molestar
    await showReminder(
      'Hacktrack · recordatorio de seguimiento',
      'Aún no tienes un registro de hoy. Abre la app para actualizar tus datos.',
      { tag: 'hacktrack-rescue' },
    )
  }, windowMin * 60_000)

  return () => window.clearTimeout(timer)
}
