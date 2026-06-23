// ── Configuración del backend (env-gated) ──────────────────────────────────────
// TODA la nube (auth, sync, push, pagos) es OPT-IN vía variables VITE_*. Si no están definidas,
// `backendEnabled` es false y la app queda 100% local: auth/login/forgot conservan su comportamiento
// mock actual, no se crea cliente Supabase, no se sincroniza nada. INVARIANTE: sin estas variables, la
// app se comporta EXACTAMENTE como el beta de hoy. No romper esto.
//
// Para activar el backend, copia .env.example → .env y llena las variables (ver SETUP-BACKEND.md).

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || undefined
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || undefined
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || undefined

/** ¿Hay credenciales de Supabase? → auth + sync disponibles. */
export const backendEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** ¿Además hay clave VAPID pública? → push web disponible (requiere también el Edge Function emisor). */
export const pushConfigured = Boolean(backendEnabled && VAPID_PUBLIC_KEY)
