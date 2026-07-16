// Hacktrack — recordatorios locales NATIVOS (@capacitor/local-notifications).
// A diferencia del camino web (setTimeout + SW best-effort de src/lib/notifications.ts),
// las notificaciones nativas las entrega el SO: disparan con la app CERRADA.
//
// SEAM (coordinado por handoff — este módulo NO edita src/lib/notifications.ts):
//   - scheduleNativeNotif(title, body, delayMs, tag) → true si quedó programada nativamente;
//     el caller (scheduleNotif en notifications.ts) puede entonces omitir el camino web.
//   - setNativeNotifTapHandler(routeTag) → el provider registra el MISMO router de tags que
//     ya usa para clicks web (setNotifClickHandler). Los taps que llegan antes de que el
//     handler exista (arranque en frío desde una notificación) se bufferean y se re-emiten.
//
// Compliance: este módulo solo TRANSPORTA copy ya aprobado (auto-registro, nunca instructivo).
// No genera texto propio.
import { isNativePlatform } from './platform'

/** ¿Hay camino nativo de notificaciones? (false en web/PWA → todo no-op). */
export function nativeNotifsAvailable(): boolean {
  return isNativePlatform()
}

// ── tag → id numérico estable ──────────────────────────────────────────────────
// Android exige ids int32; el ecosistema de la app usa tags string ('hacktrack-dose-<producto>').
// FNV-1a de 32 bits: determinista (re-programar el mismo tag REEMPLAZA la notificación anterior,
// misma semántica que el `tag` de la Notification API web) y siempre en 1..2^31-1.
export function tagToId(tag: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const id = h >>> 1 // fuerza no-negativo dentro de int32
  return id === 0 ? 1 : id
}

// ── Router de taps (con buffer de arranque en frío) ────────────────────────────
let _tapHandler: ((tag: string) => void) | null = null
let _pendingTaps: string[] = []

/** Registra el router de taps (mismo contrato que setNotifClickHandler del camino web). */
export function setNativeNotifTapHandler(fn: ((tag: string) => void) | null): void {
  _tapHandler = fn
  if (fn && _pendingTaps.length) {
    const pend = _pendingTaps
    _pendingTaps = []
    for (const t of pend) fn(t)
  }
}

/** Encola o entrega un tap según haya handler (exportado para el listener y los tests). */
export function deliverNativeTap(tag: string): void {
  if (_tapHandler) _tapHandler(tag)
  else _pendingTaps.push(tag)
}

/**
 * Inicializa el listener de taps nativos. Llamar UNA vez en el arranque (main.tsx).
 * No pide permisos aquí — el permiso se pide en el mismo punto de UX que el web
 * (toggle de recordatorios en Ajustes) vía requestNativeNotifPermission().
 */
export async function initNativeNotifications(): Promise<void> {
  if (!nativeNotifsAvailable()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.addListener('localNotificationActionPerformed', (ev) => {
      const tag = (ev.notification.extra as { tag?: unknown } | undefined)?.tag
      if (typeof tag === 'string') deliverNativeTap(tag)
    })
  } catch {
    /* plugin ausente (build web con isNative simulado) — sin taps nativos */
  }
}

/** Pide permiso de notificaciones al SO. true = concedido. */
export async function requestNativeNotifPermission(): Promise<boolean> {
  if (!nativeNotifsAvailable()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const cur = await LocalNotifications.checkPermissions()
    if (cur.display === 'granted') return true
    const res = await LocalNotifications.requestPermissions()
    return res.display === 'granted'
  } catch {
    return false
  }
}

/**
 * Programa UNA notificación local nativa.
 * @returns true si quedó programada por el SO (el caller puede omitir el camino web);
 *          false en web, sin permiso, delay inválido o error de plugin.
 * Sin tope de 24 h: el SO entrega aunque la app esté cerrada (los recordatorios de medida
 * a N días SÍ caben aquí, a diferencia del setTimeout web).
 */
export async function scheduleNativeNotif(
  title: string,
  body: string,
  delayMs: number,
  tag: string,
): Promise<boolean> {
  if (!nativeNotifsAvailable()) return false
  if (!Number.isFinite(delayMs) || delayMs <= 0) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return false
    const id = tagToId(tag)
    // Mismo id → reemplaza la pendiente anterior (semántica del `tag` web). cancel() de una
    // id no programada puede fallar en algunas plataformas — se ignora.
    await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => { /* noop */ })
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + delayMs), allowWhileIdle: true },
          extra: { tag },
        },
      ],
    })
    return true
  } catch {
    return false
  }
}

/** Cancela la notificación nativa pendiente de un tag (p.ej. al registrar antes del rescate). */
export async function cancelNativeNotif(tag: string): Promise<void> {
  if (!nativeNotifsAvailable()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: tagToId(tag) }] })
  } catch {
    /* noop */
  }
}
