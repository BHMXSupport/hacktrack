import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, adherence } from '../lib/store'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { cadenceLabel } from '../lib/cadence'
import { dur, ease } from '../lib/motion'
import { Segmented, Chip, Disclaimer } from '../components/controls'
import { DoseCalendar } from '../components/DoseCalendar'
import { ProgressDashboard } from '../components/ProgressDashboard'
import { AdherenceRing } from '../components/AdherenceRing'
import { BiohackmxFlask } from '../components/BiohackmxFlask'
import { IcDrop, IcBack, IcChevron } from '../components/icons'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } }

// ── Barra de adherencia semanal compacta ─────────────────────────────────────
function AdherenceBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ height: 6, background: 'var(--ink-100)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: dur.draw, ease: ease.decelerate }}
        style={{ height: '100%', background: 'var(--brand-700)', borderRadius: 99 }}
      />
    </div>
  )
}

// ── Resumen semanal ───────────────────────────────────────────────────────────
function WeeklySummary() {
  const { state } = useApp()
  const adh = adherence(state, 7)
  if (!adh) return null

  return (
    <motion.div variants={item} className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="sm" style={{ color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Esta semana
        </span>
        <span className="sm" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>
          {adh.pct}%
        </span>
      </div>
      <div className="body" style={{ fontWeight: 600 }}>
        {adh.taken} / {adh.due} dosis cumplidas
      </div>
      <AdherenceBar pct={adh.pct} />
    </motion.div>
  )
}

// ── Fases de titulación ───────────────────────────────────────────────────────
function TitrationPhases() {
  const { state, dispatch } = useApp()
  const protocol = state.protocol
  if (!protocol) return null

  if (!protocol.progOn) {
    const entry = PEPTIDES[protocol.product]
    if (!entry?.phases) return null
    return (
      <motion.div variants={item} className="card" style={{ marginTop: 16 }}>
        <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8 }}>
          Titulación por fases
        </div>
        <div className="body" style={{ color: 'var(--ink-700)', marginBottom: 12 }}>
          Este protocolo tiene {entry.phases} fases disponibles. Actívalas para guiar tu progresión de dosis.
        </div>
        <button
          className="btn btn-outline btn-sm"
          style={{ width: 'auto', padding: '0 14px' }}
          onClick={() => dispatch({ t: 'sheet', sheet: 'protocolo-edit' })}
        >
          Activar titulación por fases
        </button>
      </motion.div>
    )
  }

  const entry = PEPTIDES[protocol.product]
  const n = protocol.progN ?? entry?.phases ?? 2
  const phaseWeeks = entry?.phaseWeeks ?? null
  const cur = protocol.curPhase ?? 0

  return (
    <motion.div variants={item} className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="sm" style={{ color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Titulación por fases
        </span>
        <span className="sm" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
          Fase {cur + 1} de {n}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {Array.from({ length: n }, (_, i) => {
          const dose = protocol.phaseDoses?.[i]
          const weeksPart = phaseWeeks ? ` · sem ${i * phaseWeeks + 1}–${(i + 1) * phaseWeeks}` : ''
          const dosePart = dose != null ? ` · ${dose} mg` : ''
          const label = `Fase ${i + 1}${weeksPart}${dosePart}`
          return (
            <Chip
              key={i}
              label={label}
              active={i === cur}
              color="var(--brand-700)"
              onClick={() => dispatch({ t: 'updateProtocol', patch: { curPhase: i } })}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-outline btn-sm"
          style={{ width: 'auto', padding: '0 12px', gap: 4, display: 'flex', alignItems: 'center' }}
          disabled={cur === 0}
          onClick={() => dispatch({ t: 'updateProtocol', patch: { curPhase: Math.max(0, cur - 1) } })}
        >
          <IcBack size={15} />
          Fase anterior
        </button>
        <button
          className="btn btn-brand btn-sm"
          style={{ width: 'auto', padding: '0 12px', gap: 4, display: 'flex', alignItems: 'center' }}
          disabled={cur >= n - 1}
          onClick={() => dispatch({ t: 'updateProtocol', patch: { curPhase: Math.min(n - 1, cur + 1) } })}
        >
          Siguiente fase
          <IcChevron size={15} />
        </button>
      </div>
    </motion.div>
  )
}

// ── Tarjeta del protocolo ─────────────────────────────────────────────────────
function ProtocolCard({ pickerOpen, setPickerOpen, ProductPicker }: {
  pickerOpen: boolean
  setPickerOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  ProductPicker: React.ReactNode
}) {
  const { state, dispatch } = useApp()
  const protocol = state.protocol

  if (!protocol) {
    return (
      <motion.div variants={item} className="card" style={{ marginTop: 16, textAlign: 'center' }}>
        <div className="body" style={{ marginBottom: 12 }}>Aún no tienes un protocolo</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-brand"
            style={{ gap: 8 }}
            onClick={() => dispatch({ t: 'go', screen: 's-import' })}
          >
            <BiohackmxFlask size={18} style={{ filter: 'brightness(0) invert(1)' }} />
            Importar de BiohackMX
          </button>
          <button className="btn btn-outline" onClick={() => setPickerOpen((v) => !v)}>
            {pickerOpen ? 'Cerrar catálogo' : 'Elegir del catálogo'}
          </button>
        </div>
        {ProductPicker}
      </motion.div>
    )
  }

  const entry = PEPTIDES[protocol.product]
  const accentColor = entry ? CATEGORY_COLOR[entry.cat] : 'var(--brand-700)'

  return (
    <motion.div variants={item} className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="body" style={{ fontWeight: 600 }}>{protocol.product}</div>
          <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>
            {cadenceLabel(protocol.cadence)}
          </div>
        </div>
        {entry && (
          <span
            className="sm"
            style={{
              background: accentColor + '18',
              color: accentColor,
              padding: '2px 10px',
              borderRadius: 99,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              marginLeft: 12,
            }}
          >
            {entry.cat}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          className="btn btn-brand btn-sm"
          style={{ width: 'auto', padding: '0 14px' }}
          onClick={() => dispatch({ t: 'sheet', sheet: 'protocolo-edit' })}
        >
          Editar protocolo
        </button>
        <button
          className="btn btn-outline btn-sm"
          style={{ width: 'auto', padding: '0 14px' }}
          onClick={() => setPickerOpen((v) => !v)}
        >
          {pickerOpen ? 'Cerrar' : 'Cambiar producto'}
        </button>
      </div>
      {ProductPicker}
    </motion.div>
  )
}

// ── Botón de calculadora de reconstitución ────────────────────────────────────
function ReconstitutionButton() {
  const { dispatch } = useApp()
  return (
    <motion.div variants={item} style={{ marginTop: 16 }}>
      <button
        className="btn btn-outline"
        style={{ gap: 10, justifyContent: 'flex-start', textAlign: 'left' }}
        onClick={() => dispatch({ t: 'sheet', sheet: 'calc' })}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--brand-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-700)',
            flexShrink: 0,
          }}
        >
          <IcDrop size={18} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className="body" style={{ fontWeight: 600 }}>Calculadora de reconstitución</span>
          <span className="sm" style={{ color: 'var(--ink-400)' }}>
            Convierte mg a unidades de aplicación
          </span>
        </span>
        <IcChevron size={18} style={{ marginLeft: 'auto', color: 'var(--ink-300)', flexShrink: 0 }} />
      </button>
    </motion.div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────
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

  const ProductPicker = (
    <AnimatePresence>
      {pickerOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
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
            options={[
              { value: 'cal', label: 'Calendario' },
              { value: 'avances', label: 'Avances' },
            ]}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {view === 'cal' ? (
            <motion.div key="cal" {...fade}>
              {/* Calendario de dosis */}
              <DoseCalendar />

              {/* Resumen semanal de adherencia */}
              <WeeklySummary />

              {/* Tarjeta del protocolo activo */}
              <ProtocolCard
                pickerOpen={pickerOpen}
                setPickerOpen={setPickerOpen}
                ProductPicker={ProductPicker}
              />

              {/* Fases de titulación */}
              {protocol && <TitrationPhases />}

              {/* Calculadora de reconstitución — siempre visible */}
              <ReconstitutionButton />
            </motion.div>
          ) : (
            <motion.div key="avances" {...fade}>
              <ProgressDashboard />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={item} style={{ marginTop: 24 }}>
          <Disclaimer kind="proto" />
        </motion.div>
      </motion.div>
    </div>
  )
}
