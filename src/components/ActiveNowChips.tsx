// ActiveNowChips — surfacing en Inicio de los péptidos con presencia estimada AHORA.
// Tap → expande a mini-tarjeta educativa con nota del producto + countdown de washout (item 151).
// Segundo tap o botón Ver curva → Progreso › Cuerpo.
// (UX/UI del equipo multiagente — Loop 02.)
// Loop 149: barra de washout con tiempo restante real
// Loop 150: pulso del dot proporcional al % de presencia
// Item 151: chip expandido con nota educativa + washout countdown
// n=486: tooltip flotante con mini-curva de decaimiento (6h) al long-press (o tap si chip único)
import { useState, useEffect, useRef, useId, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useApp } from '../lib/store'
import { presenceNow, PRESENCE_FLOOR_PCT, HALF_LIFE_H, washoutMs, getProductNote, buildPharmaSeries } from '../lib/pharma'
import { spring, staggerParent, staggerItem, dur, ease } from '../lib/motion'
import { vialDaysLeft, vialExpiryStatus } from '../lib/calc'
import { VIAL_SHELF_DAYS, DEFAULT_SHELF_DAYS } from '../lib/catalog'

// Iconos SVG locales (reemplazan los caracteres '▾' y '≋' — la rúbrica exige iconos SVG, no glifos de texto)
const ChevronDown = ({ size = 12, color = 'var(--ink-400)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
)
const WaveIcon = ({ size = 12, color = 'var(--ink-400)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden="true">
    <path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  </svg>
)

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

// n=486: mini-curva SVG de decaimiento para las próximas N horas
function DecayCurve({
  product,
  state,
  now,
  hours = 6,
  color,
}: {
  product: string
  state: ReturnType<typeof useApp>['state']
  now: number
  hours?: number
  color: string
}) {
  const W = 200
  const H = 56
  const PAD = 6
  const windowMs = hours * 3_600_000

  // Construir curva usando buildPharmaSeries mirando hacia adelante (memoizado: es caro)
  const pharma = useMemo(
    () => buildPharmaSeries(state, { now: now + windowMs / 2, windowMs: windowMs / 2, mode: 'percent' }),
    [state, now, windowMs],
  )
  const serie = pharma.series.find((s) => s.product === product)

  if (!serie || serie.points.length < 2) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="var(--ink-300)">Sin datos</text>
      </svg>
    )
  }

  // Filtrar solo puntos desde ahora hasta ahora+hours
  const pts = serie.points.filter(([t]) => t >= now && t <= now + windowMs)
  if (pts.length < 2) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="var(--ink-300)">Sin decaimiento</text>
      </svg>
    )
  }

  const maxY = Math.max(...pts.map(([, y]) => y as number), 1)

  function toX(t: number) {
    return PAD + ((t - now) / windowMs) * (W - PAD * 2)
  }
  function toY(y: number) {
    return (H - PAD) - ((y as number) / maxY) * (H - PAD * 2)
  }

  const d = pts
    .map(([t, y], i) => `${i === 0 ? 'M' : 'L'} ${toX(t).toFixed(1)} ${toY(y as number).toFixed(1)}`)
    .join(' ')

  // área bajo la curva
  const area = `${d} L ${toX(pts[pts.length - 1][0]).toFixed(1)} ${H - PAD} L ${toX(pts[0][0]).toFixed(1)} ${H - PAD} Z`

  // etiquetas de tiempo en eje X
  const labels = [0, hours / 2, hours].map((h) => ({
    x: toX(now + h * 3_600_000),
    label: h === 0 ? 'Ahora' : `+${h}h`,
  }))

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} style={{ display: 'block' }}>
      {/* área */}
      <path d={area} fill={color} fillOpacity={0.12} />
      {/* línea */}
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* etiquetas */}
      {labels.map(({ x, label }) => (
        <text key={label} x={x} y={H + 12} textAnchor="middle" fontSize={9} fill="var(--ink-400)">
          {label}
        </text>
      ))}
    </svg>
  )
}

// n=486: popover flotante con mini-curva
function DecayTooltip({
  product,
  state,
  now,
  color,
  anchorEl,
  onClose,
}: {
  product: string
  state: ReturnType<typeof useApp>['state']
  now: number
  color: string
  anchorEl: HTMLElement | null
  onClose: () => void
}) {
  const id = useId()

  // Cerrar al tap fuera
  useEffect(() => {
    const h = (e: PointerEvent) => {
      const target = e.target as Node
      if (anchorEl && !anchorEl.contains(target)) onClose()
    }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [anchorEl, onClose])

  return (
    <motion.div
      role="tooltip"
      id={id}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'var(--card, var(--surface))',
        border: `1px solid ${color}`,
        borderRadius: 'var(--r-md)',
        padding: '10px 12px',
        boxShadow: 'var(--e3, var(--e2))',
        minWidth: 200,
        // clamp al viewport: nunca rebasa los márgenes laterales aunque el chip esté cerca del borde
        maxWidth: 'min(240px, calc(100vw - 32px))',
        boxSizing: 'border-box',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* triángulo señalador */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -7,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 12,
          height: 7,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            background: 'var(--card, var(--surface))',
            border: `1px solid ${color}`,
            transform: 'rotate(45deg)',
            marginTop: -6,
            marginLeft: 1,
          }}
        />
      </div>
      <p className="sm" style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--ink-900)' }}>
        Decaimiento · próx. 6 h
      </p>
      <DecayCurve product={product} state={state} now={now} hours={6} color={color} />
      <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--ink-300)', lineHeight: 1.4 }}>
        Estimación educativa. No es consejo médico.
      </p>
    </motion.div>
  )
}

export function ActiveNowChips() {
  const { state, dispatch } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const prefersReduced = useReducedMotion()

  // item 151: producto expandido (null = ninguno)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  // n=486: producto con tooltip de decaimiento visible
  const [tooltipProduct, setTooltipProduct] = useState<string | null>(null)
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const longPressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // limpia timers de long-press pendientes al desmontar (evita setState tras unmount)
  useEffect(() => () => {
    const timers = longPressTimers.current
    Object.values(timers).forEach((t) => clearTimeout(t))
  }, [])

  // presencia ≥ piso (% del pico) para no listar trazas irrelevantes; máximo 4 chips (memoizado)
  const active = useMemo(
    () => presenceNow(state, now).filter((p) => p.pct >= PRESENCE_FLOOR_PCT).slice(0, 4),
    [state, now],
  )
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

  // n=486: tap único muestra tooltip si hay un solo chip activo; long-press siempre
  const singleChip = active.length === 1

  function startLongPress(product: string) {
    longPressTimers.current[product] = setTimeout(() => {
      setTooltipProduct((prev) => (prev === product ? null : product))
    }, 350)
  }

  function cancelLongPress(product: string) {
    if (longPressTimers.current[product]) {
      clearTimeout(longPressTimers.current[product])
      delete longPressTimers.current[product]
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

          // item 151: estado expandido
          const isExpanded = expandedProduct === p.product
          const productNote = getProductNote(p.product)

          // n=486: tooltip visible
          const isTooltipOpen = tooltipProduct === p.product

          return (
            <motion.div
              key={p.product}
              variants={staggerItem}
              layout
              ref={(el) => { chipRefs.current[p.product] = el as HTMLDivElement | null }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 5,
                padding: '7px 12px 8px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--brand-100)',
                border: `1px solid ${p.color}`,
                minWidth: isExpanded ? '100%' : undefined,
                boxSizing: 'border-box',
                transition: `box-shadow ${dur.fast}s`,
                boxShadow: isExpanded ? 'var(--e2)' : undefined,
                position: 'relative',
              }}
            >
              {/* n=486: tooltip de decaimiento */}
              <AnimatePresence>
                {isTooltipOpen && (
                  <DecayTooltip
                    product={p.product}
                    state={state}
                    now={now}
                    color={p.color}
                    anchorEl={chipRefs.current[p.product] ?? null}
                    onClose={() => setTooltipProduct(null)}
                  />
                )}
              </AnimatePresence>

              {/* Cara del chip = botón toggle + long-press para tooltip */}
              <button
                type="button"
                onClick={() => {
                  // n=486: si chip único, tap alterna tooltip; si múltiples, tap expande
                  if (singleChip) {
                    setTooltipProduct((prev) => (prev === p.product ? null : p.product))
                  } else {
                    setExpandedProduct(isExpanded ? null : p.product)
                  }
                }}
                onPointerDown={() => startLongPress(p.product)}
                onPointerUp={() => cancelLongPress(p.product)}
                onPointerLeave={() => cancelLongPress(p.product)}
                onContextMenu={(e) => e.preventDefault()}
                aria-expanded={isExpanded}
                aria-label={`${p.product}: ${Math.round(p.pct)}% de presencia estimada.${isExpanded ? ' Contraer.' : ' Expandir para nota educativa.'}`}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, width: '100%', boxSizing: 'border-box' }}
              >
              {/* Fila superior: dot + nombre + % */}
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%' }}>
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
                <span className="sm" style={{ color: 'var(--brand-900)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product}</span>
                <span className="sm mono" style={{ color: 'var(--brand-900)', fontWeight: 600, flexShrink: 0 }}>~{Math.round(p.pct)}%</span>
                {/* chevron de expansión (solo en multi-chip) */}
                {!singleChip && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: dur.fast }}
                    aria-hidden="true"
                    style={{ marginLeft: 'auto', display: 'inline-flex', flexShrink: 0 }}
                  >
                    <ChevronDown size={12} />
                  </motion.span>
                )}
                {/* icono de curva si chip único */}
                {singleChip && (
                  <span aria-hidden style={{ marginLeft: 'auto', display: 'inline-flex', flexShrink: 0 }}>
                    <WaveIcon size={13} />
                  </span>
                )}
              </span>

              {/* Loop 149: barra de washout — en colapsado solo para chip único (sin expansión);
                  en multi-chip se muestra dentro del panel expandido para bajar densidad */}
              {fillPct != null && singleChip && (
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

              {/* Loop 167: badge de caducidad del vial — visible en colapsado solo para chip único
                  (sin panel expandido); en multi-chip vive en el panel expandido */}
              {showExpiryBadge && singleChip && (
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
              </button>

              {/* item 151: mini-tarjeta expandida con nota educativa + countdown washout */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    key="expanded"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: dur.base, ease: ease.decelerate }}
                    style={{ overflow: 'hidden', width: '100%' }}
                    onClick={(e) => e.stopPropagation()} // evitar toggle al hacer tap en la tarjeta expandida
                  >
                    <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Loop 149: barra de washout (movida al segundo nivel para aligerar el chip colapsado) */}
                      {fillPct != null && (
                        <span
                          style={{ display: 'block', width: '100%', height: 4, borderRadius: 999, background: 'var(--ink-200)', overflow: 'hidden' }}
                          title={washoutLabel}
                        >
                          <span
                            style={{
                              display: 'block', height: '100%', borderRadius: 999,
                              width: `${fillPct}%`,
                              background: isLow ? 'var(--warning)' : p.color,
                            }}
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
                            alignSelf: 'flex-start',
                          }}
                        >
                          <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 999, background: expiryColor, display: 'block', flexShrink: 0 }} />
                          {expiryLabel}
                        </span>
                      )}

                      {/* Nota educativa PK */}
                      <p
                        className="sm"
                        style={{ margin: 0, color: 'var(--ink-700)', lineHeight: 1.5 }}
                        aria-label={`Nota educativa sobre ${p.product}`}
                      >
                        {productNote}
                      </p>

                      {/* Countdown de washout */}
                      {remaining != null && (
                        <p className="sm mono" style={{ margin: 0, color: 'var(--ink-400)' }}>
                          Washout estimado: <strong style={{ color: isLow ? 'var(--warning)' : 'var(--ink-700)' }}>{fmtDuration(remaining)}</strong>
                        </p>
                      )}

                      {/* Disclaimer compliance — educativo, nunca prescriptivo */}
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-300)', lineHeight: 1.4 }}>
                        Estimación educativa basada en vidas medias aproximadas. No es consejo médico.
                      </p>

                      {/* Botón Ver curva */}
                      <button
                        type="button"
                        className="btn"
                        style={{ marginTop: 4, height: 36, background: 'var(--brand-100)', color: 'var(--brand-700)', border: `1px solid ${p.color}`, fontWeight: 600, fontSize: 13 }}
                        onClick={(e) => { e.stopPropagation(); goToCuerpo() }}
                        aria-label={`Ver curva de ${p.product} en Cuerpo`}
                      >
                        Ver curva completa →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
