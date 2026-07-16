// Respaldo/sincronización en la nube — OPT-IN. Estrategia v1: blob completo del estado por usuario con
// last-write-wins por `updated_at` (simple y honesto; el plan permite LWW o CRDT — empezamos por LWW).
// Tabla `user_state(user_id uuid pk, data jsonb, updated_at timestamptz)` con RLS (cada quien solo su fila).
// El provider decide CUÁNDO sincronizar y cómo aplicar el merge; aquí va solo el acceso a datos.
import { backendEnabled } from './config'
import { getSupabase } from './supabase'

// ── Estado de sincronización (para que Ajustes muestre el estado REAL, no un mock) ──
// `lastSyncAt` persiste en localStorage FUERA del blob sincronizado: nunca viaja a la nube,
// así una restauración no puede importar un "última copia" viejo de otro dispositivo.
const LAST_SYNC_KEY = 'hacktrack:lastCloudSyncAt'
const SYNC_STATUS_EVT = 'hacktrack:sync-status'

export type SyncStatus = { lastSyncAt: number | null; lastPushFailed: boolean }

let lastPushFailed = false

export function getSyncStatus(): SyncStatus {
  let lastSyncAt: number | null = null
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_SYNC_KEY) : null
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) lastSyncAt = n
    }
  } catch { /* localStorage bloqueado (modo privado) → sin fecha, no es fatal */ }
  return { lastSyncAt, lastPushFailed }
}

/** Suscríbete a cambios del estado de sync (push exitoso/fallido, restore). Devuelve unsubscribe. */
export function onSyncStatusChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SYNC_STATUS_EVT, cb)
  return () => window.removeEventListener(SYNC_STATUS_EVT, cb)
}

function emitSyncStatus() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_STATUS_EVT))
}

/** Marca "última copia = ahora". También la llama Ajustes tras restaurar (el estado local == nube). */
export function markCloudSyncedNow(): void {
  try { window.localStorage.setItem(LAST_SYNC_KEY, String(Date.now())) } catch { /* ver arriba */ }
  lastPushFailed = false
  emitSyncStatus()
}

function markPushFailed(): void {
  lastPushFailed = true
  emitSyncStatus()
}

/** Olvida el estado de sync del dispositivo (última copia + fallo pendiente) — al borrar la cuenta,
 *  un sello de "Última copia" viejo sería un residuo del usuario borrado. */
export function clearSyncStatus(): void {
  try { window.localStorage.removeItem(LAST_SYNC_KEY) } catch { /* localStorage bloqueado */ }
  lastPushFailed = false
  emitSyncStatus()
}

// ── Errores → es-MX (toasts honestos, sin jerga de Postgres) ──
function mapSyncError(msg: string): string {
  const m = (msg || '').toLowerCase()
  if (m.includes('permission denied') || m.includes('row-level security') || m.includes('jwt')) {
    return 'Sin permiso para acceder a tu respaldo. Cierra sesión y vuelve a entrar.'
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) {
    return 'Sin conexión. Revisa tu internet e inténtalo otra vez.'
  }
  return 'No se pudo acceder al respaldo. Inténtalo de nuevo.'
}

// ── Pull ──
// Resultado discriminado: error ≠ "no hay respaldo". Un fallo de red/permiso NUNCA debe
// mostrarse como "no tienes respaldo" (mensaje falso que asusta o hace perder datos).
export type PullResult =
  | { ok: true; empty: false; data: Record<string, unknown>; updatedAt: number }
  | { ok: true; empty: true }
  | { ok: false; error: string }

/** Trae el estado remoto del usuario. Distingue: hay datos / no hay fila / falló la lectura. */
export async function pullRemote(userId: string): Promise<PullResult> {
  if (!backendEnabled) return { ok: false, error: 'La nube no está configurada en esta versión.' }
  const sb = await getSupabase()
  if (!sb) return { ok: false, error: 'La nube no está disponible ahora. Inténtalo de nuevo.' }
  try {
    const { data, error } = await sb.from('user_state').select('data, updated_at').eq('user_id', userId).maybeSingle()
    if (error) return { ok: false, error: mapSyncError(error.message) }
    if (!data) return { ok: true, empty: true }
    return {
      ok: true,
      empty: false,
      data: (data.data as Record<string, unknown>) ?? {},
      updatedAt: new Date(data.updated_at as string).getTime(),
    }
  } catch (e) {
    return { ok: false, error: mapSyncError(e instanceof Error ? e.message : String(e)) }
  }
}

// ── Push ──
// El PIN es del DISPOSITIVO por definición de producto: pinHash/pinEnabled jamás suben a la nube
// (un hash SHA-256 de 4 dígitos se revierte en milisegundos con acceso a la BD). Se filtra aquí,
// en el único punto de salida, para que ningún caller pueda subirlo por accidente.
function stripDeviceOnlyFields(blob: Record<string, unknown>): Record<string, unknown> {
  const settings = blob.settings
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const { pinHash, pinEnabled, ...rest } = settings as Record<string, unknown>
    void pinHash; void pinEnabled
    return { ...blob, settings: rest }
  }
  return blob
}

// ── Delete (Cancelación ARCO) ──
// "Eliminar mis datos" debe alcanzar también la nube: fila user_state (historial completo de salud)
// y TODAS las suscripciones push del usuario (si quedan, el push-scheduler seguiría mandando
// recordatorios a una cuenta "borrada"). Resultado tipado como pullRemote: el caller distingue
// éxito de fallo para avisar honesto (nunca "todo borrado" si la nube conserva una copia).
export type DeleteResult = { ok: true } | { ok: false; error: string }

/** Borra la copia remota del usuario: fila user_state + push_subscriptions. Devuelve resultado tipado. */
export async function deleteRemote(userId: string): Promise<DeleteResult> {
  if (!backendEnabled) return { ok: false, error: 'La nube no está configurada en esta versión.' }
  const sb = await getSupabase()
  if (!sb) return { ok: false, error: 'La nube no está disponible ahora. Inténtalo de nuevo.' }
  try {
    const st = await sb.from('user_state').delete().eq('user_id', userId)
    if (st.error) return { ok: false, error: mapSyncError(st.error.message) }
    const ps = await sb.from('push_subscriptions').delete().eq('user_id', userId)
    if (ps.error) return { ok: false, error: mapSyncError(ps.error.message) }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mapSyncError(e instanceof Error ? e.message : String(e)) }
  }
}

/** Sube (upsert) el estado local del usuario, marcando updated_at = ahora. Devuelve ok. */
export async function pushRemote(userId: string, blob: Record<string, unknown>): Promise<boolean> {
  if (!backendEnabled) return false
  const sb = await getSupabase()
  if (!sb) return false
  try {
    const { error } = await sb.from('user_state').upsert(
      { user_id: userId, data: stripDeviceOnlyFields(blob), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error) {
      console.error('[sync] pushRemote:', error.message)
      markPushFailed()
      return false
    }
    markCloudSyncedNow()
    return true
  } catch (e) {
    console.error('[sync] pushRemote:', e)
    markPushFailed()
    return false
  }
}
