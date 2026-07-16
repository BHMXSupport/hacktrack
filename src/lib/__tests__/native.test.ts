// Tests de la capa nativa (Capacitor) — SOLO lógica pura + adaptadores con plugins mockeados.
// Corren en environment 'node' (sin window/localStorage): los módulos deben degradar a
// memoria / no-op sin tronar, que es exactamente lo que se verifica aquí.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks hoisted (vi.mock se iza por encima de los imports) ───────────────────
const platformMock = vi.hoisted(() => ({ native: false, platform: 'web' }))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platformMock.native,
    getPlatform: () => platformMock.platform,
  },
}))

const notifMock = vi.hoisted(() => ({
  scheduled: [] as Array<{ notifications: Array<{ id: number; title: string; body: string; extra?: { tag?: string } }> }>,
  cancelled: [] as Array<{ notifications: Array<{ id: number }> }>,
  permission: 'granted' as string,
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: notifMock.permission }),
    requestPermissions: async () => ({ display: notifMock.permission }),
    cancel: async (o: { notifications: Array<{ id: number }> }) => {
      notifMock.cancelled.push(o)
    },
    schedule: async (o: (typeof notifMock.scheduled)[number]) => {
      notifMock.scheduled.push(o)
    },
    addListener: async () => ({ remove: async () => undefined }),
  },
}))

const secureMock = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  fail: false,
}))

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    get: async (k: string) => {
      if (secureMock.fail) throw new Error('keychain bloqueado')
      return secureMock.store.has(k) ? secureMock.store.get(k) : null
    },
    set: async (k: string, v: unknown) => {
      if (secureMock.fail) throw new Error('keychain bloqueado')
      secureMock.store.set(k, v)
    },
    remove: async (k: string) => {
      if (secureMock.fail) throw new Error('keychain bloqueado')
      secureMock.store.delete(k)
    },
  },
}))

import {
  tagToId,
  scheduleNativeNotif,
  cancelNativeNotif,
  setNativeNotifTapHandler,
  deliverNativeTap,
} from '../native/notifications'
import { createAuthStorage } from '../native/secureStorage'
import { shouldRestore, mirrorNeedsWrite } from '../native/stateMirror'
import { decideBackAction } from '../native/backButton'

beforeEach(() => {
  platformMock.native = false
  platformMock.platform = 'web'
  notifMock.scheduled.length = 0
  notifMock.cancelled.length = 0
  notifMock.permission = 'granted'
  secureMock.store.clear()
  secureMock.fail = false
  setNativeNotifTapHandler(null)
})

// ── tagToId: ids estables para Android (int32 > 0) ─────────────────────────────
describe('tagToId', () => {
  it('es determinista: mismo tag → mismo id', () => {
    expect(tagToId('hacktrack-dose-BPC 157')).toBe(tagToId('hacktrack-dose-BPC 157'))
  })

  it('tags distintos → ids distintos (muestra representativa)', () => {
    const tags = [
      'hacktrack-dose-Retatrutide',
      'hacktrack-pre-Retatrutide',
      'hacktrack-rescue-Retatrutide',
      'hacktrack-measure-Peso',
      'hacktrack-daily-summary',
      'hacktrack-weekly-summary',
      '',
    ]
    const ids = new Set(tags.map(tagToId))
    expect(ids.size).toBe(tags.length)
  })

  it('siempre dentro de 1..2^31-1 (id válido de Android)', () => {
    for (const tag of ['', 'a', 'hacktrack-dose-Semaglutida', 'ñandú-ü-漢字', 'x'.repeat(500)]) {
      const id = tagToId(tag)
      expect(Number.isInteger(id)).toBe(true)
      expect(id).toBeGreaterThanOrEqual(1)
      expect(id).toBeLessThanOrEqual(2 ** 31 - 1)
    }
  })
})

// ── scheduleNativeNotif / cancelNativeNotif ────────────────────────────────────
describe('scheduleNativeNotif', () => {
  it('en web (no nativo) devuelve false sin programar nada', async () => {
    platformMock.native = false
    const ok = await scheduleNativeNotif('t', 'b', 1000, 'hacktrack-dose-X')
    expect(ok).toBe(false)
    expect(notifMock.scheduled).toHaveLength(0)
  })

  it('en nativo con permiso programa con id estable y extra.tag', async () => {
    platformMock.native = true
    const tag = 'hacktrack-dose-Retatrutide'
    const ok = await scheduleNativeNotif('Hora de tu registro', 'Márcalo', 60_000, tag)
    expect(ok).toBe(true)
    expect(notifMock.scheduled).toHaveLength(1)
    const n = notifMock.scheduled[0].notifications[0]
    expect(n.id).toBe(tagToId(tag))
    expect(n.extra?.tag).toBe(tag)
    // re-programar el mismo tag cancela la pendiente anterior (semántica del tag web)
    expect(notifMock.cancelled[0].notifications[0].id).toBe(tagToId(tag))
  })

  it('sin permiso devuelve false', async () => {
    platformMock.native = true
    notifMock.permission = 'denied'
    expect(await scheduleNativeNotif('t', 'b', 1000, 'x')).toBe(false)
    expect(notifMock.scheduled).toHaveLength(0)
  })

  it('delay inválido (<=0 / NaN) devuelve false', async () => {
    platformMock.native = true
    expect(await scheduleNativeNotif('t', 'b', 0, 'x')).toBe(false)
    expect(await scheduleNativeNotif('t', 'b', -5, 'x')).toBe(false)
    expect(await scheduleNativeNotif('t', 'b', Number.NaN, 'x')).toBe(false)
    expect(notifMock.scheduled).toHaveLength(0)
  })

  it('cancelNativeNotif cancela por id derivado del tag', async () => {
    platformMock.native = true
    await cancelNativeNotif('hacktrack-rescue-BPC 157')
    expect(notifMock.cancelled[0].notifications[0].id).toBe(tagToId('hacktrack-rescue-BPC 157'))
  })
})

// ── Buffer de taps (arranque en frío desde una notificación) ───────────────────
describe('taps nativos', () => {
  it('bufferea taps sin handler y los re-emite al registrarlo', () => {
    const seen: string[] = []
    deliverNativeTap('hacktrack-dose-A')
    deliverNativeTap('hacktrack-measure-Peso')
    setNativeNotifTapHandler((tag) => seen.push(tag))
    expect(seen).toEqual(['hacktrack-dose-A', 'hacktrack-measure-Peso'])
    deliverNativeTap('hacktrack-dose-B')
    expect(seen).toEqual(['hacktrack-dose-A', 'hacktrack-measure-Peso', 'hacktrack-dose-B'])
  })
})

// ── Adaptador de auth-storage (Supabase) ───────────────────────────────────────
describe('createAuthStorage', () => {
  it('web sin localStorage (node) → memoria: roundtrip set/get/remove', async () => {
    const s = createAuthStorage(false)
    expect(await s.getItem('k')).toBeNull()
    await s.setItem('k', 'v1')
    expect(await s.getItem('k')).toBe('v1')
    await s.removeItem('k')
    expect(await s.getItem('k')).toBeNull()
  })

  it('nativo → Keychain/Keystore (plugin mockeado)', async () => {
    const s = createAuthStorage(true)
    await s.setItem('sb-session', '{"access_token":"x"}')
    expect(secureMock.store.get('sb-session')).toBe('{"access_token":"x"}')
    expect(await s.getItem('sb-session')).toBe('{"access_token":"x"}')
    await s.removeItem('sb-session')
    expect(secureMock.store.has('sb-session')).toBe(false)
  })

  it('nativo: valores no-string del plugin se serializan a JSON', async () => {
    secureMock.store.set('raw', { a: 1 })
    const s = createAuthStorage(true)
    expect(await s.getItem('raw')).toBe('{"a":1}')
  })

  it('nativo con Keychain fallando → degrada a fallback sin perder la sesión', async () => {
    secureMock.fail = true
    const s = createAuthStorage(true)
    await s.setItem('k', 'v')
    expect(await s.getItem('k')).toBe('v') // roundtrip vía fallback
    expect(secureMock.store.has('k')).toBe(false) // nunca llegó al plugin
  })
})

// ── Espejo de estado: guardas puras ────────────────────────────────────────────
describe('stateMirror.shouldRestore', () => {
  const validBlob = '{"log":[],"settings":{}}'

  it('restaura solo con localStorage vacío y espejo JSON-objeto válido', () => {
    expect(shouldRestore(null, validBlob)).toBe(true)
    expect(shouldRestore('', validBlob)).toBe(true)
  })

  it('NUNCA pisa un localStorage con datos', () => {
    expect(shouldRestore('{"log":[1]}', validBlob)).toBe(false)
  })

  it('sin espejo, espejo vacío o espejo corrupto → no restaura', () => {
    expect(shouldRestore(null, null)).toBe(false)
    expect(shouldRestore(null, '')).toBe(false)
    expect(shouldRestore(null, 'no-es-json{')).toBe(false)
    expect(shouldRestore(null, '"solo-un-string"')).toBe(false)
    expect(shouldRestore(null, '123')).toBe(false)
  })
})

describe('stateMirror.mirrorNeedsWrite', () => {
  it('escribe solo cuando el blob existe y cambió', () => {
    expect(mirrorNeedsWrite(null, null)).toBe(false)
    expect(mirrorNeedsWrite('', 'x')).toBe(false)
    expect(mirrorNeedsWrite('a', 'a')).toBe(false)
    expect(mirrorNeedsWrite('a', 'b')).toBe(true)
    expect(mirrorNeedsWrite('a', null)).toBe(true)
  })
})

// ── Botón back de Android ──────────────────────────────────────────────────────
describe('decideBackAction', () => {
  it('con modales abiertos cierra el tope; sin modales minimiza', () => {
    expect(decideBackAction(0)).toBe('minimize')
    expect(decideBackAction(1)).toBe('close-modal')
    expect(decideBackAction(3)).toBe('close-modal')
  })
})
