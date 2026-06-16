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
// TODO (service worker): Para funcionar con la pantalla apagada el service worker debe
// registrar una tarea periodica (Background Sync o un Scheduled Notification via
// PushManager + backend). La implementación aquí funciona mientras la app esté en
// foreground/background en el browser. La integración completa con SW queda pendiente
// cuando se integre un backend de push.

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

export async function showReminder(title: string, body: string): Promise<void> {
  if (!notifSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: '/pwa-192.png', badge: '/pwa-192.png', tag: 'hacktrack-dose' })
    else new Notification(title, { body, icon: '/pwa-192.png' })
  } catch {
    /* noop */
  }
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
    )
  }, windowMin * 60_000)

  return () => window.clearTimeout(timer)
}
