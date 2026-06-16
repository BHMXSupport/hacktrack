import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, adherence, isoKey } from '../lib/store'
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
  // Item 159: tooltip state para hitos interactivos
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null)

  const tooltips: Record<number, string> = {
    25: '25% → 1.75 días perfectos esta semana',
    50: '50% → semana perfecta completada',
    75: '75% → objetivo clínico sugerido',
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Adherencia semanal: ${clamped}%${clamped < 75 ? ` — próximo hito: ${clamped < 25 ? 25 : clamped < 50 ? 50 : 75}%` : ' — objetivo clínico alcanzado'}`}
      style={{ position: 'relative', height: 8, background: 'var(--ink-100)', borderRadius: 99, marginTop: 10 }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.9 }}
        style={{ position: 'relative', height: '100%', background: fillColor, borderRadius: 99 }}
      />
      {/* Item 160: indicador visual "✓" dentro de la barra cuando >= 75% */}
      {clamped >= 75 && (
        <span
          aria-hidden
          style={{
            position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)',
            fontSize: 6, fontWeight: 900, color: 'rgba(255,255,255,0.8)', lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          ✓
        </span>
      )}
      {/* Item 159: hitos interactivos con tooltip */}
      {[25, 50, 75].map((mk) => (
        <span key={mk} style={{ position: 'absolute', top: 0, bottom: 0, left: `${mk}%`, transform: 'translateX(-1px)', zIndex: 2 }}>
          <button
            aria-label={`Hito ${mk}%: ${tooltips[mk]}`}
            onClick={() => {
              setActiveTooltip(activeTooltip === mk ? null : mk)
              setTimeout(() => setActiveTooltip(null), 1800)
            }}
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0,
              width: 2, border: 'none', cursor: 'pointer', padding: 0,
              background: clamped >= mk ? 'rgba(255,255,255,0.7)' : 'var(--ink-300)',
              borderRadius: 2,
            }}
          />
          <AnimatePresence>
            {activeTooltip === mk && (
              <motion.div
                key={`tt-${mk}`}
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--ink-900)', color: 'var(--surface)',
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
                  boxShadow: 'var(--e2)',
                }}
              >
                {tooltips[mk]}
              </motion.div>
            )}
          </AnimatePresence>
        </span>
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
      {withPhases.map((protocol) => {
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

            {/* n=144: chips de fase + input de dosis por fase */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              {Array.from({ length: n }, (_, i) => {
                const weeksPart = phaseWeeks ? ` · sem ${i * phaseWeeks + 1}–${(i + 1) * phaseWeeks}` : ''
                const levelPart = ` · nivel ${i + 1}`
                const phaseDose = protocol.phaseDoses?.[i]
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <motion.div whileTap={{ scale: 0.94 }} transition={spring.ui} style={{ display: 'inline-flex' }}>
                      <Chip
                        label={`Fase ${i + 1}${weeksPart}${levelPart}`}
                        active={i === cur}
                        color="var(--brand-700)"
                        onClick={() => setPhase(i)}
                      />
                    </motion.div>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="mg"
                      value={phaseDose ?? ''}
                      aria-label={`Dosis fase ${i + 1} de ${protocol.product}`}
                      style={{ fontSize: 12, width: 72, border: '1px solid var(--ink-200)', borderRadius: 'var(--r-sm)', padding: '3px 6px', background: 'var(--ink-100)', color: 'var(--ink-900)' }}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value)
                        const newDoses: (number | null)[] = Array.from({ length: n }, (_, j) => protocol.phaseDoses?.[j] ?? null)
                        newDoses[i] = val !== null && isNaN(val) ? null : val
                        dispatch({ t: 'updateProtocolFor', product: protocol.product, patch: { phaseDoses: newDoses } })
                      }}
                    />
                    <span className="sm" style={{ color: 'var(--ink-400)', fontSize: 10 }}>
                      Dosis de esta fase (mg)
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="sm" style={{ color: 'var(--ink-400)', margin: '0 0 12px', fontSize: 11 }}>
              Dato personal del usuario — no prescripción médica
            </p>

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

            {/* n=157: deeplink fase → medidas de la categoría */}
            <div style={{ marginTop: 10 }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: 'auto', padding: '0 0', color: 'var(--brand-700)', fontSize: 13 }}
                onClick={() => dispatch({ t: 'setProgresoView', view: 'avances' })}
              >
                Ver medidas de {entry?.cat ?? 'tu protocolo'}
              </button>
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

            {/* n=143: fecha de inicio del protocolo editable (backdating) */}
            <div style={{ marginTop: 8 }}>
              <label className="sm" style={{ color: 'var(--ink-400)', display: 'block', marginBottom: 2 }}>
                Inicio del protocolo
              </label>
              <input
                type="date"
                value={isoKey(p.startDate)}
                style={{ fontSize: 13, border: '1px solid var(--ink-200)', borderRadius: 'var(--r-sm)', padding: '4px 8px', background: 'var(--ink-100)', color: 'var(--ink-900)' }}
                onChange={(e) => {
                  if (!e.target.value) return
                  dispatch({ t: 'updateProtocolFor', product: p.product, patch: { startDate: new Date(e.target.value).getTime() } })
                }}
              />
            </div>

            {/* n=145: Días desde inicio + % de avance del ciclo */}
            {(() => {
              const dayN = Math.floor((state.todayTs - p.startDate) / 86400000) + 1
              const clampedDay = Math.max(1, dayN)
              let phaseLabel = ''
              if (p.progOn && entry?.phases && entry?.phaseWeeks) {
                const totalDays = entry.phases * entry.phaseWeeks * 7
                const pct = Math.min(100, Math.round((clampedDay / totalDays) * 100))
                phaseLabel = ` · Fase ${p.curPhase + 1} · ${pct}%`
              }
              return (
                <div className="sm" style={{ color: 'var(--brand-700)', marginTop: 4, fontWeight: 600 }}>
                  Día {clampedDay} del ciclo{phaseLabel}
                </div>
              )
            })()}

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

      {/* n=155: FAB 'Registrar medida rápida' en Avances */}
      <AnimatePresence>
        {view === 'avances' && (
          <motion.button
            aria-label="Registrar medida rápida"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={spring.ui}
            onClick={() => dispatch({ t: 'sheet', sheet: 'medida' })}
            style={{
              position: 'fixed',
              bottom: 80,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: 99,
              background: 'var(--brand-700)',
              color: 'white',
              border: 'none',
              boxShadow: 'var(--e3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              cursor: 'pointer',
              zIndex: 100,
              lineHeight: 1,
            }}
          >
            <span>+</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
