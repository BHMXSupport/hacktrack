// ActiveNowChips — surfacing en Inicio de los péptidos con presencia estimada AHORA.
// Tap → abre Progreso › Cuerpo (deep-link). Estimación educativa (ver disclaimer en Cuerpo).
// (UX/UI del equipo multiagente — Loop 02.)
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { presenceNow, PRESENCE_FLOOR_PCT } from '../lib/pharma'
import { spring, staggerParent, staggerItem } from '../lib/motion'

export function ActiveNowChips() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // presencia ≥ piso (% del pico) para no listar trazas irrelevantes; máximo 4 chips
  const active = presenceNow(state, now).filter((p) => p.pct >= PRESENCE_FLOOR_PCT).slice(0, 4)
  if (active.length === 0) return null

  const goToCuerpo = () => {
    dispatch({ t: 'tab', tab: 'vida' })
  }

  return (
    <section aria-labelledby="activo-ahora-h">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2
          id="activo-ahora-h"
          className="sm"
          style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)', fontWeight: 700 }}
        >
          Activo ahora
        </h2>
        <button
          type="button"
          onClick={goToCuerpo}
          className="sm"
          aria-label="Ver curva de presencia en Cuerpo"
          style={{ background: 'none', border: 0, color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          Ver curva →
        </button>
      </div>
      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        {active.map((p) => (
          <motion.button
            key={p.product}
            type="button"
            onClick={goToCuerpo}
            variants={staggerItem}
            whileTap={{ scale: 0.94 }}
            aria-label={`${p.product}: ${Math.round(p.pct)}% de presencia estimada. Ver curva de presencia en Cuerpo.`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '6px 12px',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'var(--brand-100)',
              border: `1px solid ${p.color}`,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 999, background: p.color, flexShrink: 0 }} />
            <span className="sm" style={{ color: 'var(--brand-900)', fontWeight: 500 }}>{p.product}</span>
            <span className="sm mono" style={{ color: 'var(--brand-900)', fontWeight: 600 }}>~{Math.round(p.pct)}%</span>
          </motion.button>
        ))}
      </motion.div>
    </section>
  )
}
