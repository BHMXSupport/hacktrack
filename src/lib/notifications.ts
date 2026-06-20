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
// ── Push real via SW (item 401) ──────────────────────────────────────────────
// registerSW(): registra sw.js que escucha mensajes 'SHOW_NOTIF' desde la app.
// scheduleSwReminder(): programa un recordatorio via postMessage al SW activo.
// Funciona con la pantalla apagada si el SW está instalado (Chrome Android, Edge).
// iOS Safari: SW activo pero push sin VAPID server → sólo funciona mientras la app
// está en foreground; para push real desde servidor se requiere VAPID + backend.
//
// ── Recordatorios de medida periódica (item 404) ─────────────────────────────
// scheduleMeasureReminder(name, intervalDays, lastTs): programa un recordatorio
// GENÉRICO (sin nombrar la medida — privacidad) calculando cuándo vence el intervalo desde el último
// registro. Si nunca se registró o ya venció, agenda el intervalo completo desde ahora (nunca al instante).

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

// ── Mostrar notificación (item 380: copia con nombre del producto) ─────────────
export async function showReminder(
  title: string,
  body: string,
  opts?: { tag?: string; product?: string },
): Promise<void> {
  if (!notifSupported() || Notification.permission !== 'granted') return
  const tag = opts?.tag ?? 'hacktrack-reminder'
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, icon: '/pwa-192.png', badge: '/pwa-192.png', tag })
    } else {
      new Notification(title, { body, icon: '/pwa-192.png', tag } as NotificationOptions)
    }
  } catch {
    /* noop */
  }
}

// ── Registro del Service Worker (item 401) ────────────────────────────────────
let _swReg: ServiceWorkerRegistration | null = null

/**
 * Registra el SW (/sw.js). Guarda la referencia para postMessage.
 * Llámalo una vez al montar la app (App.tsx).
 * No-op si el navegador no soporta SW.
 */
export async function registerSW(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    // BUG FIX: el SW vive en BASE_URL (/hacktrack/sw.js en prod), no en '/sw.js' → antes el register
    // daba 404 en prod. Usamos getRegistration (el plugin PWA ya lo registró en el scope correcto)
    // y, si no, registramos en la ruta correcta.
    _swReg = (await navigator.serviceWorker.getRegistration())
      ?? (await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`))
  } catch {
    /* SW no disponible (localhost sin HTTPS, Firefox private, etc.) */
  }
}

/**
 * Programa UNA notificación local. CLAVE: siempre usa setTimeout en el hilo principal (que SÍ dispara
 * con la app ABIERTA) Y además postMessage al SW por si en el futuro hay un SW/push que lo entregue con
 * la app cerrada. Mismo `tag` → si ambos llegaran, el navegador muestra solo una (no duplica).
 * Antes solo posteaba al SW (que es un stub self-destroy y lo ignora) → no disparaba ni con app abierta.
 * Limitación: con la app CERRADA en iOS PWA no llega sin servidor de push (web push / VAPID) — pendiente backend.
 */
export async function scheduleNotif(title: string, body: string, delayMs: number, tag: string): Promise<void> {
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
  await scheduleNotif(`Hora de tu ${product}`, 'Márcalo en un toque y conserva tu racha.', delayMs, `hacktrack-dose-${product}`)
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
      'Aún no lo veo hoy. Ábrelo y márcalo para no romper tu racha.',
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
