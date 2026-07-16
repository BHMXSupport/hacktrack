/// <reference lib="webworker" />
// Hacktrack Service Worker real (reemplaza el stub selfDestroying y el viejo public/sw.js).
// Compilado por vite-plugin-pwa (strategies: 'injectManifest') → dist/sw.js con el precache inyectado.
//
// Responsabilidades:
//  1. Precache atómico del shell + assets (JS/CSS/HTML/media) — versionan JUNTOS, así el JS nuevo
//     nunca apunta a media con hash ya borrado del servidor (la causa del outage original).
//  2. Fallback SPA de navegación al index precacheado (funciona offline).
//  3. Runtime cache SOLO para Google Fonts; Supabase pasa SIEMPRE por red (tokens/datos de usuario).
//  4. SCHEDULE_NOTIF por postMessage (best-effort: el SO mata SWs ociosos a ~30s — el setTimeout del
//     hilo principal en notifications.ts sigue siendo la entrega primaria; mismo tag → no duplica).
//  5. push / notificationclick para el push real del backend (supabase/functions/push-scheduler).

import { clientsClaim, cacheNames } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, getCacheKeyForURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { createPartialResponse } from 'workbox-range-requests'
import { selectClient } from './lib/sw-clients'

declare let self: ServiceWorkerGlobalScope

// El worker nuevo toma control inmediato; virtual:pwa-register recarga la página en controllerchange,
// así ningún cliente queda pidiendo chunks viejos ya purgados del precache.
self.skipWaiting()
clientsClaim()

// ── Media con Range → 206 desde el precache (iOS) ────────────────────────────────────────────────
// WebKit pide media SIEMPRE con `Range: bytes=…` y RECHAZA una respuesta no-206 del SW: el <video>
// dispara 'error' y jamás 'ended' (Chrome sintetiza el 206, Safari no). El precache de workbox
// responde 200 completo, así que sin esta ruta los mp4 precacheados brickean el gate de arranque
// en iOS. Registrada ANTES de precacheAndRoute para ganarle el match (el Router usa la primera
// ruta que matchea). Matchea destination 'video' (elementos <video>) y cualquier request
// same-origin con header Range; sin entrada en precache cae a red (GitHub Pages sí da 206 nativo).
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'video' || request.headers.has('range')),
  async ({ request }) => {
    const cacheKey = getCacheKeyForURL(request.url)
    const cached = cacheKey ? await (await caches.open(cacheNames.precache)).match(cacheKey) : undefined
    if (!cached) return fetch(request)
    return request.headers.has('range') ? createPartialResponse(request, cached) : cached
  },
)

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Fallback SPA: toda navegación sirve el index precacheado, EXCEPTO la página independiente de
// privacidad (enlazada desde Perfil/Account) y los assets de /promo/ (fuera del app shell).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/\/aviso-privacidad\.html$/, /\/promo\//],
  }),
)

// Supabase: red directa SIEMPRE. Equivale a no tener ruta, pero blinda contra que una ruta futura
// más golosa cachee tokens de auth o datos del usuario.
registerRoute(({ url }) => url.hostname.endsWith('.supabase.co'), new NetworkOnly())

// Google Fonts (portado 1:1 de la config generateSW previa en vite.config.ts).
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\//,
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\//,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// Icono resuelto contra el scope del SW → /hacktrack/pwa-192.png en prod (con ruta absoluta '/pwa-192.png'
// daba 404 bajo el subpath de GitHub Pages). iOS lo ignora y usa el icono de la app.
const ICON_URL = new URL('pwa-192.png', self.registration.scope).href

// ── Carga útil del push (backend: supabase/functions/push-scheduler) ────────────────────────────
// Contrato: { title, body, tag, data:{ goto } }; `url` top-level es forward-compat.
// Función PURA y exportada para poder probarla en node sin arrancar el worker.
export interface PushPayload {
  title: string
  body: string
  tag: string
  url?: string
  data?: { goto?: string }
}

export function parsePushPayload(raw: string | null): PushPayload {
  const p: PushPayload = { title: 'Hacktrack', body: 'Tienes un recordatorio pendiente.', tag: 'hacktrack-reminder' }
  if (raw == null || raw === '') return p
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const o = parsed as Partial<PushPayload>
      if (typeof o.title === 'string' && o.title) p.title = o.title
      if (typeof o.body === 'string' && o.body) p.body = o.body
      if (typeof o.tag === 'string' && o.tag) p.tag = o.tag
      if (typeof o.url === 'string') p.url = o.url
      if (o.data && typeof o.data === 'object' && typeof (o.data as { goto?: unknown }).goto === 'string') {
        p.data = { goto: (o.data as { goto: string }).goto }
      }
    } else {
      p.body = raw // payload de texto plano (o JSON escalar) → cuerpo tal cual
    }
  } catch {
    p.body = raw
  }
  return p
}

// El tag codifica el destino → mapea a un "goto" que la app sabe enrutar (provider.tsx routeGoto).
// hacktrack-measure-<m> → medida:<m>; hacktrack-(dose|pre|rescue)-<p> → registrar:<p>; weekly → tab:semana.
export function gotoForTag(tag: string | undefined | null): string {
  if (!tag) return ''
  if (tag.startsWith('hacktrack-measure-')) return 'medida:' + tag.slice('hacktrack-measure-'.length)
  const m = tag.match(/^hacktrack-(?:dose|pre|rescue)-(.+)$/)
  if (m) return 'registrar:' + m[1]
  if (tag === 'hacktrack-weekly-summary') return 'tab:semana'
  return ''
}

// ── SCHEDULE_NOTIF: recordatorio local programado desde la app (portado de public/sw.js) ────────
// Mapa de timers activos (tag → timeoutId) para poder cancelar/reemplazar por tag.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; title?: string; body?: string; delayMs?: number; tag?: string } | null
  if (!data || data.type !== 'SCHEDULE_NOTIF') return
  const { title, body, delayMs } = data
  if (typeof delayMs !== 'number' || delayMs < 0) return
  const tag = data.tag ?? 'hacktrack-reminder'

  const prev = timers.get(tag)
  if (prev != null) {
    clearTimeout(prev)
    timers.delete(tag)
  }
  const id = setTimeout(() => {
    timers.delete(tag)
    // requestPermission() NO es invocable en contexto SW (no hay gesto de usuario) → solo consultar.
    if (Notification.permission !== 'granted') return
    void self.registration.showNotification(title ?? 'Hacktrack', {
      body: body ?? 'Tienes un recordatorio pendiente.',
      icon: ICON_URL,
      badge: ICON_URL,
      tag,
      data: { tag },
    })
  }, delayMs)
  timers.set(tag, id)
})

// ── push: entrega real con la app cerrada (requiere VAPID + push-scheduler activos) ─────────────
self.addEventListener('push', (event) => {
  let raw: string | null = null
  try {
    raw = event.data ? event.data.text() : null
  } catch {
    raw = null
  }
  const p = parsePushPayload(raw)
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      tag: p.tag,
      icon: ICON_URL,
      badge: ICON_URL,
      data: { tag: p.tag, url: p.url, goto: p.data?.goto },
    }),
  )
})

// ── notificationclick: enfocar la app y llevarla a la hoja del destino ──────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data ?? {}) as { tag?: string; goto?: string }
  const tag = event.notification.tag || data.tag || ''
  // El push trae el goto explícito en data; los recordatorios locales lo derivan del tag.
  const goto = data.goto || gotoForTag(tag)
  const base = self.registration.scope // p.ej. https://host/hacktrack/
  const url = goto ? base + '?goto=' + encodeURIComponent(goto) : base
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // SOLO clientes del app shell (scope + fuera del denylist): matchAll devuelve TODO el origen
      // (aviso-privacidad.html, /promo/, otros proyectos de Pages) y enfocar una de esas pestañas
      // tragaba el NOTIF_GOTO sin listener y dejaba el openWindow inalcanzable.
      const existing = selectClient(wins as readonly WindowClient[], self.registration.scope)
      if (existing) {
        // App ya abierta: enfoca y avísale el destino por postMessage (provider.tsx escucha NOTIF_GOTO).
        if (goto) existing.postMessage({ type: 'NOTIF_GOTO', goto })
        return existing.focus()
      }
      return self.clients.openWindow(url) // sin cliente del app shell: abre con ?goto= y la app lo lee al cargar
    }),
  )
})
