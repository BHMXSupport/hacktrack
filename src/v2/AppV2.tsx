import { type ComponentType, type ReactNode, Suspense, lazy, useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { SegmentedTabs } from './ui/SegmentedTabs'
import { AppProviderV2 } from './lib/provider'
import { useApp } from '../lib/store'
import type { TabId, SheetId } from '../lib/store'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { FloatingNav } from './ui/FloatingNav'
import { AmbientBackground } from './ui/AmbientBackground'
import { LaunchSequence } from './ui/LaunchSequence'
import { PinGate } from './ui/PinGate'
import { InstallGate } from './ui/InstallGate'
import { shouldShowInstallGate } from '../lib/install'
import { Toast } from './ui/Toast'
import { NotifPermissionPrompt } from './ui/NotifPermissionPrompt'
import { Inicio } from './screens/Inicio'
import { Diario } from './screens/Diario'
import { Progreso } from './screens/Progreso'
import { Vida } from './screens/Vida'
import { Comida } from './screens/Comida'
import { Semana } from './screens/Semana'
import { RegistrarSheet } from './screens/RegistrarSheet'
import { MedidaSheet } from './screens/MedidaSheet'
import { CambioMedidasSheet } from './screens/CambioMedidasSheet'
import { ConfirmDeleteSheet } from './screens/ConfirmDeleteSheet'
import { RecetarioSheet } from './screens/RecetarioSheet'
import { Ajustes } from './screens/Ajustes'
import { Perfil } from './screens/Perfil'
import { ProtocolosSheet } from './screens/ProtocolosSheet'
import { ProtocoloEditSheet } from './screens/ProtocoloEditSheet'
import { CalcSheet } from './screens/CalcSheet'
import { DoseConfirmSheet } from './screens/DoseConfirmSheet'
import { PaywallSheet } from './screens/PaywallSheet'
import { PinSetupSheet } from './screens/PinSetupSheet'
import { Splash } from './flow/Splash'
import { Onboarding } from './flow/Onboarding'
import { Goal } from './flow/Goal'
import { Baseline } from './flow/Baseline'
import { MeasurePicker } from './flow/MeasurePicker'
import { ProtocolSetup } from './flow/ProtocolSetup'
import { Account } from './flow/Account'
import { Login } from './flow/Login'
import { Forgot } from './flow/Forgot'
import { Welcome } from './flow/Welcome'
import { STORE_BUILD } from '../lib/buildFlags'

// Exclusión en COMPILACIÓN (Apple 1.4.3): la integración de importación de compras del
// partner NO existe en binarios de tienda. El import() dinámico vive dentro de una rama
// muerta cuando STORE_BUILD=true → Rollup ni siquiera emite el chunk de ImportSheet
// (lo demuestra scripts/store-gate.mjs). En la PWA se carga lazy y el flujo no cambia.
const ImportSheet = STORE_BUILD
  ? null
  : lazy(() => import('./screens/ImportSheet').then((m) => ({ default: m.ImportSheet })))

// Flujo de arranque: splash → onboarding → goal → baseline → measures → account → s-app.
// Login es alterno (desde Account "ya tengo cuenta"). s-forgot = pantalla real de recuperación.
const FLOW: Record<string, ComponentType> = {
  's-splash': Splash,
  's-onboarding': Onboarding,
  's-goal': Goal,
  's-baseline': Baseline,
  's-measures': MeasurePicker,
  's-protocol': ProtocolSetup,
  's-account': Account,
  's-login': Login,
  's-forgot': Forgot,
}

// ── Pestaña Cuerpo (IA 5-tab) — anfitrión Progreso | Comida ──────────────────
// Conmutador de vista sobre el masthead de cada pantalla. El id legado 'comida'
// aterriza aquí con la vista Comida activa (deep-links y dispatches preservados).
// El margen negativo compensa el safe-area padding propio de las pantallas (solo
// presentación); mr-14 despeja el engrane de Ajustes que flota arriba a la derecha.
function CuerpoTab({ initial }: { initial: 'cuerpo' | 'comida' }) {
  const [view, setView] = useState<'cuerpo' | 'comida'>(initial)
  useEffect(() => { setView(initial) }, [initial])
  return (
    <>
      <div className="px-4 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
        <SegmentedTabs
          className="mr-14"
          options={[
            { value: 'cuerpo', label: 'Cuerpo' },
            { value: 'comida', label: 'Comida' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <div className="-mt-[env(safe-area-inset-top,0px)]">
        {view === 'cuerpo' ? <Progreso /> : <Comida />}
      </div>
    </>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame relative mx-auto h-[100dvh] w-full overflow-hidden bg-precision-grid sm:my-0 md:h-[880px] md:max-w-[412px] md:rounded-[40px]">
      <AmbientBackground />
      {children}
      <LaunchSequence />
    </div>
  )
}

function Shell() {
  const { state, dispatch } = useApp()
  // Hojas impulsadas por state.sheet → cualquier pantalla las abre con dispatch({t:'sheet',sheet,arg}).
  const openReg = () => dispatch({ t: 'sheet', sheet: 'registrar' })
  const closeSheet = () => dispatch({ t: 'sheet', sheet: null })
  const sheet = state.sheet
  const sheetArg = (state.sheetArg as string | undefined) ?? null

  // Pila de sub-hojas: al abrir Perfil/Protocolos/Calc/Import DESDE Ajustes, cerrar (← / backdrop / Escape)
  // debe volver a Ajustes, no caer a la app. returnTo recuerda a dónde regresar; se limpia si la hoja se
  // cierra por otra vía (p.ej. dispatch directo a null).
  const [returnTo, setReturnTo] = useState<SheetId | null>(null)
  const closeSubSheet = () => {
    if (returnTo) { dispatch({ t: 'sheet', sheet: returnTo }); setReturnTo(null) }
    else closeSheet()
  }
  const openFromAjustes = (target: SheetId) => { setReturnTo('ajustes'); dispatch({ t: 'sheet', sheet: target }) }
  useEffect(() => { if (!sheet) setReturnTo(null) }, [sheet])

  // PIN de bloqueo: si está activo, se pide al abrir/recargar (unlocked es por-sesión, arranca en false).
  const [unlocked, setUnlocked] = useState(false)
  const needsPin = state.settings.pinEnabled && !!state.settings.pinHash && !unlocked

  // Router de arranque
  const FlowScreen = FLOW[state.screen]
  if (FlowScreen && state.screen !== 's-app') {
    return (
      <Frame>
        <FlowScreen />
        {/* Los toasts también deben verse fuera de s-app: p.ej. el aviso de borrado ARCO
            (éxito u honesto de fallo en nube) se emite navegando a onboarding. */}
        <Toast />
      </Frame>
    )
  }

  // IA 5-tab (LOCKED): inicio · vida · [+] · diario · cuerpo. Los ids legados siguen
  // siendo estados válidos (dispatches de pantallas hermanas, notificaciones, gotos):
  // se NORMALIZAN aquí a su pestaña nueva y el id crudo elige la sub-vista —
  // protocolo→cuerpo (Progreso) · comida→cuerpo (vista Comida) · semana→diario (Semana).
  const rawTab = state.tab as TabId
  const tab: TabId =
    rawTab === 'protocolo' || rawTab === 'comida' ? 'cuerpo'
    : rawTab === 'semana' ? 'diario'
    : rawTab
  return (
    <Frame>
      {/* Ajustes: afford. global de header — engrane flotante visible en TODAS las pestañas
          (única puerta a Ajustes, sin pestaña propia). Editorial: superficie opaca + hairline. */}
      <button
        aria-label="Ajustes"
        onClick={() => dispatch({ t: 'sheet', sheet: 'ajustes' })}
        className="absolute right-4 top-[max(14px,env(safe-area-inset-top))] z-40 grid h-11 w-11 place-items-center rounded-full border border-hairline bg-surface text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        <Settings size={19} />
      </button>

      {/* R6 — ErrorBoundary por pestaña (un crash no tumba toda la app); key=rawTab → resetea al cambiar */}
      <ErrorBoundary key={rawTab} scope={tab} allowReset>
        <div className="absolute inset-0 overflow-y-auto overflow-x-clip ios-scroll">
          {tab === 'inicio' && <Inicio onRegistrar={openReg} />}
          {tab === 'diario' && (rawTab === 'semana' ? <Semana /> : <Diario />)}
          {tab === 'vida' && <Vida />}
          {tab === 'cuerpo' && <CuerpoTab initial={rawTab === 'comida' ? 'comida' : 'cuerpo'} />}
        </div>
      </ErrorBoundary>

      <FloatingNav active={tab} onTab={(t) => dispatch({ t: 'tab', tab: t })} onFab={openReg} simple={!!state.settings.simpleMode} />
      <Toast />

      <RegistrarSheet open={sheet === 'registrar' || sheet === 'agregar'} onClose={closeSheet} />
      <MedidaSheet open={sheet === 'medida'} onClose={closeSheet} measure={sheetArg} />
      <CambioMedidasSheet open={sheet === 'medidas'} onClose={closeSheet} />
      <ConfirmDeleteSheet open={sheet === 'confirm-delete'} onClose={closeSheet} id={sheetArg} />
      <RecetarioSheet
        open={sheet === 'recetario' || sheet === 'crear-platillo'}
        onClose={closeSheet}
        initialView={sheet === 'crear-platillo' ? 'create' : 'list'}
      />
      <Ajustes
        open={sheet === 'ajustes'}
        onClose={closeSheet}
        onOpenPerfil={() => openFromAjustes('perfil')}
        onOpenProtocolos={() => openFromAjustes('protocolos')}
        onOpenCalc={() => openFromAjustes('calc')}
        onOpenImport={() => openFromAjustes('import')}
      />
      <Perfil open={sheet === 'perfil'} onClose={closeSubSheet} />
      <ProtocolosSheet open={sheet === 'protocolos'} onClose={closeSubSheet} />
      <ProtocoloEditSheet open={sheet === 'protocolo-edit'} onClose={closeSheet} product={sheetArg} />
      <CalcSheet open={sheet === 'calc'} onClose={closeSubSheet} />
      <DoseConfirmSheet open={sheet === 'dose-confirm'} onClose={closeSheet} arg={sheetArg} />
      {!STORE_BUILD && ImportSheet && (
        <Suspense fallback={null}>
          <ImportSheet open={sheet === 'import'} onClose={closeSubSheet} />
        </Suspense>
      )}
      <PaywallSheet open={sheet === 'paywall'} onClose={closeSheet} />
      <PinSetupSheet open={sheet === 'pin-setup'} onClose={closeSheet} />

      {/* Pide permiso de notificaciones al entrar si no está concedido (repite mientras esté en "no"). */}
      <NotifPermissionPrompt />

      {/* Welcome — overlay full-screen tras finishOnboarding (justOnboarded), sobre s-app */}
      {state.justOnboarded && (
        <div className="absolute inset-0 z-[90] overflow-y-auto bg-void ios-scroll">
          <Welcome />
        </div>
      )}

      {/* PIN de bloqueo (z-95): el splash (z-100) lo cubre y, al desmontarse, queda el PIN sobre la app. */}
      {needsPin && <PinGate onUnlock={() => setUnlocked(true)} />}
    </Frame>
  )
}

export function AppV2() {
  // Gate de instalación: en móvil, si NO corre como app instalada (standalone), no deja pasar y
  // muestra cómo agregarla a la pantalla de inicio. (Escritorio pasa: ahí no hay "instalar PWA" claro
  // y se evita dejar sin acceso a revisores/colaboradores en Chrome de escritorio.)
  // En builds de tienda NO existe: la app ya llega instalada (el WebView de Capacitor no es
  // display-mode standalone → el gate bloquearía el binario) y su copy menciona "sin tienda".
  if (!STORE_BUILD && shouldShowInstallGate()) return <InstallGate />
  return (
    <AppProviderV2>
      <Shell />
    </AppProviderV2>
  )
}
