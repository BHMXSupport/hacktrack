import { useReducer, useEffect, useState, lazy, Suspense, type ComponentType } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { AppContext, reducer, initialState, useApp, hydrate } from './lib/store'
import { upcomingDoses, doseTakenOnProduct } from './lib/calendar'
import type { AppState } from './lib/store'
import { startOfDay } from './lib/cadence'
import { notifPermission, showReminder, registerSW } from './lib/notifications'
import { sharedAxisX, spring } from './lib/motion'
import { tapHaptic } from './lib/haptics'
import { IcGear } from './components/icons'

// ── Persistencia versionada con pipeline de migrations (item 408) ─────────────
const STORAGE_KEY = 'hacktrack:v2'
const STORAGE_KEY_LEGACY = 'hacktrack:v1'
const SCHEMA_VERSION = 2

type MigrateFn = (raw: Record<string, unknown>) => Record<string, unknown>

const MIGRATIONS: Record<number, MigrateFn> = {
  // v1 → v2: renombrar legacyProtocol → protocol cache; añadir campos aditivos
  1: (raw) => {
    const out = { ...raw }
    // calcDraft / savedRecons / measureGoals / measureReminders / productAliases — ya manejados por spread con initialState
    // dayNotes / achievements — se inicializan vacíos si no existen (retrocompatible)
    if (!out.calcDraft) out.calcDraft = null
    if (!out.savedRecons) out.savedRecons = []
    if (!out.measureGoals) out.measureGoals = {}
    if (!out.measureReminders) out.measureReminders = {}
    if (!out.productAliases) out.productAliases = {}
    if (out.fastStartTs === undefined) out.fastStartTs = null
    if (out.showFirstDoseCelebration === undefined) out.showFirstDoseCelebration = false
    if (!out.achievements) out.achievements = []
    if (!out.dayNotes) out.dayNotes = {}
    return out
  },
}

function migrateState(raw: Record<string, unknown>, target: number): Record<string, unknown> {
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1
  let state = { ...raw }
  while (version < target) {
    const fn = MIGRATIONS[version]
    if (fn) state = fn(state)
    version++
  }
  return { ...state, schemaVersion: target }
}

function loadState(): AppState {
  const fresh = { ...initialState, todayTs: startOfDay(new Date()).getTime(), schemaVersion: SCHEMA_VERSION } as AppState
  try {
    // intentar v2 primero; fallback a v1 (migración automática)
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as Record<string, unknown>
    const migrated = migrateState(saved, SCHEMA_VERSION)
    const merged = { ...fresh, ...migrated, sheet: null, toast: null, toastUndoId: null, todayTs: fresh.todayTs } as AppState
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
// ── Lazy loading de tabs y sheets (item 491) ──────────────────────────────────
// React.lazy + Suspense: carga diferida de cada pantalla. Prefetch on hover se
// logra importando dinámicamente al onMouseEnter del nav (ver BottomNav).
import { Splash } from './screens/Splash'                        // crítica — siempre eager

// lazyRetry: como React.lazy pero si el chunk FALLA al cargar (típico tras un redeploy: el
// service worker viejo referencia un hash que ya no existe → 404), recarga la página UNA vez para
// tomar el bundle nuevo. Sin esto, un fallo de import deja el Suspense colgado = pantalla en blanco.
// Clave única en sessionStorage: tras la recarga, el primer chunk que SÍ carga la limpia → evita
// loops y permite reintentar más adelante en la sesión.
const CHUNK_RETRY_KEY = 'ht:chunkretry'
function lazyRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory()
      .then((m) => { try { sessionStorage.removeItem(CHUNK_RETRY_KEY) } catch { /* noop */ } return m })
      .catch((err: unknown) => {
        let already = false
        try { already = !!sessionStorage.getItem(CHUNK_RETRY_KEY) } catch { /* noop */ }
        if (!already) {
          try { sessionStorage.setItem(CHUNK_RETRY_KEY, '1') } catch { /* noop */ }
          window.location.reload()
          return new Promise<{ default: T }>(() => { /* recarga en curso: nunca resuelve */ })
        }
        throw err // ya recargamos una vez y sigue fallando → que lo capture el ErrorBoundary
      }),
  )
}

const Onboarding   = lazyRetry(() => import('./screens/Onboarding').then((m) => ({ default: m.Onboarding })))
const Goal         = lazyRetry(() => import('./screens/Goal').then((m) => ({ default: m.Goal })))
const Baseline     = lazyRetry(() => import('./screens/Baseline').then((m) => ({ default: m.Baseline })))
const MeasurePicker= lazyRetry(() => import('./screens/MeasurePicker').then((m) => ({ default: m.MeasurePicker })))
const Account      = lazyRetry(() => import('./screens/Account').then((m) => ({ default: m.Account })))
const Login        = lazyRetry(() => import('./screens/Login').then((m) => ({ default: m.Login })))
const Forgot       = lazyRetry(() => import('./screens/Forgot').then((m) => ({ default: m.Forgot })))
const Welcome      = lazyRetry(() => import('./screens/Welcome').then((m) => ({ default: m.Welcome })))
const Import       = lazyRetry(() => import('./screens/Import').then((m) => ({ default: m.Import })))
// Tabs principales — lazy para reducir bundle inicial
const Home         = lazyRetry(() => import('./screens/Home').then((m) => ({ default: m.Home })))
const Diario       = lazyRetry(() => import('./screens/Diario').then((m) => ({ default: m.Diario })))
const Progreso     = lazyRetry(() => import('./screens/Progreso').then((m) => ({ default: m.Progreso })))
const Vida         = lazyRetry(() => import('./screens/Vida').then((m) => ({ default: m.Vida })))
const Alimentacion = lazyRetry(() => import('./screens/Alimentacion').then((m) => ({ default: m.Alimentacion })))
const ResumenSemanal=lazy(() => import('./screens/ResumenSemanal').then((m) => ({ default: m.ResumenSemanal })))
// Modales full-screen
const Ajustes      = lazyRetry(() => import('./screens/Ajustes').then((m) => ({ default: m.Ajustes })))
const Perfil       = lazyRetry(() => import('./screens/Perfil').then((m) => ({ default: m.Perfil })))
const Paywall      = lazyRetry(() => import('./screens/Paywall').then((m) => ({ default: m.Paywall })))
// Sheets
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { InstallGate } from './components/InstallGate'
import { ScreenIntro } from './components/ScreenIntro'
import { shouldShowInstallGate } from './lib/install'
const RegistrarSheet  = lazyRetry(() => import('./sheets/Registrar').then((m) => ({ default: m.RegistrarSheet })))
const CalcSheet       = lazyRetry(() => import('./sheets/Calc').then((m) => ({ default: m.CalcSheet })))
const MedidaSheet     = lazyRetry(() => import('./sheets/Medida').then((m) => ({ default: m.MedidaSheet })))
const ArcoSheet       = lazyRetry(() => import('./sheets/Arco').then((m) => ({ default: m.ArcoSheet })))
const ConfirmDeleteSheet = lazyRetry(() => import('./sheets/ConfirmDelete').then((m) => ({ default: m.ConfirmDeleteSheet })))
const ProtocoloEdit   = lazyRetry(() => import('./sheets/ProtocoloEdit').then((m) => ({ default: m.ProtocoloEdit })))
const Agregar         = lazyRetry(() => import('./sheets/Agregar').then((m) => ({ default: m.Agregar })))
const Medidas         = lazyRetry(() => import('./sheets/Medidas').then((m) => ({ default: m.Medidas })))
const CrearPlatillo   = lazyRetry(() => import('./sheets/CrearPlatillo').then((m) => ({ default: m.CrearPlatillo })))
const Recetario       = lazyRetry(() => import('./sheets/Recetario').then((m) => ({ default: m.Recetario })))
const DoseConfirm     = lazyRetry(() => import('./sheets/DoseConfirm').then((m) => ({ default: m.DoseConfirm })))
const MedidaDetailSheet= lazyRetry(() => import('./sheets/MedidaDetail').then((m) => ({ default: m.MedidaDetailSheet })))
const DayDetail       = lazyRetry(() => import('./sheets/DayDetail').then((m) => ({ default: m.DayDetail })))

/** Fallback mínimo durante lazy-load (evita flash blanco) */
// Fallback de Suspense VISIBLE (antes era un div en blanco = se veía como "pantalla en blanco"
// mientras cargaba el chunk de una tab). Spinner centrado sobre el fondo de la app.
function SheetFallback() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
        style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--ink-100)', borderTopColor: 'var(--brand-700)' }}
        aria-label="Cargando"
        role="status"
      />
    </div>
  )
}

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
  return (
    <Suspense fallback={<SheetFallback />}>
      {/* mode="wait": al cambiar de una sheet a otra (p.ej. Agregar → Medida), cierra la anterior
          ANTES de abrir la nueva. Antes (sync) quedaban ambas montadas y el overlay de la primera
          interceptaba los clics → no se podía cerrar la segunda (bug "no me deja salir"). */}
      <AnimatePresence mode="wait">{Comp && <Comp key={id} />}</AnimatePresence>
    </Suspense>
  )
}

const TAB_SCREENS = { inicio: Home, diario: Diario, protocolo: Progreso, vida: Vida, comida: Alimentacion, semana: ResumenSemanal }

// Intro de primera vez por pestaña (aparece una sola vez, como el coach de Diario). Diario se excluye
// porque ya tiene su propia guía. Clave por tab en localStorage → cada pantalla se explica una vez.
const TAB_INTROS: Record<string, { title: string; tips: string[] }> = {
  inicio: {
    title: 'Inicio',
    tips: [
      'Tu resumen del día: adherencia, próxima dosis y el mapa de zonas de inyección.',
      "Toca 'Registrar' para anotar la dosis del día.",
      'El botón + (abajo) abre el registro rápido: una dosis, comida o una medida.',
    ],
  },
  protocolo: {
    title: 'Progreso',
    tips: [
      'Calendario de tus dosis y tu adherencia de la semana.',
      "Agrega productos con '+ Agregar producto' o en 'Gestión de productos'.",
      "Cambia a 'Avances' para ver tus tendencias y la fase de cada protocolo.",
    ],
  },
  vida: {
    title: 'Vida',
    tips: [
      'Estima cuánto tiempo sigue activo cada péptido en tu cuerpo, según tus dosis.',
      'Es una guía educativa de presencia/vida media, no un dato clínico.',
      'Mientras más registres tus dosis, mejor se ajusta la estimación.',
    ],
  },
  comida: {
    title: 'Comida',
    tips: [
      'Registra lo que comes: escribe el alimento, usa el Recetario o crea un platillo.',
      'Lleva tu agua del día con el botón + del vaso.',
      'Compara tus macros (proteína, carbos, grasa) contra las metas que tú defines.',
    ],
  },
  semana: {
    title: 'Tu semana',
    tips: [
      'Resumen de tu semana: adherencia, dosis, hidratación y calorías.',
      "Las 'Señales de la semana' destacan tus cambios y logros.",
      "Comparte tu resumen con el botón 'Compartir'.",
    ],
  },
}

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
          {/* Boundary por pantalla: si una tab crashea al renderizar (p.ej. tras registrar una dosis),
              muestra un fallback recuperable en lugar de pantalla en blanco; la nav de abajo sigue viva.
              Suspense propio: al cambiar a una tab cuyo chunk lazy aún no cargó, muestra el spinner
              EN EL ÁREA DE CONTENIDO (la nav queda fuera de este Suspense → no parpadea ni desaparece).
              Antes el único Suspense envolvía todo el AppShell → al cargar un chunk se borraba la pantalla
              completa y, con el fallback en blanco, se veía como "pantalla en blanco" al cambiar de tab.
              resetKey=tab → al cambiar de pestaña se limpia el error. */}
          <ErrorBoundary resetKey={state.tab} scope={'tab:' + state.tab}>
            <Suspense fallback={<SheetFallback />}>
              <Tab />
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>

      {/* Intro de primera vez por pestaña (una sola vez c/u). key={tab} → remonta al cambiar de tab y
          revisa su propia clave en localStorage. Diario no está en el mapa (ya tiene su guía). */}
      {TAB_INTROS[state.tab] && (
        <ScreenIntro
          key={state.tab}
          storageKey={`hk_intro_${state.tab}`}
          title={TAB_INTROS[state.tab].title}
          tips={TAB_INTROS[state.tab].tips}
        />
      )}

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
      <ErrorBoundary resetKey={state.sheet} scope="sheet">
        <SheetHost />
      </ErrorBoundary>
      <Suspense fallback={<SheetFallback />}>
        <AnimatePresence>
          {FullModal && (
            <ErrorBoundary resetKey={state.sheet} scope={'modal:' + state.sheet}>
              <FullModal key={state.sheet} />
            </ErrorBoundary>
          )}
        </AnimatePresence>
      </Suspense>
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
  const FLOW: Record<string, ComponentType> = {
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
    <Suspense fallback={<SheetFallback />}>
      <AnimatePresence mode="wait">
        <motion.div key={screen} variants={fade} initial="initial" animate="animate" exit="exit"
          style={{ position: 'absolute', inset: 0 }}>
          {screen === 's-app' ? <AppShell /> : Flow ? <Flow /> : <Splash />}
        </motion.div>
      </AnimatePresence>
    </Suspense>
  )
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState, loadState)
  // ¿abrieron el link en el navegador sin instalar? → mostrar el asistente de instalación (forzado)
  const [showInstall] = useState(shouldShowInstallGate)

  // registrar SW para push real (item 401) — una vez al montar
  useEffect(() => {
    void registerSW()
  }, [])

  // Prefetch de los chunks lazy de las tabs cuando el navegador está idle tras cargar.
  // Sin esto, la PRIMERA visita a cada pestaña descarga su chunk on-demand → spinner / "no scrollea,
  // esperas" (en MÓVIL no hay hover, así que no había ningún prefetch). Al precargarlos en background,
  // los cambios de pestaña son instantáneos. import() comparte chunk con el lazyRetry (Vite dedup).
  useEffect(() => {
    const prefetch = () => {
      void import('./screens/Home'); void import('./screens/Diario'); void import('./screens/Progreso')
      void import('./screens/Vida'); void import('./screens/Alimentacion'); void import('./screens/ResumenSemanal')
      void import('./sheets/Registrar'); void import('./sheets/Agregar') // flujo del "+"
    }
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
    const id = ric(prefetch)
    return () => { (window.cancelIdleCallback ?? window.clearTimeout)(id as number) }
  }, [])

  // ── Deep-link desde App Shortcuts del manifest (items 314 + 438) ─────────────
  // Captura ?action=log|medida|microlog al iniciar la app desde el shortcut del OS.
  // Se ejecuta una sola vez al montar (el estado de screen puede estar en 's-app' o en el flow).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    if (!action) return
    // Limpiar el param de la URL sin recargar
    const clean = window.location.pathname
    window.history.replaceState({}, '', clean)
    // Esperar a que la app esté en 's-app' para abrir la sheet
    const open = () => {
      if (action === 'log') dispatch({ t: 'sheet', sheet: 'registrar' })
      else if (action === 'medida') dispatch({ t: 'sheet', sheet: 'medida' })
      else if (action === 'microlog') dispatch({ t: 'sheet', sheet: 'agregar' })
    }
    // Si ya estamos en la app, abrir inmediatamente; si no, diferir 2.5 s (post-splash)
    if (state.screen === 's-app') open()
    else {
      const t = window.setTimeout(open, 2500)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // persistir estado (excepto efímeros) en cada cambio
  useEffect(() => {
    try {
      const { sheet: _s, toast: _t, ...persist } = state
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...persist, schemaVersion: SCHEMA_VERSION }))
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
            {/* Cubre-notch: barra opaca (fondo de la app) sobre la zona del status-bar/notch, por
                ENCIMA del contenido → lo que scrollea hacia arriba desaparece detrás de la barra en vez
                de "comerse las letras" bajo la status bar translúcida.
                SOLO en la app principal (s-app) con bg claro: tabs + modales Ajustes/Perfil/Paywall.
                NO en bottom-sheets (su overlay oscuro ya cubre el notch; una banda clara desentonaría) ni
                en flows/auth (su logo/header vive arriba y la barra lo taparía). */}
            {state.screen === 's-app'
              && (!state.sheet || state.sheet === 'ajustes' || state.sheet === 'perfil' || state.sheet === 'paywall') && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 'env(safe-area-inset-top, 0px)',
                  background: 'var(--bg)', zIndex: 60, pointerEvents: 'none',
                }}
              />
            )}
            {/* Asistente de instalación: aparece al abrir el link en el navegador (no instalada).
                Detecta iPhone/Android y guía la instalación. Sin escape: la beta se usa instalada. */}
            {showInstall && <InstallGate />}
          </div>
        </div>
      </MotionConfig>
    </AppContext.Provider>
  )
}
