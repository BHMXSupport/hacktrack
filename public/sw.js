// Hacktrack Service Worker — recordatorios locales (item 401)
// Recibe mensajes SCHEDULE_NOTIF desde la app y programa notificaciones locales.
// No requiere VAPID ni servidor: funciona mientras el SW esté activo en el navegador.
// Compatible con Chrome/Edge Android (segundo plano); iOS Safari sólo en foreground.

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

// Mapa de timers activos (tag → timeoutId) para poder cancelarlos
const timers = new Map()

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'SCHEDULE_NOTIF') return

  const { title, body, delayMs, tag } = data
  if (typeof delayMs !== 'number' || delayMs < 0) return

  // Cancelar timer previo con el mismo tag
  if (timers.has(tag)) {
    clearTimeout(timers.get(tag))
    timers.delete(tag)
  }

  const id = setTimeout(async () => {
    timers.delete(tag)
    const perm = await Notification.requestPermission().catch(() => 'denied')
    if (perm !== 'granted') return
    self.registration.showNotification(title ?? 'Hacktrack', {
      body: body ?? 'Tienes un recordatorio pendiente.',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: tag ?? 'hacktrack-reminder',
      data: { url: '/' },
    })
  }, delayMs)

  timers.set(tag, id)
})

// Al tocar la notificación: enfocar o abrir la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
