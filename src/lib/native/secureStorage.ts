// Hacktrack — storage de sesión Supabase con Keychain (iOS) / Keystore (Android).
// En nativo, la sesión de auth NO debe vivir en localStorage del WebView (WKWebView puede
// purgarlo y cualquier XSS lo leería): se guarda en @aparajita/capacitor-secure-storage.
// En web/PWA se conserva el comportamiento actual (localStorage). En entornos sin
// localStorage (tests node / SSR) cae a memoria — nunca truena.
//
// Punto de cableado: src/lib/backend/supabase.ts pasa createAuthStorage() como
// auth.storage de createClient. La interfaz coincide con SupportedStorage de supabase-js
// (getItem/setItem/removeItem, sync o async).
import { isNativePlatform } from './platform'

export type AuthStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

// ── Fallback en memoria (node/SSR, o localStorage bloqueado) ───────────────────
export function memoryStorage(): AuthStorage {
  const m = new Map<string, string>()
  return {
    getItem: async (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: async (k, v) => {
      m.set(k, v)
    },
    removeItem: async (k) => {
      m.delete(k)
    },
  }
}

// ── Camino web: localStorage (comportamiento idéntico al actual de supabase-js) ─
export function webStorage(): AuthStorage {
  if (typeof localStorage === 'undefined') return memoryStorage()
  return {
    getItem: async (k) => localStorage.getItem(k),
    setItem: async (k, v) => {
      localStorage.setItem(k, v)
    },
    removeItem: async (k) => {
      localStorage.removeItem(k)
    },
  }
}

// ── Camino nativo: Keychain/Keystore con degradación por-llamada a web ─────────
// Si el plugin falla (p.ej. Keychain bloqueado), degradar a localStorage mantiene la
// sesión funcionando en vez de desloguear al usuario en cada arranque.
function nativeStorage(): AuthStorage {
  const fallback = webStorage()
  return {
    getItem: async (k) => {
      try {
        const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
        const v = await SecureStorage.get(k)
        if (v == null) return null
        return typeof v === 'string' ? v : JSON.stringify(v)
      } catch {
        return fallback.getItem(k)
      }
    },
    setItem: async (k, v) => {
      try {
        const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
        await SecureStorage.set(k, v)
      } catch {
        await fallback.setItem(k, v)
      }
    },
    removeItem: async (k) => {
      try {
        const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
        await SecureStorage.remove(k)
      } catch {
        await fallback.removeItem(k)
      }
    },
  }
}

/**
 * Fábrica del adaptador de auth-storage. El parámetro `isNative` existe para los tests
 * (inyección); en producción se resuelve solo con Capacitor.
 */
export function createAuthStorage(isNative: boolean = isNativePlatform()): AuthStorage {
  return isNative ? nativeStorage() : webStorage()
}
