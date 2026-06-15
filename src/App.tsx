import { useReducer, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppContext, reducer, initialState, useApp } from './lib/store'
import { Splash } from './screens/Splash'
import { Onboarding } from './screens/Onboarding'
import { Goal } from './screens/Goal'
import { Account } from './screens/Account'
import { Import } from './screens/Import'
import { Home } from './screens/Home'
import { Diario } from './screens/Diario'
import { Protocolo } from './screens/Protocolo'
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

const fade = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -18 },
}

function Toast() {
  const { state, dispatch } = useApp()
  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ t: 'toast', msg: null }), 2400)
    return () => clearTimeout(t)
  }, [state.toast, dispatch])
  return (
    <AnimatePresence>
      {state.toast && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          style={{
            position: 'absolute', left: 18, right: 18, bottom: 96, zIndex: 60,
            background: 'var(--ink-900)', color: '#fff', borderRadius: 14, padding: '13px 16px',
            fontSize: 14, fontWeight: 600, textAlign: 'center', boxShadow: 'var(--e3)',
          }}
        >
          {state.toast}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const SHEETS = {
  registrar: RegistrarSheet,
  calc: CalcSheet,
  medida: MedidaSheet,
  arco: ArcoSheet,
  'confirm-delete': ConfirmDeleteSheet,
  'protocolo-edit': ProtocoloEdit,
} as const

function SheetHost() {
  const { state } = useApp()
  const id = state.sheet
  const Comp = id && id in SHEETS ? SHEETS[id as keyof typeof SHEETS] : null
  return <AnimatePresence>{Comp && <Comp key={id} />}</AnimatePresence>
}

const TAB_SCREENS = { inicio: Home, diario: Diario, protocolo: Protocolo, ajustes: Ajustes }

function AppShell() {
  const { state } = useApp()
  // modales full-screen montados sobre el shell
  const FullModal = state.sheet === 'perfil' ? Perfil : state.sheet === 'paywall' ? Paywall : null
  const Tab = TAB_SCREENS[state.tab]
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={state.tab} variants={fade} initial="initial" animate="animate" exit="exit"
          transition={{ duration: 0.24 }} style={{ position: 'absolute', inset: 0 }}>
          <Tab />
        </motion.div>
      </AnimatePresence>
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
    's-account': Account,
    's-import': Import,
  }
  const Flow = FLOW[screen]
  return (
    <AnimatePresence mode="wait">
      <motion.div key={screen} variants={fade} initial="initial" animate="animate" exit="exit"
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }} style={{ position: 'absolute', inset: 0 }}>
        {screen === 's-app' ? <AppShell /> : Flow ? <Flow /> : <Splash />}
      </motion.div>
    </AnimatePresence>
  )
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="app-root">
        <div className="phone">
          <Root />
        </div>
      </div>
    </AppContext.Provider>
  )
}
