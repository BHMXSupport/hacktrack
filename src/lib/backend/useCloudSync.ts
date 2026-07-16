import { useEffect, useRef } from 'react'
import type { Action, AppState } from '../store'
import { backendEnabled, pushConfigured } from './config'
import { getSession, onAuthChange, type SessionInfo } from './auth'
import { pushRemote } from './sync'
import { subscribePush } from './push'

// Wiring de nube para el provider. NO-OP total sin backend (early return) → el beta local-first no cambia.
// Hace, cuando hay credenciales:
//   (1) rastrea la sesión de Supabase (login/logout),
//   (2) si hay push configurado + recordatorios, suscribe el dispositivo a Web Push,
//   (3) si cloudSync está activo y hay sesión, corre CICLOS de sincronización (debounced): pushRemote
//       lee la fila remota, FUSIONA por registro (lib/merge.ts) y escribe con CAS por rev — y si el
//       merge trajo novedades del otro dispositivo, se aplican aquí con { t: 'applyMerged' },
//   (4) al APARECER la sesión (login o arranque con sesión persistida) corre un ciclo inicial:
//       en un teléfono nuevo, el estado vacío se fusiona con el respaldo completo → restauración natural.
// El "Reemplazar todo con la nube" (destructivo, confirmado) vive fuera: Ajustes → 'loadRemoteState'.
export function useCloudSync(state: AppState, dispatch: (a: Action) => void) {
  const sessionRef = useRef<SessionInfo>(null)
  // Ref al estado VIVO: los ciclos corren tras un debounce/login y deben leer el estado actual,
  // no el del render que los agendó.
  const stateRef = useRef(state)
  stateRef.current = state
  const timer = useRef<number | undefined>(undefined)
  // Mutex de ciclo: dos CAS concurrentes del MISMO dispositivo se pisarían la rev entre sí
  // (convergen igual, pero queman reintentos); con el mutex, el que llega tarde se re-agenda.
  const busyRef = useRef(false)

  // Un ciclo completo pull→merge→push(CAS)→apply-back. Los guards se re-evalúan AQUÍ (no solo al
  // agendar): localOnly es independiente de cloudSync — "modo solo local" activo = nada sube nunca.
  async function syncCycle() {
    const s = sessionRef.current
    const st = stateRef.current
    if (!s || !st.settings.cloudSync || st.localOnly) return
    if (busyRef.current) return
    busyRef.current = true
    try {
      const res = await pushRemote(s.userId, st)
      if (res.ok && res.merged) dispatch({ t: 'applyMerged', merged: res.merged })
    } finally {
      busyRef.current = false
    }
  }
  // Ref a la versión fresca del ciclo — el efecto de montaje (deps []) la usa sin re-suscribirse.
  const cycleRef = useRef(syncCycle)
  cycleRef.current = syncCycle

  // Sesión + suscripción a cambios de auth + alta de push + ciclo inicial al aparecer la sesión.
  useEffect(() => {
    if (!backendEnabled) return
    let unsub = () => {}
    const onSession = (s: SessionInfo) => {
      const had = sessionRef.current != null
      sessionRef.current = s
      // Solo en la transición sin-sesión → sesión (login real o arranque con sesión persistida);
      // los TOKEN_REFRESHED periódicos re-entregan la misma sesión y no deben re-suscribir push
      // ni disparar ciclos (subscribePush es idempotente, pero re-suscribir en cada refresh es ruido).
      if (s && !had) {
        if (pushConfigured) void subscribePush(s.userId)
        void cycleRef.current()
      }
    }
    void getSession().then(onSession)
    void onAuthChange(onSession).then((u) => { unsub = u })
    return () => unsub()
  }, [])

  // Ciclo de sync por CAMBIO DE ESTADO, debounced. localOnly es un guard INDEPENDIENTE de cloudSync:
  // aunque un estado viejo/restaurado traiga cloudSync=true, "modo solo local" activo significa que
  // nada sube — el switch no puede mentir. (syncCycle re-verifica ambos al disparar.)
  useEffect(() => {
    if (!backendEnabled || !state.settings.cloudSync || state.localOnly) return
    if (!sessionRef.current) return
    window.clearTimeout(timer.current)
    const arm = (delay: number) => {
      timer.current = window.setTimeout(() => {
        if (busyRef.current) { arm(1000); return } // hay un ciclo en vuelo → espera y reintenta
        void cycleRef.current()
      }, delay)
    }
    arm(2500)
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}
