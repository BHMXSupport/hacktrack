import { type ComponentType, type ReactNode, useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
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
import { ImportSheet } from './screens/ImportSheet'
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

  const tab = state.tab as TabId
  return (
    <Frame>
      <button
        aria-label="Ajustes"
        onClick={() => dispatch({ t: 'sheet', sheet: 'ajustes' })}
        className="absolute right-4 top-[max(14px,env(safe-area-inset-top))] z-40 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-raised/70 text-muted-foreground backdrop-blur"
      >
        <Settings size={18} />
      </button>

      {/* R6 — ErrorBoundary por pestaña (un crash no tumba toda la app); key=tab → resetea al cambiar */}
      <ErrorBoundary key={tab} scope={tab} allowReset>
        <div className="absolute inset-0 overflow-y-auto overflow-x-clip ios-scroll">
          {tab === 'inicio' && <Inicio onRegistrar={openReg} />}
          {tab === 'diario' && <Diario />}
          {tab === 'protocolo' && <Progreso />}
          {tab === 'vida' && <Vida />}
          {tab === 'comida' && <Comida />}
          {tab === 'semana' && <Semana />}
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
      <ImportSheet open={sheet === 'import'} onClose={closeSubSheet} />
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
  if (shouldShowInstallGate()) return <InstallGate />
  return (
    <AppProviderV2>
      <Shell />
    </AppProviderV2>
  )
}
