// Hacktrack — CalendarMonth: grilla mensual con estados, fases, adherencia semanal y stagger.
// Loop 171: whileTap por celda + check 'pop' en días tomados (spring.celebrate)
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useApp, isoKey } from '../lib/store'
import { monthMatrix } from '../lib/cadence'
import { dayStatus, dayProducts, phaseForDate, weekAdherencePct } from '../lib/calendar'
import { CATEGORY_COLOR, PEPTIDES, WDS } from '../lib/catalog'
import { IcCheck } from './icons'
import { dur, ease, spring } from '../lib/motion'

// ── Helpers ──────────────────────────────────────────────────────────────────

// brand tint por índice de fase (alterna entre menta y neutro en opacidades muy bajas)
const PHASE_TINTS = ['rgba(94,234,212,0.06)', 'rgba(94,234,212,0.12)', 'rgba(94,234,212,0.07)', 'rgba(94,234,212,0.11)']
function phaseTint(idx: number): string {
  return PHASE_TINTS[idx % PHASE_TINTS.length]
}

// color de categoría del producto; fallback neutro
function productColor(product: string): string {
  const cat = PEPTIDES[product]?.cat
  return cat ? (CATEGORY_COLOR[cat] ?? 'var(--ink-400)') : 'var(--ink-400)'
}

// ── Variantes de animación ───────────────────────────────────────────────────
const cellVariants = {
  initial: { opacity: 0, y: 6 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: dur.base, ease: ease.decelerate, delay: i * 0.018 },
  }),
}

// ── Subcomponente: celda de día ───────────────────────────────────────────────
interface DayCellProps {
  d: Date
  now: Date
  state: import('../lib/store').AppState
  dispatch: (a: import('../lib/store').Action) => void
  hidden: Set<string>
  cellIndex: number
}

function DayCell({ d, now, state, dispatch, hidden, cellIndex }: DayCellProps) {
  const status = dayStatus(state, d, now)
  const phase = phaseForDate(state, d)

  // productos visibles (excluye los ocultos por el filtro)
  const allProds = dayProducts(state, d)
  const visibleProds = allProds.filter((p) => !hidden.has(p))

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  const dayNum = d.getDate()

  // fondo de fase: tinte muy sutil si hay una fase activa
  const bg = phase !== null ? phaseTint(phase) : undefined

  const handleClick = () => {
    dispatch({ t: 'sheet', sheet: 'day-detail', arg: isoKey(d.getTime()) })
  }

  // ── renderizado del interior según estado ───────────────────────────────────
  let inner: React.ReactNode

  if (status === 'taken') {
    // círculo relleno success con IcCheck blanco centrado
    // Loop 171: el círculo entra con scale 0→1 spring.celebrate (rebote al renderizar)
    inner = (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1, transition: spring.celebrate }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--success)',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <IcCheck size={15} />
      </motion.span>
    )
  } else if (status === 'missed') {
    // círculo con borde ámbar, número ámbar
    inner = (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1.5px solid var(--warning)',
          color: 'var(--warning)',
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {dayNum}
      </span>
    )
  } else if (status === 'scheduled') {
    // número con puntos de color de categoría debajo (hasta 3 + "+N")
    const dots = visibleProds.slice(0, 3)
    const extra = visibleProds.length > 3 ? visibleProds.length - 3 : 0
    inner = (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)', lineHeight: 1 }}>
          {dayNum}
        </span>
        {visibleProds.length > 0 && (
          <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {dots.map((p) => (
              <span
                key={p}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: productColor(p),
                  flexShrink: 0,
                }}
              />
            ))}
            {extra > 0 && (
              <span style={{ fontSize: 9, color: 'var(--ink-400)', lineHeight: 1, marginLeft: 1 }}>
                +{extra}
              </span>
            )}
          </span>
        )}
      </span>
    )
  } else {
    // none: solo el número tenue
    inner = (
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-400)', lineHeight: 1 }}>
        {dayNum}
      </span>
    )
  }

  return (
    <motion.button
      custom={cellIndex}
      variants={cellVariants}
      initial="initial"
      animate="animate"
      // Loop 171: whileTap con spring.ui para feedback táctil inmediato
      whileTap={{ scale: 0.88, transition: spring.ui }}
      onClick={handleClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 0,
        padding: '4px 0',
        border: isToday ? '1.5px solid var(--brand-700)' : '1.5px solid transparent',
        borderRadius: 8,
        background: bg ?? 'transparent',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        // ensure full column width in grid
        width: '100%',
      }}
      aria-label={`${dayNum} — ${status}`}
    >
      {inner}
    </motion.button>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export function CalendarMonth({
  year,
  month,
  hidden,
}: {
  year: number
  month: number
  hidden: Set<string>
}) {
  const { state, dispatch } = useApp()
  const now = new Date()
  const weeks = useMemo(() => monthMatrix(year, month), [year, month])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        userSelect: 'none',
      }}
    >
      {/* Cabecera: iniciales de días (L Ma Mi J V S D) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr) auto',
          gap: '0 4px',
          marginBottom: 4,
        }}
      >
        {WDS.map(([label]) => (
          <span
            key={label}
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--ink-400)',
              letterSpacing: '0.03em',
              lineHeight: '24px',
            }}
          >
            {label}
          </span>
        ))}
        {/* columna de adherencia — encabezado vacío */}
        <span style={{ width: 34 }} />
      </div>

      {/* Filas de semanas */}
      {weeks.map((week, wi) => {
        // días reales de la fila (no null) para el cálculo de adherencia
        const realDays = week.filter((d): d is Date => d !== null)
        const adh = weekAdherencePct(state, realDays, now)

        // índice base para el stagger (para que la animación sea progresiva en todo el mes)
        const baseIdx = wi * 7

        return (
          <div
            key={wi}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr) auto',
              gap: '0 4px',
              alignItems: 'center',
            }}
          >
            {week.map((d, di) => {
              if (d === null) {
                return (
                  <span
                    key={`empty-${wi}-${di}`}
                    style={{ minHeight: 44 }}
                    aria-hidden="true"
                  />
                )
              }
              return (
                <DayCell
                  key={isoKey(d.getTime())}
                  d={d}
                  now={now}
                  state={state}
                  dispatch={dispatch}
                  hidden={hidden}
                  cellIndex={baseIdx + di}
                />
              )
            })}

            {/* Indicador de adherencia semanal */}
            <div
              style={{
                width: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingLeft: 4,
              }}
            >
              {adh !== null && (
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: adh >= 80 ? 'var(--success)' : adh >= 50 ? 'var(--warning)' : 'var(--ink-400)',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {adh}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
