// Respaldo/sincronización en la nube — OPT-IN. Estrategia v2 (Opción C): merge POR REGISTRO
// (src/lib/merge.ts) + push CAS por `rev`: se lee (data, rev), se fusiona con el payload local y se
// escribe con UPDATE ... WHERE rev = <rev leído> SET rev = rev+1 — 0 filas afectadas significa que otro
// dispositivo escribió en medio → re-pull + re-merge + reintento (máx. 3). Un push puede TRAER novedades
// remotas: el resultado incluye el payload fusionado para aplicarlo localmente (acción 'applyMerged').
// Tabla `user_state(user_id uuid pk, data jsonb, rev bigint, updated_at timestamptz)` con RLS.
import { backendEnabled } from './config'
import { getSupabase } from './supabase'
import { prepareSyncPayload, sanitizeImport, type AppState, type SyncPayload } from '../store'
import { mergeStates, TOMBSTONE_TTL_MS } from '../merge'

// ── Estado de sincronización (para que Ajustes muestre el estado REAL, no un mock) ──
// `lastSyncAt` y `lastSeenRev` persisten en localStorage FUERA del blob sincronizado: nunca viajan
// a la nube, así una restauración no puede importar un "última copia" viejo de otro dispositivo.
const LAST_SYNC_KEY = 'hacktrack:lastCloudSyncAt'
const LAST_REV_KEY = 'hacktrack:lastCloudSyncRev'
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

/** Última `rev` remota vista por ESTE dispositivo (solo diagnóstico/telemetría local; el push CAS
 *  re-lee la rev real en cada intento — nunca confía en este valor para escribir). */
export function getLastSeenRev(): number | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_REV_KEY) : null
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) return n
    }
  } catch { /* localStorage bloqueado */ }
  return null
}

function setLastSeenRev(rev: number): void {
  try { window.localStorage.setItem(LAST_REV_KEY, String(rev)) } catch { /* localStorage bloqueado */ }
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

/** Olvida el estado de sync del dispositivo (última copia + rev vista + fallo pendiente) — al borrar
 *  la cuenta, un sello de "Última copia" viejo sería un residuo del usuario borrado. */
export function clearSyncStatus(): void {
  try {
    window.localStorage.removeItem(LAST_SYNC_KEY)
    window.localStorage.removeItem(LAST_REV_KEY)
  } catch { /* localStorage bloqueado */ }
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
  | { ok: true; empty: false; data: Record<string, unknown>; updatedAt: number; rev: number }
  | { ok: true; empty: true }
  | { ok: false; error: string }

/** Trae el estado remoto del usuario (data + rev para el CAS). Distingue: hay datos / no hay fila / falló la lectura. */
export async function pullRemote(userId: string): Promise<PullResult> {
  if (!backendEnabled) return { ok: false, error: 'La nube no está configurada en esta versión.' }
  const sb = await getSupabase()
  if (!sb) return { ok: false, error: 'La nube no está disponible ahora. Inténtalo de nuevo.' }
  try {
    const { data, error } = await sb.from('user_state').select('data, updated_at, rev').eq('user_id', userId).maybeSingle()
    if (error) return { ok: false, error: mapSyncError(error.message) }
    if (!data) return { ok: true, empty: true }
    return {
      ok: true,
      empty: false,
      data: (data.data as Record<string, unknown>) ?? {},
      updatedAt: new Date(data.updated_at as string).getTime(),
      rev: Number(data.rev ?? 0),
    }
  } catch (e) {
    return { ok: false, error: mapSyncError(e instanceof Error ? e.message : String(e)) }
  }
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

// ── Push (CAS + merge por registro) ──
// La exclusión de lo device-local (PIN, consent, cloudSync, UI efímera, cachés) tiene UNA sola fuente
// de verdad: prepareSyncPayload (store.ts). pushRemote recibe el AppState completo y lo pasa por ahí
// en este único punto de salida — ningún caller puede subir un blob sin depurar. (Sustituye al viejo
// stripDeviceOnlyFields, que duplicaba la lista de claves.)

/** Resultado del push: `merged` ≠ null cuando el merge trajo novedades REMOTAS que el caller debe
 *  aplicar al estado local (dispatch { t: 'applyMerged' }) — un push ahora también puede traer datos. */
export type PushResult =
  | { ok: true; merged: SyncPayload | null }
  | { ok: false; error: string }

// nº máx. de ciclos leer→fusionar→escribir ante conflictos CAS antes de rendirse (se reintenta con el siguiente cambio)
const MAX_CAS_ATTEMPTS = 3

// choque de clave primaria: otro dispositivo insertó la primera fila entre nuestra lectura y nuestro insert
function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  return err.code === '23505' || (err.message ?? '').toLowerCase().includes('duplicate key')
}

/** Sube el estado del usuario con CAS por `rev`: lee (data, rev) → fusiona por registro → escribe solo
 *  si nadie más escribió (WHERE rev = leída). Conflicto → re-pull + re-merge + reintento (máx. 3). */
export async function pushRemote(userId: string, state: AppState): Promise<PushResult> {
  if (!backendEnabled) return { ok: false, error: 'La nube no está configurada en esta versión.' }
  const sb = await getSupabase()
  if (!sb) return { ok: false, error: 'La nube no está disponible ahora. Inténtalo de nuevo.' }
  const local = prepareSyncPayload(state)
  try {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
      const read = await sb.from('user_state').select('data, rev').eq('user_id', userId).maybeSingle()
      if (read.error) {
        console.error('[sync] pushRemote(read):', read.error.message)
        markPushFailed()
        return { ok: false, error: mapSyncError(read.error.message) }
      }

      if (!read.data) {
        // Sin fila remota: primer respaldo de la cuenta → INSERT con rev=1. Si otro dispositivo ganó
        // la carrera del primer insert, el PK choca → reintento (la siguiente vuelta lee su fila y fusiona).
        const ins = await sb.from('user_state').insert({
          user_id: userId, data: local, rev: 1, updated_at: new Date().toISOString(),
        })
        if (ins.error) {
          if (isUniqueViolation(ins.error)) continue
          console.error('[sync] pushRemote(insert):', ins.error.message)
          markPushFailed()
          return { ok: false, error: mapSyncError(ins.error.message) }
        }
        setLastSeenRev(1)
        markCloudSyncedNow()
        return { ok: true, merged: null }
      }

      const seenRev = Number(read.data.rev ?? 0)
      // El blob remoto se SANEA antes de fusionar (entradas malformadas fuera) — mergeStates tolera
      // colecciones ausentes pero no valida items corruptos; sanitizeImport es esa validación.
      const remote = sanitizeImport((read.data.data as Partial<AppState>) ?? {}).state as unknown as SyncPayload
      const { merged, changedVsLocal, changedVsRemote } = mergeStates(local, remote, Date.now() - TOMBSTONE_TTL_MS)

      if (changedVsRemote) {
        // CAS: solo escribe si la rev remota sigue siendo la leída; 0 filas = alguien escribió en medio
        const upd = await sb.from('user_state')
          .update({ data: merged, rev: seenRev + 1, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('rev', seenRev)
          .select('rev')
        if (upd.error) {
          console.error('[sync] pushRemote(update):', upd.error.message)
          markPushFailed()
          return { ok: false, error: mapSyncError(upd.error.message) }
        }
        if (!upd.data || upd.data.length === 0) continue // conflicto CAS → re-pull + re-merge
        setLastSeenRev(seenRev + 1)
      } else {
        // la nube ya tiene todo lo nuestro: no se escribe (no se quema una rev sin cambios)
        setLastSeenRev(seenRev)
      }
      markCloudSyncedNow()
      return { ok: true, merged: changedVsLocal ? merged : null }
    }
    // MAX_CAS_ATTEMPTS conflictos seguidos: raro (requiere escrituras concurrentes sostenidas) — se
    // rinde y queda el estado de fallo visible; el siguiente cambio local vuelve a intentar.
    console.error('[sync] pushRemote: conflicto CAS persistente tras', MAX_CAS_ATTEMPTS, 'intentos')
    markPushFailed()
    return { ok: false, error: 'Otro dispositivo está sincronizando en este momento. Inténtalo de nuevo.' }
  } catch (e) {
    console.error('[sync] pushRemote:', e)
    markPushFailed()
    return { ok: false, error: mapSyncError(e instanceof Error ? e.message : String(e)) }
  }
}

// ── Conteo honesto de cambios aplicados (para el toast de "Restaurar de la nube") ──
// Compara el payload LOCAL contra el FUSIONADO a nivel registro (misma granularidad que el merge)
// y cuenta cuántos registros quedaron distintos tras aplicar el merge: altas, ediciones y bajas.
// PURO y sin reloj; syncMeta/tombstones no cuentan (contabilidad interna, no cambios visibles).

// stringify con claves ordenadas → igualdad estructural barata e insensible al orden de claves
function stable(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? '·undefined·'
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']'
  const o = x as Record<string, unknown>
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b)

// nº de claves cuyo valor difiere entre dos mapas (incluye claves presentes en un solo lado)
function diffKeys(a: Record<string, unknown> = {}, b: Record<string, unknown> = {}): number {
  let n = 0
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!same(a[k], b[k])) n++
  return n
}

/** Cuenta los registros que cambiaron localmente al aplicar `merged` sobre `local`. */
export function countMergeChanges(local: SyncPayload, merged: SyncPayload): number {
  let n = 0
  // log: por item (id) — los grupos son derivados, no cuentan por sí mismos
  const items = (p: SyncPayload) => Object.fromEntries((p.log ?? []).flatMap((g) => g.items).map((it) => [it.id, it]))
  n += diffKeys(items(local), items(merged))
  // colecciones con identidad propia
  n += diffKeys(local.protocols ?? {}, merged.protocols ?? {})
  n += diffKeys(local.nutrition ?? {}, merged.nutrition ?? {})
  const recons = (p: SyncPayload) => Object.fromEntries((p.savedRecons ?? []).map((r) => [r.id || r.label, r]))
  n += diffKeys(recons(local), recons(merged))
  const favs = (p: SyncPayload) => Object.fromEntries((p.foodLibrary ?? []).map((f) => [f.id || f.label, f]))
  n += diffKeys(favs(local), favs(merged))
  // history: por muestra (medida|ts)
  const samples = (p: SyncPayload) => {
    const out: Record<string, unknown> = {}
    for (const [name, arr] of Object.entries(p.history ?? {})) for (const sm of arr) out[`${name}|${sm.ts}`] = sm
    return out
  }
  n += diffKeys(samples(local), samples(merged))
  // mapas por clave
  n += diffKeys(local.measureGoals ?? {}, merged.measureGoals ?? {})
  n += diffKeys(local.measureReminders ?? {}, merged.measureReminders ?? {})
  n += diffKeys(local.productAliases ?? {}, merged.productAliases ?? {})
  n += diffKeys(local.productDoses ?? {}, merged.productDoses ?? {})
  n += diffKeys(local.productRecon ?? {}, merged.productRecon ?? {})
  n += diffKeys(local.lastInjectionSite ?? {}, merged.lastInjectionSite ?? {})
  n += diffKeys(local.dayNotes ?? {}, merged.dayNotes ?? {})
  // logros: diferencia simétrica de conjuntos
  const la = new Set(local.achievements ?? []), ma = new Set(merged.achievements ?? [])
  for (const a of new Set([...la, ...ma])) if (la.has(a) !== ma.has(a)) n++
  // unidades LWW: cada bloque que difiere cuenta como UN cambio
  if (!same(local.profile, merged.profile)) n++
  if (!same({ s: local.settings, sc: local.scale }, { s: merged.settings, sc: merged.scale })) n++
  const goalsOf = (p: SyncPayload) => ({
    curGoal: p.curGoal ?? null, secondaryGoals: p.secondaryGoals ?? [], selectedMeasures: p.selectedMeasures ?? [],
    kpiOrder: p.kpiOrder, macroGoals: p.macroGoals ?? null, kcalGoal: p.kcalGoal ?? null,
  })
  if (!same(goalsOf(local), goalsOf(merged))) n++
  if (!same(local.activeProduct ?? null, merged.activeProduct ?? null)) n++
  if (!same(local.fastStartTs ?? null, merged.fastStartTs ?? null)) n++
  if (!same(local.lastMealTs ?? null, merged.lastMealTs ?? null)) n++
  return n
}
