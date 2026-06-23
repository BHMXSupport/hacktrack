// Auth real env-gated. Sin backend (backendEnabled=false) cada función devuelve { ok:true, mock:true } y la
// UI conserva su flujo mock actual (el beta sigue igual). Con backend, usa Supabase Auth y mapea errores a es-MX.
import { backendEnabled } from './config'
import { getSupabase } from './supabase'

export type AuthOutcome =
  | { ok: true; mock?: boolean }
  | { ok: false; error: string }

export type SessionInfo = { userId: string; email: string | null } | null

function mapAuthError(msg: string): string {
  const m = (msg || '').toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.'
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión (revisa tu bandeja).'
  if (m.includes('password') && m.includes('6')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revisa tu internet e inténtalo otra vez.'
  return 'No se pudo completar. Inténtalo de nuevo.'
}

export async function signUp(email: string, password: string): Promise<AuthOutcome> {
  if (!backendEnabled) return { ok: true, mock: true }
  const sb = await getSupabase()
  if (!sb) return { ok: true, mock: true }
  const { error } = await sb.auth.signUp({ email: email.trim(), password })
  return error ? { ok: false, error: mapAuthError(error.message) } : { ok: true }
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  if (!backendEnabled) return { ok: true, mock: true }
  const sb = await getSupabase()
  if (!sb) return { ok: true, mock: true }
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
  return error ? { ok: false, error: mapAuthError(error.message) } : { ok: true }
}

export async function resetPassword(email: string): Promise<AuthOutcome> {
  if (!backendEnabled) return { ok: true, mock: true }
  const sb = await getSupabase()
  if (!sb) return { ok: true, mock: true }
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL}` : undefined
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  return error ? { ok: false, error: mapAuthError(error.message) } : { ok: true }
}

export async function signOut(): Promise<void> {
  if (!backendEnabled) return
  const sb = await getSupabase()
  await sb?.auth.signOut()
}

export async function getSession(): Promise<SessionInfo> {
  if (!backendEnabled) return null
  const sb = await getSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  const u = data.session?.user
  return u ? { userId: u.id, email: u.email ?? null } : null
}

/** Suscríbete a cambios de sesión (login/logout/refresh). Devuelve un unsubscribe. No-op sin backend. */
export async function onAuthChange(cb: (s: SessionInfo) => void): Promise<() => void> {
  if (!backendEnabled) return () => {}
  const sb = await getSupabase()
  if (!sb) return () => {}
  const { data } = sb.auth.onAuthStateChange((_evt, session) => {
    const u = session?.user
    cb(u ? { userId: u.id, email: u.email ?? null } : null)
  })
  return () => data.subscription.unsubscribe()
}
