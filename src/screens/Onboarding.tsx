import { Player } from '@remotion/player'
import { motion } from 'framer-motion'
import { Hero } from '../remotion/Hero'
import { useApp } from '../lib/store'

/** Onboarding con el hero animado de Remotion embebido (Remotion Player) + copy con Motion. */
export function Onboarding() {
  const { dispatch } = useApp()
  const onDone = () => dispatch({ t: 'go', screen: 's-goal' })
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'hidden', borderRadius: '0 0 28px 28px' }}>
        <Player
          component={Hero}
          durationInFrames={90}
          compositionWidth={1080}
          compositionHeight={1080}
          fps={30}
          autoPlay
          loop
          controls={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ padding: '22px 18px calc(22px + env(safe-area-inset-bottom))' }}>
        <div className="display-l" style={{ margin: '0 0 8px' }}>No vuelvas a fallar tu dosis</div>
        <div className="body" style={{ marginBottom: 18 }}>Recordatorios a tu ritmo y un registro de un toque. Tu progreso, claro y tuyo.</div>
        <button className="btn btn-ember" onClick={onDone}>Crear cuenta</button>
        <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={() => dispatch({ t: 'go', screen: 's-login' })}>Ya tengo cuenta</button>
      </motion.div>
    </div>
  )
}
