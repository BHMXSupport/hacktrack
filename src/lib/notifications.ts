// Hacktrack — recordatorios locales (Notification API). Sin backend: notifica con la app abierta /
// vía service worker mientras esté registrado. Copy de auto-registro (compliance: nunca "inyéctate").
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
