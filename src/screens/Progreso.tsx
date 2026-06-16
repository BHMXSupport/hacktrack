import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, adherence } from '../lib/store'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { cadenceLabel } from '../lib/cadence'
import { dur, ease, spring, sharedAxisX, staggerParent, staggerItem } from '../lib/motion'
import { Segmented, Chip, Disclaimer } from '../components/controls'
import { DoseCalendar } from '../components/DoseCalendar'
import { ProgressDashboard } from '../components/ProgressDashboard'
import { AdherenceRing } from '../components/AdherenceRing'
import { BiohackmxFlask } from '../components/BiohackmxFlask'
import { IcDrop, IcBack, IcChevron } from '../components/icons'
import { EmptyState } from '../components/EmptyState'

// ── Barra de adherencia semanal compacta, con hitos 25/50/75% ────────────────
function AdherenceBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const fillColor =
    clamped >= 75 ? 'var(--success)' : clamped >= 50 ? 'var(--brand-500)' : 'var(--brand-700)'
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Adherencia semanal"
      style={{ position: 'relative', height: 8, background: 'var(--ink-100)', borderRadius: 99, marginTop: 10 }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.9 }}
        style={{ height: '100%', background: fillColor, borderRadius: 99 }}
      />
      {/* hitos pasivos: marca alcanzada = blanca sobre el fill; no alcanzada = tenue */}
      {[25, 50, 75].map((mk) => (
        <span
          key={mk}
          aria-hidden
          style={{
            position: 'absolute', top: 1, bottom: 1, left: `${mk}%`, width: 2, borderRadius: 2,
            background: clamped >= mk ? 'rgba(255,255,255,0.7)' : 'var(--ink-300)',
            transform: 'translateX(-1px)',
          }}
        />
      ))}
    </div>
  )
}

// ── Resumen semanal ───────────────────────────────────────────────────────────
function WeeklySummary({ onAddProtocol }: { onAddProtocol: () => void }) {
  const { state } = useApp()
  const adh = adherence(state, 7)
  const hasProtocol = Object.keys(state.protocols).length > 0

  if (!adh || !hasProtocol) {
    return (
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16 }}>
        <EmptyState
          glyph="recuperacion"
          title="Sin protocolo activo"
          subtitle="Registra tu primera dosis para ver el resumen semanal aquí."
          cta={{ label: '+ Agregar producto', onClick: onAddProtocol }}
        />
      </motion.div>
    )
  }

  return (
    <motion.div variants={staggerItem} className="card" style={{ marginTop: 16 }}>
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

// ── Fases de titulación (POR PRODUCTO) ────────────────────────────────────────
// Renderiza una tarjeta por cada producto con titulación activa; navegación de fase por producto.
function TitrationPhasesAll() {
  const { state, dispatch } = useApp()
  const withPhases = Object.values(state.protocols).filter((p) => p.progOn)
  if (withPhases.length === 0) return null

  return (
    <>
      {withPhases.map((protocol, idx) => {
        const entry = PEPTIDES[protocol.product]
        const n = protocol.progN ?? entry?.phases ?? 2
        const phaseWeeks = entry?.phaseWeeks ?? null
        const cur = protocol.curPhase ?? 0
        const setPhase = (i: number) =>
          dispatch({ t: 'updateProtocolFor', product: protocol.product, patch: { curPhase: Math.max(0, Math.min(n - 1, i)) } })
        return (
          <motion.div key={protocol.product} variants={staggerItem} className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="sm" style={{ color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Titulación · {protocol.product}
              </span>
              <span className="sm" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
                Fase {cur + 1} de {n}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {Array.from({ length: n }, (_, i) => {
                const weeksPart = phaseWeeks ? ` · sem ${i * phaseWeeks + 1}–${(i + 1) * phaseWeeks}` : ''
                const levelPart = ` · nivel ${i + 1}`
                return (
                  <motion.div key={i} whileTap={{ scale: 0.94 }} transition={spring.ui} style={{ display: 'inline-flex' }}>
                    <Chip
                      label={`Fase ${i + 1}${weeksPart}${levelPart}`}
                      active={i === cur}
                      color="var(--brand-700)"
                      onClick={() => setPhase(i)}
                    />
                  </motion.div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <motion.button
                className="btn btn-outline btn-sm"
                style={{ width: 'auto', padding: '0 12px', gap: 4, display: 'flex', alignItems: 'center' }}
                disabled={cur === 0}
                onClick={() => setPhase(cur - 1)}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
                aria-label={`Fase anterior de ${protocol.product}`}
              >
                <IcBack size={15} />
                Fase anterior
              </motion.button>
              <motion.button
                className="btn btn-brand btn-sm"
                style={{ width: 'auto', padding: '0 12px', gap: 4, display: 'flex', alignItems: 'center' }}
                disabled={cur >= n - 1}
                onClick={() => setPhase(cur + 1)}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
                aria-label={`Siguiente fase de ${protocol.product}`}
              >
                Siguiente fase
                <IcChevron size={15} />
              </motion.button>
            </div>
          </motion.div>
        )
      })}
    </>
  )
}

// ── Lista de productos (cada uno con su protocolo editable + opción de quitar) ──
function ProductsList({ pickerOpen, setPickerOpen, ProductPicker }: {
  pickerOpen: boolean
  setPickerOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  ProductPicker: React.ReactNode
}) {
  const { state, dispatch } = useApp()
  const products = Object.values(state.protocols)

  if (products.length === 0) {
    return (
      <motion.div variants={staggerItem} className="card" style={{ marginTop: 16 }}>
        <EmptyState
          glyph="dose"
          title="Aún no tienes un protocolo"
          subtitle="Agrega tu primer producto para comenzar el seguimiento."
          cta={{ label: 'Elegir del catálogo', onClick: () => setPickerOpen((v) => !v) }}
        />
        {ProductPicker}
      </motion.div>
    )
  }

  return (
    <motion.div variants={staggerItem} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-400)' }}>
          Tus productos
        </span>
        <button
          className="btn btn-outline btn-sm"
          style={{ width: 'auto', padding: '0 12px' }}
          onClick={() => setPickerOpen((v) => !v)}
        >
          {pickerOpen ? 'Cerrar' : '+ Agregar'}
        </button>
      </div>

      {products.map((p) => {
        const entry = PEPTIDES[p.product]
        const accentColor = entry ? CATEGORY_COLOR[entry.cat] : 'var(--brand-700)'
        return (
          <motion.div
            key={p.product}
            className="card"
            style={{ borderLeft: `3px solid ${accentColor}` }}
            whileTap={{ scale: 0.985 }}
            transition={spring.ui}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div className="body" style={{ fontWeight: 600 }}>{p.product}</div>
                <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 2 }}>
                  {cadenceLabel(p.cadence)}
                </div>
              </div>
              {entry && (
                <span
                  className="sm"
                  style={{ background: accentColor + '18', color: accentColor, padding: '2px 10px', borderRadius: 99, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {entry.cat}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <motion.button
                className="btn btn-brand btn-sm"
                style={{ width: 'auto', padding: '0 14px' }}
                onClick={() => {
                  dispatch({ t: 'setActiveProduct', product: p.product })
                  dispatch({ t: 'sheet', sheet: 'protocolo-edit' })
                }}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
              >
                Editar protocolo
              </motion.button>
              <motion.button
                className="btn btn-ghost btn-sm"
                style={{ width: 'auto', padding: '0 12px', marginLeft: 'auto', color: 'var(--error)' }}
                onClick={() => dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: `product:${p.product}` })}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
                aria-label={`Quitar ${p.product}`}
              >
                Quitar
              </motion.button>
            </div>
          </motion.div>
        )
      })}
      {ProductPicker}
    </motion.div>
  )
}

// ── Botón de calculadora de reconstitución ────────────────────────────────────
function ReconstitutionButton() {
  const { dispatch } = useApp()
  return (
    <motion.div variants={staggerItem} style={{ marginTop: 16 }}>
      <motion.button
        className="btn btn-outline"
        style={{ gap: 10, justifyContent: 'flex-start', textAlign: 'left' }}
        onClick={() => dispatch({ t: 'sheet', sheet: 'calc' })}
        whileTap={{ scale: 0.97 }}
        transition={spring.ui}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-sm)',
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
            Convierte unidades de aplicación
          </span>
        </span>
        <IcChevron size={18} style={{ marginLeft: 'auto', color: 'var(--ink-300)', flexShrink: 0 }} />
      </motion.button>
    </motion.div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export function Progreso() {
  const { state, dispatch } = useApp()
  const view = state.progresoView
  const setView = (v: 'cal' | 'avances') => dispatch({ t: 'setProgresoView', view: v })
  const [pickerOpen, setPickerOpen] = useState(false)

  function pick(product: string) {
    // solo-agregar: todos los productos quedan activos a la vez. Para quitar → botón "Quitar" (con confirmación).
    if (state.protocols[product]) {
      dispatch({ t: 'toast', msg: `${product} ya está en seguimiento` })
      return
    }
    dispatch({ t: 'setProtocol', product })
    dispatch({ t: 'toast', msg: `${product} agregado` })
  }

  function openAddProduct() {
    setPickerOpen(true)
  }


  const ProductPicker = (
    <AnimatePresence>
      {pickerOpen && (
        <div style={{ overflow: 'hidden' }}>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: ease.standard }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {Object.keys(PEPTIDES).map((name) => (
                <Chip
                  key={name}
                  label={name}
                  color={CATEGORY_COLOR[PEPTIDES[name].cat]}
                  active={!!state.protocols[name]}
                  onClick={() => pick(name)}
                />
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="scroll has-nav">
      <motion.div variants={staggerParent} initial="initial" animate="animate">
        <motion.div variants={staggerItem}>
          <h1 className="h1" style={{ marginBottom: 12 }}>Progreso</h1>
        </motion.div>

        <motion.div variants={staggerItem} style={{ marginBottom: 16 }}>
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
              role="tabpanel"
              id="panel-cal"
              aria-label="Calendario"
              variants={sharedAxisX}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* Calendario de dosis */}
              <DoseCalendar />

              {/* Resumen semanal de adherencia */}
              <WeeklySummary onAddProtocol={openAddProduct} />

              {/* Lista de productos — cada uno con su protocolo editable */}
              <ProductsList
                pickerOpen={pickerOpen}
                setPickerOpen={setPickerOpen}
                ProductPicker={ProductPicker}
              />

              {/* Fases de titulación — una por cada producto con titulación activa */}
              <TitrationPhasesAll />

              {/* Calculadora de reconstitución — siempre visible */}
              <ReconstitutionButton />
            </motion.div>
          ) : (
            <motion.div
              key="avances"
              role="tabpanel"
              id="panel-avances"
              aria-label="Avances"
              variants={sharedAxisX}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ProgressDashboard />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={staggerItem} style={{ marginTop: 24 }}>
          <Disclaimer kind="proto" />
        </motion.div>
      </motion.div>
    </div>
  )
}
