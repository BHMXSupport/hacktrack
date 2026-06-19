import { useState, type ComponentType, type ReactNode } from 'react'
import { Settings } from 'lucide-react'
import { AppProviderV2 } from './lib/provider'
import { useApp } from '../lib/store'
import type { TabId } from '../lib/store'
import { FloatingNav } from './ui/FloatingNav'
import { AmbientBackground } from './ui/AmbientBackground'
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
import { Splash } from './flow/Splash'
import { Onboarding } from './flow/Onboarding'
import { Goal } from './flow/Goal'
import { Account } from './flow/Account'

// Flujo de arranque: splash → onboarding → goal → account → s-app.
// Pantallas no construidas aún (s-login/s-baseline/etc.) caen al shell (fallback seguro).
const FLOW: Record<string, ComponentType> = {
  's-splash': Splash,
  's-onboarding': Onboarding,
  's-goal': Goal,
  's-account': Account,
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame relative mx-auto h-[100dvh] w-full overflow-hidden bg-precision-grid sm:my-0 md:h-[880px] md:max-w-[412px] md:rounded-[40px]">
      <AmbientBackground />
      {children}
    </div>
  )
}

function Shell() {
  const { state, dispatch } = useApp()
  const [showAjustes, setShowAjustes] = useState(false)
  const [showPerfil, setShowPerfil] = useState(false)
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
        onClick={() => setShowAjustes(true)}
        className="absolute right-4 top-[max(14px,env(safe-area-inset-top))] z-40 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-raised/70 text-muted-foreground backdrop-blur"
      >
        <Settings size={18} />
      </button>

      <div className="absolute inset-0 overflow-y-auto overflow-x-clip">
        {tab === 'inicio' && <Inicio onRegistrar={openReg} />}
        {tab === 'diario' && <Diario />}
        {tab === 'protocolo' && <Progreso />}
        {tab === 'vida' && <Vida />}
        {tab === 'comida' && <Comida />}
        {tab === 'semana' && <Semana />}
      </div>

      <FloatingNav active={tab} onTab={(t) => dispatch({ t: 'tab', tab: t })} onFab={openReg} />

      <RegistrarSheet open={sheet === 'registrar' || sheet === 'agregar'} onClose={closeSheet} />
      <MedidaSheet open={sheet === 'medida'} onClose={closeSheet} measure={sheetArg} />
      <ConfirmDeleteSheet open={sheet === 'confirm-delete'} onClose={closeSheet} id={sheetArg} />
      <RecetarioSheet open={sheet === 'recetario' || sheet === 'crear-platillo'} onClose={closeSheet} />
      <Ajustes
        open={showAjustes}
        onClose={() => setShowAjustes(false)}
        onOpenPerfil={() => {
          setShowAjustes(false)
          setShowPerfil(true)
        }}
      />
      <Perfil open={showPerfil} onClose={() => setShowPerfil(false)} />
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
