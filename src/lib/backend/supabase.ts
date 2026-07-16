// Cliente Supabase con IMPORT DINÁMICO: el SDK (~120KB) solo se carga si hay credenciales (backendEnabled).
// Así el bundle del beta local-first no crece y la app sin keys nunca toca la red. Singleton perezoso.
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, backendEnabled } from './config'
// Nativo (Capacitor): la sesión de auth va a Keychain/Keystore, no al localStorage del
// WebView (evicción + XSS). En web el adaptador ES localStorage — comportamiento idéntico.
import { createAuthStorage } from '../native/secureStorage'

let _client: SupabaseClient | null | undefined // undefined = no inicializado; null = backend off

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!backendEnabled) return null
  if (_client !== undefined) return _client
  try {
    const { createClient } = await import('@supabase/supabase-js')
    _client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: createAuthStorage(),
      },
    })
  } catch (e) {
    console.error('[backend] no se pudo inicializar Supabase:', e)
    _client = null
  }
  return _client
}
