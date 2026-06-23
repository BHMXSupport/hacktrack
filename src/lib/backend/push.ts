// Suscripción a Web Push — OPT-IN, requiere VAPID público (pushConfigured) + el Edge Function emisor.
// El cliente se suscribe vía pushManager y guarda la PushSubscription en `push_subscriptions`. El emisor
// (supabase/functions/push-scheduler) lee esa tabla + el user_state y manda los push a la hora de cada dosis.
// NOTA SW: la entrega real necesita que el Service Worker maneje el evento 'push' (hoy el SW es el stub
// selfDestroying de vite-plugin-pwa). Ver SETUP-BACKEND.md §Push para promover el SW. Sin eso, la suscripción
// se guarda pero el navegador no mostrará la notificación entrante.
import { pushConfigured, VAPID_PUBLIC_KEY } from './config'
import { getSupabase } from './supabase'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** ¿El navegador soporta push (PWA instalada en iOS 16.4+, Android, escritorio)? */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

/** Suscribe al usuario a push y guarda la suscripción. Devuelve ok. No-op sin VAPID/backend. */
export async function subscribePush(userId: string): Promise<boolean> {
  if (!pushConfigured || !VAPID_PUBLIC_KEY || !pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
    }
    const json = sub.toJSON()
    const sb = await getSupabase()
    if (!sb) return false
    const { error } = await sb.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    if (error) { console.error('[push] guardar suscripción:', error.message); return false }
    return true
  } catch (e) {
    console.error('[push] subscribePush:', e)
    return false
  }
}

/** Cancela la suscripción local y la borra del servidor. */
export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    const sb = await getSupabase()
    await sb?.from('push_subscriptions').delete().eq('endpoint', endpoint)
  } catch (e) {
    console.error('[push] unsubscribePush:', e)
  }
}
