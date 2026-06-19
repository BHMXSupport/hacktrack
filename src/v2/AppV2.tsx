import { useState } from 'react'
import { Settings, Hammer } from 'lucide-react'
import { AppProviderV2 } from './lib/provider'
import { useApp } from '../lib/store'
import type { TabId } from '../lib/store'
import { FloatingNav } from './ui/FloatingNav'
import { Inicio } from './screens/Inicio'
import { Diario } from './screens/Diario'
import { Progreso } from './screens/Progreso'
import { RegistrarSheet } from './screens/RegistrarSheet'

const PLACEHOLDER: Record<string, string> = {
  vida: 'Vida',
  comida: 'Comida',
  semana: 'Semana',
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/10 text-teal">
        <Hammer size={26} />
      </span>
      <h2 className="text-[20px] font-bold text-foreground">{name}</h2>
      <p className="text-[14px] text-muted-foreground">En construcción — llega en la siguiente etapa del rebuild.</p>
    </div>
  )
}

function Shell() {
  const { state, dispatch } = useApp()
  const tab = state.tab as TabId
  const [showReg, setShowReg] = useState(false)

  return (
    <div className="app-frame relative mx-auto h-[100dvh] w-full overflow-hidden bg-precision-grid sm:my-0 md:h-[880px] md:max-w-[412px] md:rounded-[40px]">
      {/* gear ajustes */}
      <button
        aria-label="Ajustes"
        className="absolute right-4 top-[max(14px,env(safe-area-inset-top))] z-40 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-raised/70 text-muted-foreground backdrop-blur"
      >
        <Settings size={18} />
      </button>

      {/* contenido scrolleable */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-clip">
        {tab === 'inicio' && <Inicio onRegistrar={() => setShowReg(true)} />}
        {tab === 'diario' && <Diario />}
        {tab === 'protocolo' && <Progreso />}
        {(tab === 'vida' || tab === 'comida' || tab === 'semana') && <Placeholder name={PLACEHOLDER[tab] ?? 'Inicio'} />}
      </div>

      <FloatingNav active={tab} onTab={(t) => dispatch({ t: 'tab', tab: t })} onFab={() => setShowReg(true)} />

      {/* Hoja de captura universal */}
      <RegistrarSheet open={showReg} onClose={() => setShowReg(false)} />
    </div>
  )
}

export function AppV2() {
  return (
    <AppProviderV2>
      <Shell />
    </AppProviderV2>
  )
}
