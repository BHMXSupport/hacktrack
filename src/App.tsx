import { useReducer, useEffect } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { AppContext, reducer, initialState, useApp, hydrate } from './lib/store'
import { upcomingDoses, doseTakenOnProduct } from './lib/calendar'
import type { AppState } from './lib/store'
import { startOfDay } from './lib/cadence'
import { notifPermission, showReminder } from './lib/notifications'
import { sharedAxisX, spring } from './lib/motion'
import { tapHaptic } from './lib/haptics'
import { IcGear } from './components/icons'

// ── persistencia local (PWA: no perder datos al refrescar) ──
const STORAGE_KEY = 'hacktrack:v1'
function loadState(): AppState {
  const fresh = { ...initialState, todayTs: startOfDay(new Date()).getTime() }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw)
    const merged = { ...fresh, ...saved, sheet: null, toast: null, toastUndoId: null, todayTs: fresh.todayTs }
    // normaliza estado de navegación legado (p.ej. tab 'ajustes' ya no existe → crash) tras el rediseño
    const TABS = ['inicio', 'diario', 'protocolo', 'vida', 'comida', 'semana']
    if (!TABS.includes(merged.tab)) merged.tab = 'inicio'
    if (merged.progresoView !== 'cal' && merged.progresoView !== 'avances') merged.progresoView = 'cal'
    // hydrate(): migra estado legado (un solo protocol) al mapa multi-protocolo y sincroniza cachés
    return hydrate(merged)
  } catch {
    return fresh
  }
}
import { Splash } from './screens/Splash'
import { Onboarding } from './screens/Onboarding'
import { Goal } from './screens/Goal'
import { Baseline } from './screens/Baseline'
import { MeasurePicker } from './screens/MeasurePicker'
import { Account } from './screens/Account'
import { Login } from './screens/Login'
import { Forgot } from './screens/Forgot'
import { Welcome } from './screens/Welcome'
import { Import } from './screens/Import'
import { Home } from './screens/Home'
import { Diario } from './screens/Diario'
import { Progreso } from './screens/Progreso'
import { Vida } from './screens/Vida'
import { Alimentacion } from './screens/Alimentacion'
import { ResumenSemanal } from './screens/ResumenSemanal'
import { Ajustes } from './screens/Ajustes'
import { Perfil } from './screens/Perfil'
import { Paywall } from './screens/Paywall'
import { BottomNav } from './components/BottomNav'
import { RegistrarSheet } from './sheets/Registrar'
import { CalcSheet } from './sheets/Calc'
import { MedidaSheet } from './sheets/Medida'
import { ArcoSheet } from './sheets/Arco'
import { ConfirmDeleteSheet } from './sheets/ConfirmDelete'
import { ProtocoloEdit } from './sheets/ProtocoloEdit'
import { Agregar } from './sheets/Agregar'
import { Medidas } from './sheets/Medidas'
import { CrearPlatillo } from './sheets/CrearPlatillo'
import { Recetario } from './sheets/Recetario'
import { DoseConfirm } from './sheets/DoseConfirm'
import { MedidaDetailSheet } from './sheets/MedidaDetail'
import { DayDetail } from './sheets/DayDetail'

const fade = sharedAxisX

function Toast() {
  const { state, dispatch } = useApp()
  const hasUndo = !!state.toastUndoId
  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ t: 'toast', msg: null }), hasUndo ? 5000 : 2400)
    return () => clearTimeout(t)
  }, [state.toast, hasUndo, dispatch])
  return (
    <AnimatePresence>
      {state.toast && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={spring.sheet}
          style={{
            position: 'absolute', left: 18, right: 18, bottom: 96, zIndex: 60,
            background: 'var(--ink-900)', color: '#fff', borderRadius: 14, padding: '13px 16px',
            fontSize: 14, fontWeight: 600, boxShadow: 'var(--e3)',
            display: 'flex', alignItems: 'center', justifyContent: hasUndo ? 'space-between' : 'center', gap: 12,
          }}
        >
          <span>{state.toast}</span>
          {hasUndo && (
            <button
              type="button"
              onClick={() => {
                tapHaptic()
                // El undo de un borrado usa centinela "__undo_delete__" → restaura; el de un registro recién creado borra ese registro.
                if (state.toastUndoId!.startsWith('__undo_delete__')) dispatch({ t: 'undoDeleteLog' })
                else dispatch({ t: 'deleteLog', id: state.toastUndoId! })
                dispatch({ t: 'toast', msg: null })
              }}
              style={{ background: 'none', border: 0, color: 'var(--brand-500)', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, flexShrink: 0 }}
            >
              Deshacer
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const SHEETS = {
  agregar: Agregar,
  registrar: RegistrarSheet,
  calc: CalcSheet,
  medida: MedidaSheet,
  medidas: Medidas,
  'day-detail': DayDetail,
  arco: ArcoSheet,
  'confirm-delete': ConfirmDeleteSheet,
  'protocolo-edit': ProtocoloEdit,
  'crear-platillo': CrearPlatillo,
  recetario: Recetario,
  'dose-confirm': DoseConfirm,
  'medida-detail': MedidaDetailSheet,
} as const

function SheetHost() {
  const { state } = useApp()
  const id = state.sheet
  const Comp = id && id in SHEETS ? SHEETS[id as keyof typeof SHEETS] : null
  return <AnimatePresence>{Comp && <Comp key={id} />}</AnimatePresence>
}

const TAB_SCREENS = { inicio: Home, diario: Diario, protocolo: Progreso, vida: Vida, comida: Alimentacion, semana: ResumenSemanal }

function AppShell() {
  const { state, dispatch } = useApp()
  // modales full-screen montados sobre el shell (Ajustes ahora se abre desde el engranaje arriba-derecha)
  const FullModal = state.sheet === 'perfil' ? Perfil : state.sheet === 'paywall' ? Paywall : state.sheet === 'ajustes' ? Ajustes : null
  const Tab = TAB_SCREENS[state.tab]
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={state.tab} variants={fade} initial="initial" animate="animate" exit="exit"
          style={{ position: 'absolute', inset: 0 }}>
          <Tab />
        </motion.div>
      </AnimatePresence>

      {/* Engranaje de Ajustes — arriba a la derecha, global */}
      <button
        aria-label="Ajustes"
        onClick={() => dispatch({ t: 'sheet', sheet: 'ajustes' })}
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', right: 16, zIndex: 35,
          width: 38, height: 38, borderRadius: 999, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--ink-700)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--e1)',
        }}
      >
        <IcGear size={20} />
      </button>

      <BottomNav />
      <SheetHost />
      <AnimatePresence>{FullModal && <FullModal key={state.sheet} />}</AnimatePresence>
      <Toast />
    </>
  )
}

function Root() {
  const { state, dispatch } = useApp()
  // splash auto-avanza
  useEffect(() => {
    if (state.screen === 's-splash') {
      const t = setTimeout(() => dispatch({ t: 'go', screen: 's-onboarding' }), 2200)
      return () => clearTimeout(t)
    }
  }, [state.screen, dispatch])

  const screen = state.screen
  const FLOW: Record<string, () => JSX.Element> = {
    's-splash': Splash,
    's-onboarding': Onboarding,
    's-goal': Goal,
    's-baseline': Baseline,
    's-measures': MeasurePicker,
    's-account': Account,
    's-login': Login,
    's-forgot': Forgot,
    's-welcome': Welcome,
    's-import': Import,
  }
  const Flow = FLOW[screen]
  return (
    <AnimatePresence mode="wait">
      <motion.div key={screen} variants={fade} initial="initial" animate="animate" exit="exit"
        style={{ position: 'absolute', inset: 0 }}>
        {screen === 's-app' ? <AppShell /> : Flow ? <Flow /> : <Splash />}
      </motion.div>
    </AnimatePresence>
  )
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState, loadState)

  // persistir estado (excepto efímeros) en cada cambio
  useEffect(() => {
    try {
      const { sheet: _s, toast: _t, ...persist } = state
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist))
    } catch { /* almacenamiento lleno o no disponible */ }
  }, [state])

  // refrescar "hoy" al cruzar medianoche (sesiones largas)
  useEffect(() => {
    let timer: number
    const schedule = () => {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime()
      timer = window.setTimeout(() => { dispatch({ t: 'tick' }); schedule() }, next - now.getTime())
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])

  // tema claro/oscuro real (con modo automático 18–7 h)
  useEffect(() => {
    const { themeMode, darkMode } = state.settings
    function applyTheme() {
      let isDark: boolean
      if (themeMode === 'auto') {
        const h = new Date().getHours()
        isDark = h >= 18 || h < 7
      } else if (themeMode === 'light') {
        isDark = false
      } else if (themeMode === 'dark') {
        isDark = true
      } else {
        // sin themeMode → comportamiento legado basado en darkMode
        isDark = darkMode
      }
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }
    applyTheme()
    if (themeMode !== 'auto') return
    // en modo auto: re-evaluar cada minuto y al recuperar foco
    const interval = window.setInterval(applyTheme, 60_000)
    window.addEventListener('focus', applyTheme)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', applyTheme)
    }
  }, [state.settings.themeMode, state.settings.darkMode])

  // recordatorio local de la próxima toma (con la app abierta) — entre TODOS los productos activos
  useEffect(() => {
    if (!state.settings.remindersEnabled || notifPermission() !== 'granted') return
    const now = new Date()
    // primera toma futura que aún NO se ha registrado, de cualquier producto
    const next = upcomingDoses(state, now, 16).find((u) => !doseTakenOnProduct(state, u.date, u.product))
    if (!next) return
    const delay = next.date.getTime() - now.getTime()
    if (delay <= 0 || delay > 24 * 86400000) return
    const timer = window.setTimeout(() => {
      void showReminder('Es hora de tu registro', `Es hora de tu registro de ${next.product} de hoy.`)
    }, delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.remindersEnabled, state.protocols, state.log, state.todayTs])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <MotionConfig reducedMotion="user">
        <div className="app-root">
          <div className="phone">
            <Root />
          </div>
        </div>
      </MotionConfig>
    </AppContext.Provider>
  )
}
