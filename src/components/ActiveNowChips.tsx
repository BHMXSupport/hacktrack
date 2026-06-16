// ActiveNowChips — surfacing en Inicio de los péptidos con presencia estimada AHORA.
// Tap → abre Progreso › Cuerpo (deep-link). Estimación educativa (ver disclaimer en Cuerpo).
// (UX/UI del equipo multiagente — Loop 02.)
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { presenceNow } from '../lib/pharma'
import { staggerItem } from '../lib/motion'

export function ActiveNowChips() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // presencia ≥1% para no listar trazas irrelevantes; máximo 4 chips
  const active = presenceNow(state, now).filter((p) => p.pct >= 1).slice(0, 4)
  if (active.length === 0) return null

  const goToCuerpo = () => {
    dispatch({ t: 'setProgresoView', view: 'cuerpo' })
    dispatch({ t: 'tab', tab: 'protocolo' })
  }

  return (
    <motion.section variants={staggerItem}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)' }}>Activo ahora</span>
        <button
          type="button"
          onClick={goToCuerpo}
          className="sm"
          style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          Ver curva →
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {active.map((p) => (
          <button
            key={p.product}
            type="button"
            onClick={goToCuerpo}
            aria-label={`${p.product}: ${Math.round(p.pct)}% de presencia estimada. Ver curva.`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '6px 12px',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'var(--border)',
              border: `1px solid ${p.color}`,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 999, background: p.color, flexShrink: 0 }} />
            <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 500 }}>{p.product}</span>
            <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>~{Math.round(p.pct)}%</span>
          </button>
        ))}
      </div>
    </motion.section>
  )
}
