// Golden: protocolo de sincronización CAS (backend/sync.ts) con cliente Supabase MOCKEADO.
// Verifica el contrato del push v2 (Opción C): primer respaldo = INSERT rev=1; con fila remota =
// merge por registro + UPDATE guardado por rev (rev = vista+1); 0 filas afectadas = conflicto CAS →
// re-pull + re-merge + reintento (máx. 3, luego fallo honesto); un push puede TRAER novedades remotas
// (merged ≠ null); la exclusión de lo device-local pasa por prepareSyncPayload (única fuente).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initialState, isoKey, prepareSyncPayload,
  CACHE_KEYS, NEVER_SYNCED_KEYS,
  type AppState, type SyncPayload,
} from '../store'
import type { LogGroup, LogItem } from '../types'
import { mkDoseItem, mkState, ts } from './helpers'

// hoisted: el factory de vi.mock corre antes que el cuerpo del test — el cliente se inyecta por ref
const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('../backend/config', () => ({
  backendEnabled: true,
  pushConfigured: false,
  SUPABASE_URL: 'http://mock.local',
  SUPABASE_ANON_KEY: 'mock-key',
  VAPID_PUBLIC_KEY: undefined,
}))
vi.mock('../backend/supabase', () => ({ getSupabase: async () => h.client }))

import { countMergeChanges, getLastSeenRev, getSyncStatus, markCloudSyncedNow, pullRemote, pushRemote } from '../backend/sync'

const UID = 'user-123'
const P = 'Ipamorelin'

// ── window mínimo (vitest corre en node): localStorage + eventos para el estado de sync ──────
const store = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
})

// ── cliente Supabase de guion: respuestas en orden, capturando cada llamada ──────────────────
type Err = { message: string; code?: string } | null
type ReadResp = { data: { data: unknown; rev: number; updated_at?: string } | null; error: Err }
type WriteResp = { data: Array<{ rev: number }> | null; error: Err }

function makeClient(script: {
  reads: ReadResp[]
  inserts?: Array<{ error: Err }>
  updates?: WriteResp[]
}) {
  const calls = {
    reads: 0,
    inserts: [] as Array<Record<string, unknown>>,
    updates: [] as Array<{ row: Record<string, unknown>; filters: Array<[string, unknown]> }>,
  }
  const client = {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_k: string, _v: unknown) => ({
          maybeSingle: async () => script.reads[Math.min(calls.reads++, script.reads.length - 1)],
        }),
      }),
      insert: async (row: Record<string, unknown>) => {
        calls.inserts.push(row)
        return (script.inserts ?? [{ error: null }])[Math.min(calls.inserts.length - 1, (script.inserts ?? [{ error: null }]).length - 1)]
      },
      update: (row: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = []
        const b = {
          eq(k: string, v: unknown) { filters.push([k, v]); return b },
          select: async (_c: string) => {
            calls.updates.push({ row, filters })
            return (script.updates ?? [])[Math.min(calls.updates.length - 1, (script.updates ?? [{ data: [], error: null }]).length - 1)]
          },
        }
        return b
      },
    }),
  }
  return { client, calls }
}

// ── fixtures deterministas ────────────────────────────────────────────────────────────────────
const T = (d: number, hh = 9) => ts(2026, 6, d, hh)

const item = (id: string, when: number): LogItem => mkDoseItem(P, `${P} · 1 mg`, when, { id, m: when })

function logOf(...items: LogItem[]): LogGroup[] {
  const map = new Map<string, LogItem[]>()
  for (const it of items) map.set(isoKey(it.ts), [...(map.get(isoKey(it.ts)) ?? []), it])
  return [...map.entries()]
    .map(([dateKey, its]) => ({ dateKey, items: its.sort((a, b) => b.ts - a.ts || (a.id < b.id ? 1 : -1)) }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
}

const flatIds = (p: SyncPayload) => (p.log ?? []).flatMap((g) => g.items).map((it) => it.id).sort()

function localState(): AppState {
  return mkState({
    log: logOf(item('localItem', T(5))),
    settings: { ...initialState.settings, pinEnabled: true, pinHash: 'HASH', consentActive: true, cloudSync: true },
  })
}

function remotePayload(): SyncPayload {
  return prepareSyncPayload(mkState({ log: logOf(item('remoteItem', T(6))) }))
}

beforeEach(() => {
  store.clear()
  markCloudSyncedNow() // resetea lastPushFailed del módulo entre tests
  store.clear()
})

// ── push: primer respaldo (sin fila remota) ───────────────────────────────────────────────────
describe('pushRemote — INSERT inicial', () => {
  it('sin fila remota inserta rev=1 con el payload depurado por prepareSyncPayload', async () => {
    const { client, calls } = makeClient({ reads: [{ data: null, error: null }], inserts: [{ error: null }] })
    h.client = client
    const res = await pushRemote(UID, localState())
    expect(res).toEqual({ ok: true, merged: null })
    expect(calls.inserts).toHaveLength(1)
    const row = calls.inserts[0]
    expect(row.user_id).toBe(UID)
    expect(row.rev).toBe(1)
    // choke point único: nada nunca-sincronizado ni cachés en el blob subido
    const keys = Object.keys(row.data as Record<string, unknown>)
    for (const k of [...NEVER_SYNCED_KEYS, ...CACHE_KEYS]) expect(keys).not.toContain(k)
    const st = (row.data as { settings: Record<string, unknown> }).settings
    for (const k of ['pinEnabled', 'pinHash', 'consentVersion', 'consentActive', 'cloudSync']) {
      expect(st).not.toHaveProperty(k)
    }
    expect(getLastSeenRev()).toBe(1)
    expect(getSyncStatus().lastPushFailed).toBe(false)
  })

  it('si otro dispositivo gana la carrera del INSERT (PK duplicada), re-lee su fila y fusiona', async () => {
    const { client, calls } = makeClient({
      reads: [
        { data: null, error: null },
        { data: { data: remotePayload(), rev: 1 }, error: null },
      ],
      inserts: [{ error: { message: 'duplicate key value violates unique constraint "user_state_pkey"', code: '23505' } }],
      updates: [{ data: [{ rev: 2 }], error: null }],
    })
    h.client = client
    const res = await pushRemote(UID, localState())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // el merge trajo la novedad del otro dispositivo → el caller debe aplicarla localmente
    expect(res.merged).not.toBeNull()
    expect(flatIds(res.merged!)).toEqual(['localItem', 'remoteItem'])
    expect(calls.updates[0].filters).toContainEqual(['rev', 1])
    expect(calls.updates[0].row.rev).toBe(2)
  })
})

// ── push: merge + UPDATE guardado por rev ─────────────────────────────────────────────────────
describe('pushRemote — CAS con fila remota', () => {
  it('fusiona por registro y escribe con guard WHERE rev = vista, rev nueva = vista+1', async () => {
    const { client, calls } = makeClient({
      reads: [{ data: { data: remotePayload(), rev: 3 }, error: null }],
      updates: [{ data: [{ rev: 4 }], error: null }],
    })
    h.client = client
    const res = await pushRemote(UID, localState())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.merged).not.toBeNull() // el remoto traía 'remoteItem' → hay que aplicarlo localmente
    expect(flatIds(res.merged!)).toEqual(['localItem', 'remoteItem'])
    expect(calls.updates).toHaveLength(1)
    const { row, filters } = calls.updates[0]
    expect(filters).toContainEqual(['user_id', UID])
    expect(filters).toContainEqual(['rev', 3])
    expect(row.rev).toBe(4)
    // lo subido es el FUSIONADO (ambos items), no el local a secas
    expect(flatIds(row.data as SyncPayload)).toEqual(['localItem', 'remoteItem'])
    expect(getLastSeenRev()).toBe(4)
  })

  it('sin nada que subir (remoto ya al día) NO escribe: no quema una rev sin cambios', async () => {
    const st = localState()
    const { client, calls } = makeClient({
      reads: [{ data: { data: prepareSyncPayload(st), rev: 7 }, error: null }],
      updates: [],
    })
    h.client = client
    const res = await pushRemote(UID, st)
    expect(res).toEqual({ ok: true, merged: null })
    expect(calls.updates).toHaveLength(0)
    expect(getLastSeenRev()).toBe(7)
  })

  it('conflicto CAS (0 filas afectadas) → re-pull, re-merge y reintento que SÍ aterriza', async () => {
    const remoteV2 = prepareSyncPayload(mkState({ log: logOf(item('remoteItem', T(6)), item('remoteItem2', T(7))) }))
    const { client, calls } = makeClient({
      reads: [
        { data: { data: remotePayload(), rev: 3 }, error: null },
        { data: { data: remoteV2, rev: 4 }, error: null }, // otro dispositivo escribió en medio
      ],
      updates: [
        { data: [], error: null },          // CAS perdido
        { data: [{ rev: 5 }], error: null }, // reintento con la rev fresca
      ],
    })
    h.client = client
    const res = await pushRemote(UID, localState())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(calls.reads).toBe(2)
    expect(calls.updates).toHaveLength(2)
    expect(calls.updates[1].filters).toContainEqual(['rev', 4])
    expect(calls.updates[1].row.rev).toBe(5)
    // el re-merge incorporó la novedad del segundo pull
    expect(flatIds(res.merged!)).toEqual(['localItem', 'remoteItem', 'remoteItem2'])
    expect(getLastSeenRev()).toBe(5)
    expect(getSyncStatus().lastPushFailed).toBe(false)
  })

  it('3 conflictos CAS seguidos → fallo honesto es-MX y lastPushFailed', async () => {
    const { client, calls } = makeClient({
      reads: [
        { data: { data: remotePayload(), rev: 3 }, error: null },
        { data: { data: remotePayload(), rev: 4 }, error: null },
        { data: { data: remotePayload(), rev: 5 }, error: null },
      ],
      updates: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
    })
    h.client = client
    const res = await pushRemote(UID, localState())
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('Otro dispositivo está sincronizando en este momento. Inténtalo de nuevo.')
    expect(calls.updates).toHaveLength(3)
    expect(getSyncStatus().lastPushFailed).toBe(true)
  })

  it('error de lectura → fallo mapeado a es-MX (sin jerga de Postgres) y lastPushFailed', async () => {
    const { client } = makeClient({ reads: [{ data: null, error: { message: 'TypeError: fetch failed' } }] })
    h.client = client
    const res = await pushRemote(UID, localState())
    expect(res).toEqual({ ok: false, error: 'Sin conexión. Revisa tu internet e inténtalo otra vez.' })
    expect(getSyncStatus().lastPushFailed).toBe(true)
  })

  it('el blob remoto se SANEA antes de fusionar: un item corrupto no llega al merge ni resucita', async () => {
    const corrupt = remotePayload()
    // item sin ts numérico ni type válido — sanitizeImport debe descartarlo antes del merge
    corrupt.log = [{ dateKey: '2026-06-06', items: [{ id: 'bad', type: '???', ts: 'nope' } as unknown as LogItem] }]
    const { client } = makeClient({
      reads: [{ data: { data: corrupt, rev: 2 }, error: null }],
      updates: [{ data: [{ rev: 3 }], error: null }],
    })
    h.client = client
    const res = await pushRemote(UID, localState())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // merged existe (el remoto difería), pero el item corrupto NO está
    const ids = res.merged ? flatIds(res.merged) : flatIds(prepareSyncPayload(localState()))
    expect(ids).not.toContain('bad')
  })
})

// ── pull: rev expuesta para el caller ────────────────────────────────────────────────────────
describe('pullRemote', () => {
  it('devuelve data + rev (+updatedAt) cuando hay fila', async () => {
    const { client } = makeClient({
      reads: [{ data: { data: { x: 1 }, rev: 7, updated_at: '2026-07-16T10:00:00Z' }, error: null }],
    })
    h.client = client
    const res = await pullRemote(UID)
    expect(res).toEqual({
      ok: true, empty: false, data: { x: 1 },
      updatedAt: new Date('2026-07-16T10:00:00Z').getTime(), rev: 7,
    })
  })

  it('sin fila → empty (nunca un error disfrazado de "no tienes respaldo")', async () => {
    const { client } = makeClient({ reads: [{ data: null, error: null }] })
    h.client = client
    expect(await pullRemote(UID)).toEqual({ ok: true, empty: true })
  })
})

// ── conteo honesto de cambios (toast de "Restaurar de la nube") ───────────────────────────────
describe('countMergeChanges', () => {
  it('cuenta registros distintos entre local y fusionado; 0 cuando son iguales', async () => {
    const { mergeStates } = await import('../merge')
    const local = prepareSyncPayload(localState())
    const remote = prepareSyncPayload(mkState({
      log: logOf(item('remoteItem', T(6))),
      achievements: ['primer-registro'],
      dayNotes: { '2026-06-06': 'nota remota' },
    }))
    const { merged } = mergeStates(local, remote)
    // +1 item de log, +1 logro, +1 nota de día = 3 cambios aplicados localmente
    expect(countMergeChanges(local, merged)).toBe(3)
    expect(countMergeChanges(local, local)).toBe(0)
    expect(countMergeChanges(merged, merged)).toBe(0)
  })
})
