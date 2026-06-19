import { useReducer, type ReactNode } from 'react'
import { AppContext, reducer, initialState, hydrate } from '../../lib/store'
import type { AppState } from '../../lib/store'
import { startOfDay } from '../../lib/cadence'

// Provider del rebuild: reusa el reducer/estado del app original (lib/store).
// Persistencia simple sobre la misma clave; migrations finas se portan luego.
const KEY = 'hacktrack:v2'
const LEGACY = 'hacktrack:v1'

function loadState(): AppState {
  const fresh = { ...initialState, todayTs: startOfDay(new Date()).getTime() } as AppState
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as Partial<AppState>
    const merged = {
      ...fresh,
      ...saved,
      sheet: null,
      toast: null,
      toastUndoId: null,
      todayTs: fresh.todayTs,
    } as AppState
    const TABS = ['inicio', 'diario', 'protocolo', 'vida', 'comida', 'semana']
    if (!TABS.includes((merged as AppState).tab)) (merged as AppState).tab = 'inicio'
    return hydrate(merged)
  } catch {
    return fresh
  }
}

export function AppProviderV2({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}
