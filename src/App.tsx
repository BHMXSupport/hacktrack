import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Splash } from './screens/Splash'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'

export type Screen = 'splash' | 'onboarding' | 'home'

const variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

export function App() {
  const [screen, setScreen] = useState<Screen>('splash')

  useEffect(() => {
    if (screen === 'splash') {
      const t = setTimeout(() => setScreen('onboarding'), 2200)
      return () => clearTimeout(t)
    }
  }, [screen])

  return (
    <div className="app-root">
      <div className="phone">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {screen === 'splash' && <Splash />}
            {screen === 'onboarding' && <Onboarding onDone={() => setScreen('home')} />}
            {screen === 'home' && <Home />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
