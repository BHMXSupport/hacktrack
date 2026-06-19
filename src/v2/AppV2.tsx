import { useState } from 'react'
import { Settings, Hammer } from 'lucide-react'
import { AppProviderV2 } from './lib/provider'
import { useApp } from '../lib/store'
import type { TabId } from '../lib/store'
import { FloatingNav } from './ui/FloatingNav'
import { Inicio } from './screens/Inicio'

const PLACEHOLDER: Record<string, string> = {
  diario: 'Diario',
  protocolo: 'Progreso',
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
        {tab === 'inicio' ? <Inicio onRegistrar={() => setShowReg(true)} /> : <Placeholder name={PLACEHOLDER[tab] ?? 'Inicio'} />}
      </div>

      <FloatingNav active={tab} onTab={(t) => dispatch({ t: 'tab', tab: t })} onFab={() => setShowReg(true)} />

      {/* Registrar — placeholder hasta Stage 4 */}
      {showReg && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setShowReg(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" />
          <div
            className="glass relative w-full rounded-t-[24px] p-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20" />
            <h2 className="text-[18px] font-bold text-foreground">Registrar dosis</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">La hoja de captura completa llega en la siguiente etapa.</p>
          </div>
        </div>
      )}
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
