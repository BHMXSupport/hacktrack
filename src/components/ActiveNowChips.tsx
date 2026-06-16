// ActiveNowChips — surfacing en Inicio de los péptidos con presencia estimada AHORA.
// Tap → abre Progreso › Cuerpo (deep-link). Estimación educativa (ver disclaimer en Cuerpo).
// (UX/UI del equipo multiagente — Loop 02.)
// Loop 149: barra de washout con tiempo restante real
// Loop 150: pulso del dot proporcional al % de presencia
import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../lib/store'
import { presenceNow, PRESENCE_FLOOR_PCT, HALF_LIFE_H, washoutMs } from '../lib/pharma'
import { spring, staggerParent, staggerItem } from '../lib/motion'
import { vialDaysLeft, vialExpiryStatus } from '../lib/calc'
import { VIAL_SHELF_DAYS, DEFAULT_SHELF_DAYS } from '../lib/catalog'

// tiempo hasta washout práctico (~4.32×t½) para un producto dado
function timeToWashoutMs(product: string, now: number, lastDoseTs: number | undefined): number | null {
  const halfH = HALF_LIFE_H[product]
  if (halfH == null || lastDoseTs == null) return null
  const washoutAt = lastDoseTs + washoutMs(halfH)
  return Math.max(0, washoutAt - now)
}

function fmtDuration(ms: number): string {
  const h = Math.round(ms / 3_600_000)
  if (h < 1) return '<1 h'
  if (h < 48) return `~${h} h`
  return `~${Math.round(h / 24)} d`
}

export function ActiveNowChips() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const prefersReduced = useReducedMotion()

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

  // última dosis por producto (para washout bar)
  const lastDoseTs: Record<string, number> = {}
  for (const g of state.log) {
    for (const it of g.items) {
      if (it.type === 'dose' && it.product) {
        if (lastDoseTs[it.product] == null || it.ts > lastDoseTs[it.product]) {
          lastDoseTs[it.product] = it.ts
        }
      }
    }
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
        {active.map((p) => {
          // Loop 149: barra de washout
          const remaining = timeToWashoutMs(p.product, now, lastDoseTs[p.product])
          const halfH = HALF_LIFE_H[p.product]
          const totalMs = halfH != null ? washoutMs(halfH) : null
          const fillPct = (remaining != null && totalMs != null && totalMs > 0)
            ? Math.max(0, Math.min(100, (remaining / totalMs) * 100))
            : null
          const isLow = fillPct != null && fillPct < 20
          const washoutLabel = remaining != null
            ? `${p.product}: ${fmtDuration(remaining)} para washout`
            : undefined

          // Loop 167: caducidad del vial reconstituido
          const recon = state.productRecon?.[p.product]
          const reconDate = recon?.reconDate
          const shelfDays = VIAL_SHELF_DAYS[p.product] ?? DEFAULT_SHELF_DAYS
          const daysLeft = reconDate != null ? vialDaysLeft(reconDate, shelfDays) : null
          const expiryStatus = daysLeft != null ? vialExpiryStatus(daysLeft) : null
          // Solo badge si 'soon' (≤3 días) o 'expired'
          const showExpiryBadge = expiryStatus === 'soon' || expiryStatus === 'expired'
          const expiryColor = expiryStatus === 'expired' ? 'var(--error)' : 'var(--warning)'
          const expiryBg = expiryStatus === 'expired'
            ? 'color-mix(in srgb, var(--error) 12%, transparent)'
            : 'color-mix(in srgb, var(--warning) 14%, transparent)'
          const expiryLabel = expiryStatus === 'expired'
            ? 'Vial caducado'
            : daysLeft === 0
            ? 'Vial: caduca hoy'
            : `Vial: ${daysLeft} d`

          // Loop 150: amplitud del pulso proporcional al pct; suprimido si pct ≤ 20
          const pulseAmplitude = p.pct > 20 ? 1 + (p.pct / 100) * 0.18 : 1
          const dotAnimate = (!prefersReduced && p.pct > 20)
            ? { scale: [1, pulseAmplitude, 1] as number[] }
            : { scale: 1 as number }
          const dotTransition = (!prefersReduced && p.pct > 20)
            ? { repeat: Infinity, repeatDelay: 1.4, duration: 0.5, ease: 'easeInOut' as const }
            : undefined

          return (
            <motion.button
              key={p.product}
              type="button"
              onClick={goToCuerpo}
              variants={staggerItem}
              whileTap={{ scale: 0.94 }}
              aria-label={`${p.product}: ${Math.round(p.pct)}% de presencia estimada.${washoutLabel ? ` ${washoutLabel}.` : ''} Ver curva de presencia en Cuerpo.`}
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 5,
                minHeight: 40,
                padding: '7px 12px 8px',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                background: 'var(--brand-100)',
                border: `1px solid ${p.color}`,
              }}
            >
              {/* Fila superior: dot + nombre + % */}
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {/* Loop 150: dot con pulso */}
                <motion.span
                  animate={dotAnimate}
                  transition={dotTransition}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: p.color,
                    flexShrink: 0,
                    display: 'block',
                  }}
                />
                <span className="sm" style={{ color: 'var(--brand-900)', fontWeight: 500 }}>{p.product}</span>
                <span className="sm mono" style={{ color: 'var(--brand-900)', fontWeight: 600 }}>~{Math.round(p.pct)}%</span>
              </span>

              {/* Loop 149: barra de washout */}
              {fillPct != null && (
                <span
                  style={{ display: 'block', width: '100%', height: 3, borderRadius: 999, background: 'var(--ink-200)', overflow: 'hidden' }}
                  title={washoutLabel}
                >
                  <motion.span
                    style={{ display: 'block', height: '100%', borderRadius: 999 }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${fillPct}%`,
                      background: isLow ? 'var(--warning)' : p.color,
                    }}
                    transition={spring.ui}
                  />
                </span>
              )}

              {/* Loop 167: badge de caducidad del vial — solo si ≤3 días o caducado */}
              {showExpiryBadge && (
                <span
                  aria-label={expiryStatus === 'expired' ? 'Vial caducado — guía de manejo' : `Vial próximo a caducar: ${daysLeft} días — guía de manejo`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: expiryBg,
                    border: `1px solid ${expiryColor}`,
                    color: expiryColor,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1.4,
                  }}
                >
                  <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 999, background: expiryColor, display: 'block', flexShrink: 0 }} />
                  {expiryLabel}
                </span>
              )}
            </motion.button>
          )
        })}
      </motion.div>
    </section>
  )
}
