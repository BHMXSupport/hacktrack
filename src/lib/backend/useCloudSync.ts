import { useEffect, useRef } from 'react'
import type { AppState } from '../store'
import { backendEnabled, pushConfigured } from './config'
import { getSession, onAuthChange, type SessionInfo } from './auth'
import { pushRemote } from './sync'
import { subscribePush } from './push'

// Wiring de nube para el provider. NO-OP total sin backend (early return) → el beta local-first no cambia.
// Hace, cuando hay credenciales:
//   (1) rastrea la sesión de Supabase (login/logout),
//   (2) si hay push configurado + recordatorios, suscribe el dispositivo a Web Push,
//   (3) si cloudSync está activo y hay sesión, SUBE (debounced) el blob de estado como respaldo.
// El PULL/restore/merge (traer la nube y fusionar con lo local) se finaliza/prueba CON keys — ver
// SETUP-BACKEND.md §Sync. Aquí dejamos el respaldo (push), que no toca el estado local (seguro de soltar).
export function useCloudSync(state: AppState) {
  const sessionRef = useRef<SessionInfo>(null)
  const timer = useRef<number | undefined>(undefined)

  // Sesión + suscripción a cambios de auth + alta de push.
  useEffect(() => {
    if (!backendEnabled) return
    let unsub = () => {}
    const onSession = (s: SessionInfo) => {
      sessionRef.current = s
      if (s && pushConfigured) void subscribePush(s.userId)
    }
    void getSession().then(onSession)
    void onAuthChange(onSession).then((u) => { unsub = u })
    return () => unsub()
  }, [])

  // Respaldo (push) del estado, debounced, cuando cloudSync está activo y hay sesión.
  useEffect(() => {
    if (!backendEnabled || !state.settings.cloudSync) return
    const s = sessionRef.current
    if (!s) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const { sheet, sheetArg, toast, toastUndoId, deletedLogBuffer, ...persist } = state
      void sheet; void sheetArg; void toast; void toastUndoId; void deletedLogBuffer
      void pushRemote(s.userId, persist as unknown as Record<string, unknown>)
    }, 2500)
    return () => window.clearTimeout(timer.current)
  }, [state])
}
