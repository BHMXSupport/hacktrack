import { type ComponentType, type ReactNode } from 'react'
import { Settings } from 'lucide-react'
import { AppProviderV2 } from './lib/provider'
import { useApp } from '../lib/store'
import type { TabId } from '../lib/store'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { FloatingNav } from './ui/FloatingNav'
import { AmbientBackground } from './ui/AmbientBackground'
import { PreloaderSplash } from './ui/PreloaderSplash'
import { Toast } from './ui/Toast'
import { Inicio } from './screens/Inicio'
import { Diario } from './screens/Diario'
import { Progreso } from './screens/Progreso'
import { Vida } from './screens/Vida'
import { Comida } from './screens/Comida'
import { Semana } from './screens/Semana'
import { RegistrarSheet } from './screens/RegistrarSheet'
import { MedidaSheet } from './screens/MedidaSheet'
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
import { Splash } from './flow/Splash'
import { Onboarding } from './flow/Onboarding'
import { Goal } from './flow/Goal'
import { Baseline } from './flow/Baseline'
import { MeasurePicker } from './flow/MeasurePicker'
import { Account } from './flow/Account'
import { Login } from './flow/Login'
import { Welcome } from './flow/Welcome'

// Flujo de arranque: splash → onboarding → goal → baseline → measures → account → s-app.
// Login es alterno (desde Account "ya tengo cuenta"). s-forgot aún no existe → cae a Login.
const FLOW: Record<string, ComponentType> = {
  's-splash': Splash,
  's-onboarding': Onboarding,
  's-goal': Goal,
  's-baseline': Baseline,
  's-measures': MeasurePicker,
  's-account': Account,
  's-login': Login,
  's-forgot': Login,
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame relative mx-auto h-[100dvh] w-full overflow-hidden bg-precision-grid sm:my-0 md:h-[880px] md:max-w-[412px] md:rounded-[40px]">
      <AmbientBackground />
      {children}
      <PreloaderSplash />
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

  // Router de arranque
  const FlowScreen = FLOW[state.screen]
  if (FlowScreen && state.screen !== 's-app') {
    return (
      <Frame>
        <FlowScreen />
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
        <div className="absolute inset-0 overflow-y-auto overflow-x-clip">
          {tab === 'inicio' && <Inicio onRegistrar={openReg} />}
          {tab === 'diario' && <Diario />}
          {tab === 'protocolo' && <Progreso />}
          {tab === 'vida' && <Vida />}
          {tab === 'comida' && <Comida />}
          {tab === 'semana' && <Semana />}
        </div>
      </ErrorBoundary>

      <FloatingNav active={tab} onTab={(t) => dispatch({ t: 'tab', tab: t })} onFab={openReg} />
      <Toast />

      <RegistrarSheet open={sheet === 'registrar' || sheet === 'agregar'} onClose={closeSheet} />
      <MedidaSheet open={sheet === 'medida'} onClose={closeSheet} measure={sheetArg} />
      <ConfirmDeleteSheet open={sheet === 'confirm-delete'} onClose={closeSheet} id={sheetArg} />
      <RecetarioSheet
        open={sheet === 'recetario' || sheet === 'crear-platillo'}
        onClose={closeSheet}
        initialView={sheet === 'crear-platillo' ? 'create' : 'list'}
      />
      <Ajustes open={sheet === 'ajustes'} onClose={closeSheet} onOpenPerfil={() => dispatch({ t: 'sheet', sheet: 'perfil' })} />
      <Perfil open={sheet === 'perfil'} onClose={closeSheet} />
      <ProtocolosSheet open={sheet === 'protocolos'} onClose={closeSheet} />
      <ProtocoloEditSheet open={sheet === 'protocolo-edit'} onClose={closeSheet} product={sheetArg} />
      <CalcSheet open={sheet === 'calc'} onClose={closeSheet} />
      <DoseConfirmSheet open={sheet === 'dose-confirm'} onClose={closeSheet} arg={sheetArg} />
      <ImportSheet open={sheet === 'import'} onClose={closeSheet} />
      <PaywallSheet open={sheet === 'paywall'} onClose={closeSheet} />

      {/* Welcome — overlay full-screen tras finishOnboarding (justOnboarded), sobre s-app */}
      {state.justOnboarded && (
        <div className="absolute inset-0 z-[90] overflow-y-auto bg-void">
          <Welcome />
        </div>
      )}
    </Frame>
  )
}

export function AppV2() {
  return (
    <AppProviderV2>
      <Shell />
    </AppProviderV2>
  )
}
