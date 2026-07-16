// Selección PURA del cliente a enfocar en notificationclick — separada de src/sw.ts para poder
// probarla en node (sw.ts arranca el worker al importarse). La consume solo el Service Worker.
//
// Por qué existe: clients.matchAll({type:'window', includeUncontrolled:true}) devuelve TODAS las
// ventanas del ORIGEN (aviso-privacidad.html, assets de /promo/, otros proyectos de GitHub Pages
// bajo el mismo dominio). Enfocar una de esas se traga el postMessage NOTIF_GOTO (nadie escucha
// fuera del app shell) y deja inalcanzable el openWindow de respaldo.

// Forma mínima de WindowClient que necesita la selección (estructural: WindowClient la satisface).
export interface WindowClientLike {
  url: string
  focused?: boolean
  visibilityState?: string
}

// Espejo del denylist SPA del SW (NavigationRoute en sw.ts): páginas same-scope que NO son el app shell.
const NON_APP_SHELL = [/\/aviso-privacidad\.html$/, /\/promo\//]

/**
 * Devuelve el mejor cliente del APP SHELL (dentro del scope del SW y fuera del denylist),
 * prefiriendo enfocado > visible > primero (matchAll ya ordena por foco reciente).
 * `undefined` cuando no hay ninguno → el llamador debe abrir ventana nueva (openWindow).
 * Nota: la API Clients no expone si un cliente está "controlado"; foco/visibilidad es el
 * mejor proxy disponible.
 */
export function selectClient<T extends WindowClientLike>(
  clients: readonly T[],
  scope: string,
): T | undefined {
  const appClients = clients.filter((c) => {
    if (!c.url.startsWith(scope)) return false
    try {
      const path = new URL(c.url).pathname
      return !NON_APP_SHELL.some((re) => re.test(path))
    } catch {
      return false // URL inparseable → nunca es el app shell
    }
  })
  if (appClients.length === 0) return undefined
  return (
    appClients.find((c) => c.focused) ??
    appClients.find((c) => c.visibilityState === 'visible') ??
    appClients[0]
  )
}
