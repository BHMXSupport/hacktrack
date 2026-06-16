// LastDoseLine — "Última toma" en Inicio: previene la duda "¿ya me la apliqué? ¿cuándo? ¿cuánto?".
// Solo lectura, del propio diario. (UX/UI del equipo multiagente — Loop 04.)
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../lib/store'
import { staggerItem } from '../lib/motion'

function fmtAgo(ts: number, now: number): string {
  const min = Math.floor((now - ts) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export function LastDoseLine() {
  const { state } = useApp()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // última dosis YA aplicada (mayor ts ≤ ahora) — ignora dosis con hora futura (quick-log a hora del recordatorio)
  let last: { u: string; ts: number } | null = null
  for (const g of state.log) {
    for (const it of g.items) {
      if (it.type === 'dose' && it.ts <= now && (last == null || it.ts > last.ts)) last = { u: it.u, ts: it.ts }
    }
  }
  if (!last) return null

  const ago = fmtAgo(last.ts, now)

  return (
    <motion.div
      variants={staggerItem}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'var(--ink-100)', boxShadow: 'var(--e1)' }}
    >
      <p
        role="status"
        aria-label={`Última toma: ${last.u}, ${ago}`}
        style={{ display: 'contents' }}
      >
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ink-300)', flexShrink: 0 }} />
        <span aria-hidden="true" className="sm" style={{ color: 'var(--ink-400)' }}>Última toma:</span>
        <span aria-hidden="true" className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{last.u}</span>
        <span aria-hidden="true" className="sm mono" style={{ color: 'var(--ink-400)', marginLeft: 'auto' }}>{ago}</span>
      </p>
    </motion.div>
  )
}
