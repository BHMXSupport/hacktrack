// Hacktrack — espejo nativo del estado ('hacktrack:v2' → @capacitor/preferences).
// Seguro contra la evicción de storage de WKWebView (iOS puede purgar localStorage bajo
// presión de disco): Preferences vive en UserDefaults/SharedPreferences y sobrevive.
//
// Arranque (main.tsx, ANTES de montar React): si localStorage está vacío pero el espejo
// existe, se restaura — el provider (loadState) lee localStorage en su primer render, por
// eso la restauración debe completarse antes de render(). En web/PWA todo es no-op.
//
// Espejeo: sondeo debounced (el provider escribe localStorage en cada cambio de estado;
// aquí solo copiamos cuando el blob realmente cambió) + flush inmediato en pagehide /
// visibilitychange→hidden (el SO puede matar el proceso sin aviso después de eso).
import { isNativePlatform } from './platform'

export const STATE_KEY = 'hacktrack:v2'
export const MIRROR_KEY = 'hacktrack:v2:mirror'

/**
 * ¿Debe restaurarse el espejo sobre localStorage? PURA (testeable):
 * solo si localStorage está vacío Y el espejo existe Y parsea como objeto JSON
 * (un espejo corrupto no debe pisar el arranque limpio).
 */
export function shouldRestore(local: string | null, mirror: string | null): boolean {
  if (local != null && local !== '') return false
  if (mirror == null || mirror === '') return false
  try {
    const parsed: unknown = JSON.parse(mirror)
    return typeof parsed === 'object' && parsed !== null
  } catch {
    return false
  }
}

/** ¿Cambió el blob desde el último espejeo? PURA (testeable). */
export function mirrorNeedsWrite(current: string | null, lastMirrored: string | null): boolean {
  return current != null && current !== '' && current !== lastMirrored
}

/**
 * Inicializa restauración + espejeo. Llamar (y AWAITear) en main.tsx antes de render().
 * En web/PWA retorna de inmediato sin tocar nada.
 */
export async function initStateMirror(intervalMs = 4000): Promise<void> {
  if (!isNativePlatform()) return
  try {
    const { Preferences } = await import('@capacitor/preferences')

    // 1) Restauración: localStorage vacío + espejo válido → recuperar el estado.
    const local = localStorage.getItem(STATE_KEY)
    const { value: mirror } = await Preferences.get({ key: MIRROR_KEY })
    if (shouldRestore(local, mirror)) {
      localStorage.setItem(STATE_KEY, mirror as string)
    }

    // 2) Espejeo continuo (debounced por sondeo + flush en background).
    let last = localStorage.getItem(STATE_KEY)
    const flush = () => {
      try {
        const cur = localStorage.getItem(STATE_KEY)
        if (mirrorNeedsWrite(cur, last)) {
          last = cur
          void Preferences.set({ key: MIRROR_KEY, value: cur as string })
        }
      } catch {
        /* cuota / storage bloqueado: reintenta en el próximo tick */
      }
    }
    window.setInterval(flush, intervalMs)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  } catch {
    /* plugin ausente — la app sigue con localStorage solamente */
  }
}
