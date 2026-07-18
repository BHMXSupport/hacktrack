import { useReducer, useEffect, useRef, type ReactNode } from 'react'
import { AppContext, reducer, initialState, hydrate } from '../../lib/store'
import type { AppState } from '../../lib/store'
import { startOfDay } from '../../lib/cadence'
import { upcomingDoses, doseTakenOnProduct, phaseForDate, weekAdherencePctLast8, protocolStreak } from '../../lib/calendar'
import { registerSW as swRegRef, scheduleSwReminder, schedulePreReminder, scheduleDailySummary, scheduleWeeklySummary, scheduleRescue, scheduleMeasureReminder, notifPermission, setNotifClickHandler } from '../../lib/notifications'
import { setNativeNotifTapHandler } from '../../lib/native/notifications'
import { rachaLabel } from '../../lib/buildFlags'
import { registerSW as registerPwaSW } from 'virtual:pwa-register'
import { useCloudSync } from '../../lib/backend/useCloudSync'

// Provider del rebuild: reusa el reducer/estado del app original (lib/store).
const KEY = 'hacktrack:v2'
const LEGACY = 'hacktrack:v1'

let _pwaRegistered = false

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
    // Migración IA 6→5 pestañas: estados persistidos con ids legados aterrizan en su
    // pestaña nueva (protocolo/comida→cuerpo, semana→diario); desconocidos → inicio.
    const TAB_MIGRATE: Record<string, AppState['tab']> = { protocolo: 'cuerpo', comida: 'cuerpo', semana: 'diario' }
    const TABS = ['inicio', 'vida', 'diario', 'cuerpo']
    const t = (merged as AppState).tab as string
    ;(merged as AppState).tab = TAB_MIGRATE[t] ?? (TABS.includes(t) ? (t as AppState['tab']) : 'inicio')
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
  // Ref al estado VIVO — para callbacks diferidos (p.ej. el rescate evalúa "¿ya registró?" al vencer).
  const stateRef = useRef(state)
  stateRef.current = state

  // Backend opt-in (auth/sync/push). NO-OP sin credenciales VITE_SUPABASE_* → el beta no cambia.
  // dispatch: un ciclo de sync puede TRAER novedades remotas (merge por registro) → 'applyMerged'.
  useCloudSync(state, dispatch)

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

  // #3 — registrar el Service Worker real via virtual:pwa-register (autoUpdate): recarga la página en
  // controllerchange — sin eso, un cliente abierto pediría chunks viejos ya purgados del precache.
  // swRegRef() solo cachea la registración para los postMessage de notifications.ts.
  useEffect(() => {
    if (!_pwaRegistered) {
      _pwaRegistered = true // guard: StrictMode monta doble en dev
      registerPwaSW({ immediate: true })
    }
    void swRegRef()
  }, [])

  // Al PICAR un recordatorio → abre la hoja del destino que ibas a registrar (no solo trae la app al frente).
  // El tag codifica el destino. Cubre 3 caminos: onclick del hilo principal (iOS PWA en foreground, caso real
  // hoy), postMessage del SW (push del backend con la app abierta) y ?goto= en la URL (app abierta desde cero).
  useEffect(() => {
    const routeTag = (tag: string) => {
      if (tag.startsWith('hacktrack-measure-')) dispatch({ t: 'sheet', sheet: 'medida', arg: tag.slice('hacktrack-measure-'.length) })
      else if (/^hacktrack-(dose|pre|rescue)-/.test(tag)) dispatch({ t: 'sheet', sheet: 'registrar', arg: tag.replace(/^hacktrack-(dose|pre|rescue)-/, '') })
      // 'semana' (legado) → AppV2 la muestra en el hueco de la pestaña Diario (vista Semana)
      else if (tag === 'hacktrack-weekly-summary') dispatch({ t: 'tab', tab: 'semana' })
      else if (tag === 'hacktrack-daily-summary') dispatch({ t: 'tab', tab: 'inicio' })
    }
    const routeGoto = (goto: string) => {
      if (goto.startsWith('medida:')) dispatch({ t: 'sheet', sheet: 'medida', arg: goto.slice('medida:'.length) })
      else if (goto.startsWith('registrar:')) dispatch({ t: 'sheet', sheet: 'registrar', arg: goto.slice('registrar:'.length) })
      // 'tab:semana' → pestaña Diario mostrando la vista Semana (id legado que AppV2 rutea)
      else if (goto === 'tab:semana') dispatch({ t: 'tab', tab: 'semana' })
    }
    setNotifClickHandler(routeTag)
    // Nativo (Capacitor): taps de LocalNotifications (incl. cold-start bufferizado) rutean igual.
    setNativeNotifTapHandler(routeTag)
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; goto?: string } | null
      if (d?.type === 'NOTIF_GOTO' && typeof d.goto === 'string') routeGoto(d.goto)
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    try {
      const g = new URLSearchParams(window.location.search).get('goto')
      if (g) {
        routeGoto(g)
        const u = new URL(window.location.href); u.searchParams.delete('goto')
        window.history.replaceState({}, '', u.toString()) // limpia el query → no re-enruta al recargar
      }
    } catch { /* sin URL/searchParams */ }
    return () => {
      setNotifClickHandler(null)
      setNativeNotifTapHandler(null)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recordatorio POR DOSIS: una notificación por CADA toma pendiente de HOY, a la hora de cada protocolo
  // (si tienes una a las 11 y otra a las 12, programa ambas). Antes solo avisaba de la próxima.
  // + segundo recordatorio (N min antes) + resumen diario (todos los protocolos de hoy) a la hora de Ajustes.
  // NOTA: funciona con la app abierta; con la app cerrada en iOS hace falta servidor de push (handoff).
  useEffect(() => {
    if (!state.settings.remindersEnabled || notifPermission() !== 'granted') return
    const now = new Date()
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999)
    // todas las tomas PENDIENTES de hoy (futuras, no registradas)
    const todayPending = upcomingDoses(state, now, 30)
      .filter((u) => u.date.getTime() <= endOfToday.getTime() && !doseTakenOnProduct(state, u.date, u.product))
    const pre = state.settings.secondReminderMin
    const rescueMin = state.settings.rescueWindowMin ?? 0
    const cancels: Array<() => void> = []
    for (const u of todayPending) {
      const delay = u.date.getTime() - now.getTime()
      if (delay <= 0) continue
      void scheduleSwReminder(u.product, delay)              // recordatorio a la hora de ESA dosis
      if (pre && pre > 0 && delay - pre * 60_000 > 0) {       // #F8: pre-aviso "se acerca" N min antes
        void schedulePreReminder(u.product, pre, delay - pre * 60_000)
      }
      // Aviso de RESCATE: rescueMin minutos DESPUÉS de la hora de la dosis, SOLO si aún no se registró.
      if (rescueMin > 0) {
        const at = u.date.getTime() // capturado para el closure
        cancels.push(scheduleRescue(u.product, delay + rescueMin * 60_000, () =>
          doseTakenOnProduct(stateRef.current, new Date(at), u.product)))
      }
    }
    // Resumen diario: una notificación a summaryTime listando los protocolos programados hoy.
    if (state.settings.dailySummary !== false) {
      const [sh, sm] = (state.settings.summaryTime ?? '08:00').split(':').map(Number)
      const summaryAt = new Date(now); summaryAt.setHours(sh || 8, sm || 0, 0, 0)
      const sdelay = summaryAt.getTime() - now.getTime()
      const todayAll = upcomingDoses(state, startOfDay(now), 30)
        .filter((u) => u.date.getTime() <= endOfToday.getTime())
      if (sdelay > 0 && todayAll.length) {
        const list = todayAll
          .map((u) => `${u.product} ${u.date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`)
          .join(' · ')
        void scheduleDailySummary(`Hoy: ${list} — ábrelo para no perder el ritmo.`, sdelay)
      }
    }
    // Resumen SEMANAL (lunes): adherencia + racha de la semana, a la hora de summaryTime.
    if (state.settings.weeklySummary && now.getDay() === 1) { // 1 = lunes
      const [wh, wm] = (state.settings.summaryTime ?? '08:00').split(':').map(Number)
      const weeklyAt = new Date(now); weeklyAt.setHours(wh || 8, wm || 0, 0, 0)
      const wdelay = weeklyAt.getTime() - now.getTime()
      if (wdelay > 0) {
        const weeks = weekAdherencePctLast8(state, startOfDay(now))
        const pct = weeks.length ? weeks[weeks.length - 1] : null
        const streak = protocolStreak(state, startOfDay(now), now)
        // rachaLabel: en tienda dice "racha de registro" (Apple 1.4.3); PWA sin cambio.
        const body = pct != null
          ? `Cumpliste ${pct}% de tus tomas y llevas ${streak} día${streak === 1 ? '' : 's'} de ${rachaLabel()}. Mira tu progreso.`
          : 'Empieza la semana con tu seguimiento. Ábrela y revisa tu progreso.'
        void scheduleWeeklySummary(body, wdelay)
      }
    }
    // Cancela los rescates pendientes al re-agendar (p.ej. tras registrar) o al desmontar.
    return () => cancels.forEach((c) => c())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.remindersEnabled, state.settings.secondReminderMin, state.settings.rescueWindowMin, state.settings.dailySummary, state.settings.weeklySummary, state.settings.summaryTime, state.protocols, state.log, state.todayTs])

  // #F5 — auto-avance de la fase de titulación: deriva la fase por fecha (phaseForDate desde startDate +
  // phaseWeeks del catálogo) y avanza curPhase HACIA ADELANTE (nunca atrás → respeta un avance manual).
  // Sin esto, quien no tocaba el botón manual se quedaba en fase 0 y veía la dosis de su fase equivocada
  // para su semana real. Re-evalúa al cambiar de día (todayTs) o al editar protocolos.
  useEffect(() => {
    for (const [name, p] of Object.entries(state.protocols)) {
      if (p.archived || !p.progOn) continue
      const phase = phaseForDate(state, new Date(), name)
      if (phase != null && phase > p.curPhase) {
        dispatch({ t: 'updateProtocolFor', product: name, patch: { curPhase: phase } })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.todayTs, state.protocols])

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
