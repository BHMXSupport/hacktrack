// Sub-componentes auto-contenidos extraídos de PharmaDashboard.tsx (split de mantenibilidad).
import { motion } from 'framer-motion'
import { dur, ease } from '../lib/motion'
import { formatHalfLife } from '../lib/pharma'

const H_MS = 3_600_000

// ── Mini SVG histograma de intervalos (sin librería) ──────────────────────────
// item 290: muestra la distribución de intervalos entre dosis consecutivas
export function IntervalHistogram({ intervalsH, targetH, color }: { intervalsH: number[]; targetH?: number; color: string }) {
  if (intervalsH.length === 0) return null
  const W = 120; const H = 36
  const min = Math.min(...intervalsH)
  const max = Math.max(...intervalsH)
  const span = (max - min) || 1
  const bins = 6
  const counts = Array(bins).fill(0)
  for (const v of intervalsH) {
    const b = Math.min(bins - 1, Math.floor(((v - min) / span) * bins))
    counts[b]++
  }
  const maxCount = Math.max(...counts) || 1
  const barW = (W - 4) / bins - 2

  // posición X del target (intervalo objetivo)
  const targetX = targetH != null && targetH >= min && targetH <= max
    ? 2 + ((targetH - min) / span) * (W - 4)
    : null

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {counts.map((c, i) => {
        const bh = (c / maxCount) * (H - 10)
        const bx = 2 + i * (barW + 2)
        return (
          <rect
            key={i}
            x={bx}
            y={H - 10 - bh}
            width={barW}
            height={bh}
            fill={color}
            opacity={0.55}
            rx={1.5}
          />
        )
      })}
      {targetX != null && (
        <>
          <line x1={targetX} y1={4} x2={targetX} y2={H - 10} stroke="var(--ink-400)" strokeWidth={1} strokeDasharray="2 2" />
          <text x={targetX + 2} y={10} fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-400)">obj.</text>
        </>
      )}
      {/* eje X mínimo/máximo */}
      <text x={2} y={H - 1} fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
        {min < 48 ? `${Math.round(min)}h` : `${Math.round(min / 24)}d`}
      </text>
      <text x={W - 2} y={H - 1} textAnchor="end" fontSize={7} fontFamily="JetBrains Mono, monospace" fill="var(--ink-300)">
        {max < 48 ? `${Math.round(max)}h` : `${Math.round(max / 24)}d`}
      </text>
    </svg>
  )
}

// ── Pill "Próxima dosis en ~X h" ─────────────────────────────────────────────
// item 377
export function NextDosePill({ nextTs, now }: { nextTs: number; now: number }) {
  const diffMs = nextTs - now
  if (diffMs < 0) return null
  const diffH = diffMs / H_MS
  let label: string
  if (diffH < 1) label = `~${Math.round(diffH * 60)} min`
  else if (diffH < 48) label = `~${diffH < 1.5 ? '1' : Math.round(diffH)} h`
  else label = `~${Math.round(diffH / 24)} d`

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: dur.fast, ease: ease.standard }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        background: 'var(--brand-100)',
        border: '1px solid var(--brand-300)',
        marginTop: 8,
      }}
    >
      <span style={{ fontSize: 9, color: 'var(--brand-700)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
        Próxima dosis en {label}
      </span>
    </motion.div>
  )
}

// Panel "Análisis avanzado" del PharmaDashboard (Tss / AUC / por-producto / co-presencia) — extraído (split).
type AdvancedMetrics = {
  tssItems: { product: string; color: string; tss: string }[]
  aucEntries: [string, number][]
  perProduct: { product: string; color: string; halfLifeH: number; cv: number | null; cvLabel: { label: string; color: string } | null; intervals: number[]; targetIntervalH?: number; hint: string | null; fi: number | null }[]
  coPres: { productA: string; productB: string; durationH: number }[]
}

export function PharmaAdvancedPanel({ advancedMetrics, series }: { advancedMetrics: AdvancedMetrics; series: { product: string; color: string }[] }) {
  return (
<motion.div
                key="advanced-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: dur.base, ease: ease.standard }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* item 287 — Tss (tiempo a steady-state) */}
                  {advancedMetrics.tssItems.length > 0 && (
                    <div>
                      <div className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Tiempo a steady-state (Tss)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {advancedMetrics.tssItems.map((it) => (
                          <div key={it.product} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: it.color, flexShrink: 0 }} />
                            <span className="sm" style={{ color: 'var(--ink-700)', flex: 1 }}>{it.product}</span>
                            <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>{it.tss}</span>
                          </div>
                        ))}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 6, lineHeight: 1.4, fontSize: 10 }}>
                        Regla estándar: ≈ 5 vidas medias con dosis repetidas a intervalo regular. Estimación educativa.
                      </div>
                    </div>
                  )}

                  {/* item 285 — Ratio AUC inter-producto */}
                  {advancedMetrics.aucEntries.length >= 2 && (
                    <div>
                      <div className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Balance de exposición (ratio AUC)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {advancedMetrics.aucEntries.map(([prod, frac]) => {
                          const s = series.find((x) => x.product === prod)
                          const color = s?.color ?? 'var(--brand-700)'
                          return (
                            <div key={prod} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                              <span className="sm" style={{ color: 'var(--ink-700)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod}</span>
                              <div style={{ width: 60, height: 5, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ width: `${frac * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
                              </div>
                              <span className="sm mono" style={{ color: 'var(--ink-900)', fontWeight: 600, width: 32, textAlign: 'right', flexShrink: 0 }}>
                                {Math.round(frac * 100)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 6, lineHeight: 1.4, fontSize: 10 }}>
                        Fracción del AUC total en esta ventana. No compara eficacia entre productos.
                      </div>
                    </div>
                  )}

                  {/* items 286/288/290/293 — métricas por producto */}
                  {advancedMetrics.perProduct.filter((p) => p.cv != null || p.intervals.length >= 2 || p.fi != null).map((p) => (
                    <div key={p.product} style={{ background: 'var(--surface)', borderRadius: 'var(--r-sm)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color, flexShrink: 0 }} />
                        <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{p.product}</span>
                        <span className="sm mono" style={{ color: 'var(--ink-400)', fontWeight: 400 }}>{formatHalfLife(p.halfLifeH)}</span>
                      </div>

                      {/* item 286 — regularidad CV% */}
                      {p.cv != null && p.cvLabel && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="sm" style={{ color: 'var(--ink-400)', flex: 1 }}>Regularidad</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: p.cvLabel.color,
                            background: 'var(--card)', borderRadius: 999, padding: '1px 8px', border: `1px solid ${p.cvLabel.color}`,
                          }}>
                            {p.cvLabel.label} · CV {p.cv.toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {/* item 288 — índice de fluctuación (solo GLP-1) */}
                      {p.fi != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="sm" style={{ color: 'var(--ink-400)', flex: 1 }}>Fluctuación pico-valle</span>
                          <span className="sm mono" style={{ color: 'var(--ink-700)', fontWeight: 600 }}>
                            {p.fi < 0.3 ? 'baja' : p.fi < 0.7 ? 'media' : 'alta'} ({p.fi.toFixed(2)})
                          </span>
                        </div>
                      )}

                      {/* item 290 — histograma de intervalos */}
                      {p.intervals.length >= 2 && (
                        <div>
                          <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 4 }}>
                            Intervalos entre dosis ({p.intervals.length} intervalo{p.intervals.length !== 1 ? 's' : ''})
                          </div>
                          <IntervalHistogram
                            intervalsH={p.intervals}
                            targetH={p.targetIntervalH}
                            color={p.color}
                          />
                        </div>
                      )}

                      {/* item 293 — nota de estabilidad AUC */}
                      {p.hint && (
                        <div className="sm" style={{ color: 'var(--ink-400)', lineHeight: 1.4, fontSize: 10, borderLeft: `2px solid ${p.color}`, paddingLeft: 7 }}>
                          {p.hint}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* item 283 — Co-presencia entre péptidos activos */}
                  {advancedMetrics.coPres.length > 0 && (
                    <div>
                      <div className="sm" style={{ color: 'var(--ink-400)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Solapamiento activo (co-presencia)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {advancedMetrics.coPres.slice(0, 6).map((c, i) => {
                          const colorA = series.find((s) => s.product === c.productA)?.color ?? 'var(--ink-400)'
                          const colorB = series.find((s) => s.product === c.productB)?.color ?? 'var(--ink-400)'
                          const durH = c.durationH
                          const durLabel = durH < 2 ? `${Math.round(durH * 60)} min` : durH < 48 ? `${durH.toFixed(1)} h` : `${(durH / 24).toFixed(1)} d`
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: colorA, flexShrink: 0 }} />
                              <span style={{ color: 'var(--ink-700)', fontWeight: 500, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productA}</span>
                              <span style={{ color: 'var(--ink-300)' }}>+</span>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: colorB, flexShrink: 0 }} />
                              <span style={{ color: 'var(--ink-700)', fontWeight: 500, flex: 1, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productB}</span>
                              <span className="sm mono" style={{ color: 'var(--brand-700)', fontWeight: 600, flexShrink: 0 }}>{durLabel}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 8, lineHeight: 1.4, fontSize: 10 }}>
                        Horas con ambos productos ≥ 2 % del pico estimado. No implica interacción farmacológica.
                      </div>
                    </div>
                  )}

                  {/* Disclaimer global del panel */}
                  <p className="disclaimer" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginTop: 0 }}>
                    Todas las métricas son estimaciones educativas basadas en modelos de primer orden y vidas medias de literatura. No representan farmacocinética individual ni son consejo médico.
                  </p>
                </div>
              </motion.div>
  )
}
