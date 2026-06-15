import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { PEPTIDES } from '../lib/catalog'
import { rhythmLabel } from '../lib/cadence'
import { Segmented, Disclaimer } from '../components/controls'
import { DoseCalendar } from '../components/DoseCalendar'
import { ProgressDashboard } from '../components/ProgressDashboard'
import { BiohackmxFlask } from '../components/BiohackmxFlask'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

export function Progreso() {
  const { state, dispatch } = useApp()
  const [view, setView] = useState<'cal' | 'avances'>('cal')

  const protocol = state.protocol

  return (
    <div className="scroll has-nav">
      <motion.div variants={stagger} initial="initial" animate="animate">
        <motion.div variants={item}>
          <h1 className="h1" style={{ marginBottom: 12 }}>Progreso</h1>
        </motion.div>

        <motion.div variants={item} style={{ marginBottom: 16 }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'cal', label: 'Calendario' },
              { value: 'avances', label: 'Avances' },
            ]}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {view === 'cal' ? (
            <motion.div
              key="cal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <DoseCalendar />

              {protocol ? (
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="body" style={{ fontWeight: 600, marginBottom: 4 }}>
                    {protocol.product}
                  </div>
                  <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 12 }}>
                    {PEPTIDES[protocol.product]
                      ? rhythmLabel(PEPTIDES[protocol.product])
                      : '—'}
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      dispatch({ t: 'sheet', sheet: 'protocolo-edit' })
                    }
                  >
                    Editar protocolo
                  </button>
                </div>
              ) : (
                <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
                  <div className="body" style={{ marginBottom: 8 }}>
                    Aún no tienes un protocolo
                  </div>
                  <button
                    className="btn btn-brand"
                    style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}
                    onClick={() => dispatch({ t: 'go', screen: 's-import' })}
                  >
                    <BiohackmxFlask size={18} />
                    Importar de BiohackMX
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="avances"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <ProgressDashboard />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={item} style={{ marginTop: 8 }}>
          <Disclaimer kind="proto" />
        </motion.div>
      </motion.div>
    </div>
  )
}
