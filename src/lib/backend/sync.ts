// Respaldo/sincronización en la nube — OPT-IN. Estrategia v1: blob completo del estado por usuario con
// last-write-wins por `updated_at` (simple y honesto; el plan permite LWW o CRDT — empezamos por LWW).
// Tabla `user_state(user_id uuid pk, data jsonb, updated_at timestamptz)` con RLS (cada quien solo su fila).
// El provider decide CUÁNDO sincronizar y cómo aplicar el merge; aquí va solo el acceso a datos.
import { backendEnabled } from './config'
import { getSupabase } from './supabase'

export type RemoteState = { data: Record<string, unknown>; updatedAt: number } | null

/** Trae el estado remoto del usuario (o null si no hay fila / sin backend). */
export async function pullRemote(userId: string): Promise<RemoteState> {
  if (!backendEnabled) return null
  const sb = await getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('user_state').select('data, updated_at').eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return { data: (data.data as Record<string, unknown>) ?? {}, updatedAt: new Date(data.updated_at as string).getTime() }
}

/** Sube (upsert) el estado local del usuario, marcando updated_at = ahora. Devuelve ok. */
export async function pushRemote(userId: string, blob: Record<string, unknown>): Promise<boolean> {
  if (!backendEnabled) return false
  const sb = await getSupabase()
  if (!sb) return false
  const { error } = await sb.from('user_state').upsert(
    { user_id: userId, data: blob, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) { console.error('[sync] pushRemote:', error.message); return false }
  return true
}
