import { useReducer, useEffect, type ReactNode } from 'react'
import { AppContext, reducer, initialState, hydrate } from '../../lib/store'
import type { AppState } from '../../lib/store'
import { startOfDay } from '../../lib/cadence'
import { upcomingDoses, doseTakenOnProduct } from '../../lib/calendar'
import { registerSW, scheduleSwReminder, scheduleMeasureReminder, notifPermission } from '../../lib/notifications'

// Provider del rebuild: reusa el reducer/estado del app original (lib/store).
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
      sheetArg: null,
      toast: null,
      toastUndoId: null,
      deletedLogBuffer: null,
      todayTs: fresh.todayTs,
    } as AppState
    const TABS = ['inicio', 'diario', 'protocolo', 'vida', 'comida', 'semana']
    if (!TABS.includes((merged as AppState).tab)) (merged as AppState).tab = 'inicio'
    return hydrate(merged)
  } catch {
    return fresh
  }
}

// R3 — aplica el tema al DOM (cockpit oscuro por default; light/auto opcionales).
function applyTheme(mode: string | undefined) {
  let theme: 'dark' | 'light'
  if (mode === 'light') theme = 'light'
  else if (mode === 'auto') {
    const h = new Date().getHours()
    theme = h >= 19 || h < 7 ? 'dark' : 'light'
  } else theme = 'dark'
  document.documentElement.setAttribute('data-theme', theme)
}

export function AppProviderV2({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  // R1 — persistencia en localStorage (excluye estado efímero)
  useEffect(() => {
    try {
      const { sheet, sheetArg, toast, toastUndoId, deletedLogBuffer, ...persist } = state
      void sheet; void sheetArg; void toast; void toastUndoId; void deletedLogBuffer
      localStorage.setItem(KEY, JSON.stringify(persist))
    } catch {
      /* cuota llena / modo privado */
    }
  }, [state])

  // #12 — alto contraste (sube el contraste del texto tenue sin cambiar tamaños)
  useEffect(() => {
    if (state.settings.highContrast) document.documentElement.setAttribute('data-contrast', 'high')
    else document.documentElement.removeAttribute('data-contrast')
  }, [state.settings.highContrast])

  // R3 — tema reactivo a settings.themeMode (+ re-evaluación en modo auto)
  useEffect(() => {
    applyTheme(state.settings.themeMode)
    if (state.settings.themeMode !== 'auto') return
    const onFocus = () => applyTheme('auto')
    const i = window.setInterval(() => applyTheme('auto'), 60_000)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(i)
      window.removeEventListener('focus', onFocus)
    }
  }, [state.settings.themeMode])

  // R4 — tick: refresca "hoy" en sesiones largas / al recuperar foco
  useEffect(() => {
    const i = window.setInterval(() => dispatch({ t: 'tick' }), 60_000)
    const onFocus = () => dispatch({ t: 'tick' })
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(i)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // #3 — registrar el Service Worker para entregar recordatorios con la pantalla apagada (Android/Edge).
  // Sin esto, todos los recordatorios eran decorativos (el rebuild nunca registraba el SW ni programaba avisos).
  useEffect(() => {
    void registerSW()
  }, [])

  // #3 — recordatorio de la próxima toma pendiente (entre TODOS los productos activos), vía SW.
  useEffect(() => {
    if (!state.settings.remindersEnabled || notifPermission() !== 'granted') return
    const now = new Date()
    const next = upcomingDoses(state, now, 16).find((u) => !doseTakenOnProduct(state, u.date, u.product))
    if (!next) return
    const delay = next.date.getTime() - now.getTime()
    if (delay <= 0 || delay > 24 * 86_400_000) return
    void scheduleSwReminder(next.product, delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.remindersEnabled, state.protocols, state.log, state.todayTs])

  // #3 — recordatorios de medidas periódicas configuradas.
  useEffect(() => {
    if (!state.settings.remindersEnabled || notifPermission() !== 'granted') return
    const reminders = state.measureReminders ?? {}
    const cancels: Array<() => void> = []
    for (const [name, intervalDays] of Object.entries(reminders)) {
      if (!intervalDays || intervalDays <= 0) continue
      const samples = state.history[name] ?? []
      const lastTs = samples.length ? samples[samples.length - 1].ts : null
      cancels.push(scheduleMeasureReminder(name, intervalDays, lastTs))
    }
    return () => cancels.forEach((c) => c())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.remindersEnabled, state.measureReminders, state.history])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}
