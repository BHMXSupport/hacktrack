import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { cadenceLabel } from '../lib/cadence'
import { Segmented, Chip, Disclaimer } from '../components/controls'
import { DoseCalendar } from '../components/DoseCalendar'
import { ProgressDashboard } from '../components/ProgressDashboard'
import { BiohackmxFlask } from '../components/BiohackmxFlask'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

export function Progreso() {
  const { state, dispatch } = useApp()
  const [view, setView] = useState<'cal' | 'avances'>('cal')
  const [pickerOpen, setPickerOpen] = useState(false)
  const protocol = state.protocol

  function pick(product: string) {
    dispatch({ t: 'setProtocol', product })
    dispatch({ t: 'toast', msg: `Protocolo: ${product}` })
    setPickerOpen(false)
  }

  // picker de producto desde el catálogo (la UI que faltaba para cambiar el protocolo)
  const ProductPicker = (
    <AnimatePresence>
      {pickerOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {Object.keys(PEPTIDES).map((name) => (
              <Chip
                key={name}
                label={name}
                color={CATEGORY_COLOR[PEPTIDES[name].cat]}
                active={protocol?.product === name}
                onClick={() => pick(name)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

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
            options={[{ value: 'cal', label: 'Calendario' }, { value: 'avances', label: 'Avances' }]}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {view === 'cal' ? (
            <motion.div key="cal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              <DoseCalendar />

              {protocol ? (
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="body" style={{ fontWeight: 600, marginBottom: 4 }}>{protocol.product}</div>
                  <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 12 }}>
                    {cadenceLabel(protocol.cadence)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-brand btn-sm" style={{ width: 'auto', padding: '0 14px' }} onClick={() => dispatch({ t: 'sheet', sheet: 'protocolo-edit' })}>
                      Editar protocolo
                    </button>
                    <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '0 14px' }} onClick={() => setPickerOpen((v) => !v)}>
                      {pickerOpen ? 'Cerrar' : 'Cambiar producto'}
                    </button>
                  </div>
                  {ProductPicker}
                </div>
              ) : (
                <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
                  <div className="body" style={{ marginBottom: 12 }}>Aún no tienes un protocolo</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <button className="btn btn-brand" style={{ gap: 8 }} onClick={() => dispatch({ t: 'go', screen: 's-import' })}>
                      <BiohackmxFlask size={18} style={{ filter: 'brightness(0) invert(1)' }} />
                      Importar de BiohackMX
                    </button>
                    <button className="btn btn-outline" onClick={() => setPickerOpen((v) => !v)}>
                      {pickerOpen ? 'Cerrar catálogo' : 'Elegir del catálogo'}
                    </button>
                  </div>
                  {ProductPicker}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="avances" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
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
