// Item 154: tarjeta de estado del ciclo on/off para un producto.
// Muestra "Día X de Y — ON/OFF" con barra de progreso dentro del ciclo.
import { motion, useReducedMotion } from 'framer-motion'
import { cyclePhaseInfo } from '../lib/cadence'
import { dur, ease } from '../lib/motion'
import type { UserProtocol } from '../lib/types'

interface Props {
  protocol: UserProtocol
  today: Date
}

/**
 * CycleStatusCard: visible solo cuando la cadencia del producto es 'ciclo' (on/off).
 * Muestra "Día X de Y — ON" o "— OFF" con barra proporcional y etiqueta compliance.
 */
export function CycleStatusCard({ protocol, today }: Props) {
  const reduce = useReducedMotion() ?? false
  const info = cyclePhaseInfo(protocol.cadence, new Date(protocol.startDate), today)
  if (!info) return null

  const { day, total, phase } = info
  const progress = total > 0 ? day / total : 0
  const isOn = phase === 'on'
  const phaseColor = isOn ? 'var(--success)' : 'var(--ink-300)'
  const phaseLabel = isOn ? 'ON' : 'OFF'
  const on = protocol.cadence.on ?? 1
  const off = protocol.cadence.off ?? 0

  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      aria-label={`Ciclo ${protocol.product}: día ${day} de ${total} — fase ${phaseLabel}`}
    >
      {/* cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <p className="sm" style={{ margin: 0, fontWeight: 600, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {protocol.product}
          </p>
          <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
            Ciclo {on} on / {off} off
          </p>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 999,
            flexShrink: 0,
            background: isOn ? 'color-mix(in srgb, var(--success) 14%, transparent)' : 'var(--ink-100)',
            border: `1px solid ${isOn ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'var(--ink-200)'}`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: phaseColor,
              display: 'block',
            }}
          />
          <span
            className="sm mono"
            style={{ fontWeight: 700, color: phaseColor, letterSpacing: 0.5 }}
          >
            {phaseLabel}
          </span>
        </div>
      </div>

      {/* día X de Y */}
      <p
        className="sm mono"
        style={{ margin: 0, color: 'var(--ink-700)', fontWeight: 600 }}
      >
        Día{' '}
        <span style={{ color: phaseColor }}>{day}</span>
        {' '}de {total}
      </p>

      {/* barra de progreso del ciclo */}
      <div
        role="progressbar"
        aria-valuenow={day}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Día ${day} de ${total} en fase ${phaseLabel}`}
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--ink-100)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ duration: dur.slow, ease: ease.decelerate }}
          style={{
            height: '100%',
            background: phaseColor,
            borderRadius: 999,
            transformOrigin: 'left center',
          }}
        />
      </div>

      {/* disclaimer inline: no es consejo médico */}
      <p className="sm" style={{ margin: 0, color: 'var(--ink-300)', fontSize: 10, lineHeight: 1.4 }}>
        Tus propios datos · no es consejo médico
      </p>
    </div>
  )
}
