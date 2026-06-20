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
      data: { tag: tag ?? 'hacktrack-reminder' },
    })
  }, delayMs)

  timers.set(tag, id)
})

// El tag codifica el destino → mapea a un "goto" que la app sabe enrutar.
// hacktrack-measure-<m> → medida:<m>; hacktrack-(dose|pre|rescue)-<p> → registrar:<p>; weekly → tab:semana.
function gotoForTag(tag) {
  if (!tag) return ''
  if (tag.indexOf('hacktrack-measure-') === 0) return 'medida:' + tag.slice('hacktrack-measure-'.length)
  const m = tag.match(/^hacktrack-(?:dose|pre|rescue)-(.+)$/)
  if (m) return 'registrar:' + m[1]
  if (tag === 'hacktrack-weekly-summary') return 'tab:semana'
  return ''
}

// Al tocar la notificación: enfocar la app y llevarla a la hoja del destino.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const tag = event.notification.tag || (event.notification.data && event.notification.data.tag)
  const goto = gotoForTag(tag)
  const base = self.registration.scope // p.ej. https://host/hacktrack/
  const url = goto ? base + '?goto=' + encodeURIComponent(goto) : base
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin))
      if (existing) {
        // App ya abierta: enfoca y avísale el destino por postMessage (enruta sin recargar).
        if (goto) existing.postMessage({ type: 'NOTIF_GOTO', goto })
        return existing.focus()
      }
      return self.clients.openWindow(url) // app cerrada: abre con ?goto= y la app lo lee al cargar
    }),
  )
})
