// ProgressDashboard — dashboard de progreso desde state.history. Solo datos reales.
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MEASURE_META, MEASURE_ICON } from '../lib/catalog'
import { useApp } from '../lib/store'
import { spring, staggerParent, staggerItem } from '../lib/motion'
import { LineChart } from '../components/charts'
import { Disclaimer } from '../components/controls'
import { Glyph } from '../components/glyphs'
import { EmptyState } from '../components/EmptyState'
import type { MeasureSample } from '../lib/types'

function formatValue(name: string, value: number): string {
  const meta = MEASURE_META[name]
  if (!meta) return String(value)
  if (meta.kind === 'num') {
    const unit = meta.unit ? ` ${meta.unit}` : ''
    return `${value}${unit}`
  }
  if (meta.max === 100) return `${value}/100`
  return String(value)
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// n=168: Exportar CSV
function exportCsv(history: Record<string, MeasureSample[]>) {
  const BOM = '﻿'
  const rows: string[] = ['medida,fecha,valor']
  const allKeys = Object.keys(history).filter(k => history[k] && history[k].length > 0)
  const sorted = [...allKeys].sort()
  for (const name of sorted) {
    const samples = [...history[name]].sort((a, b) => a.ts - b.ts)
    for (const s of samples) {
      const fecha = new Date(s.ts).toISOString().slice(0, 10)
      const medida = `"${name.replace(/"/g, '""')}"`
      rows.push(`${medida},${fecha},${s.value}`)
    }
  }
  const csv = BOM + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'hacktrack-medidas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// n=147/148: KpiCard con gráfica expandible + selector de rango
interface KpiCardProps {
  name: string
  samples: MeasureSample[]
}

function KpiCard({ name, samples }: KpiCardProps) {
  const [chartOpen, setChartOpen] = useState(false)
  const [range, setRange] = useState<'7d' | '30d' | 'Todo'>('Todo')

  if (!samples.length) return null
  const sorted = [...samples].sort((a, b) => a.ts - b.ts)
  const last = sorted[sorted.length - 1]
  const icon = MEASURE_ICON[name]
  const color = icon?.cat ?? 'var(--brand-700)'
  const glyphId = icon?.icon ?? 'medidas'

  // Filtrar por rango para la gráfica
  const now = Date.now()
  const rangeMs = range === '7d' ? 7 * 86400000 : range === '30d' ? 30 * 86400000 : null
  const filtered = rangeMs != null ? sorted.filter(s => s.ts >= now - rangeMs) : sorted
  const displaySamples = filtered.length > 0 ? filtered : sorted
  const values = displaySamples.map(s => s.value)

  const timeLabels: [string, string] | undefined =
    displaySamples.length >= 2
      ? [fmtDate(displaySamples[0].ts), fmtDate(displaySamples[displaySamples.length - 1].ts)]
      : undefined

  // Delta de tendencia
  let deltaEl: React.ReactNode = null
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2].value
    const delta = Math.round((last.value - prev) * 10) / 10
    const down = MEASURE_META[name]?.down
    let deltaColor = 'var(--ink-400)'
    if (delta !== 0) {
      const good = down ? delta < 0 : delta > 0
      deltaColor = good ? 'var(--success)' : 'var(--error)'
    }
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
    const label = delta > 0 ? `+${delta}` : String(delta)
    deltaEl = (
      <span className="mono" style={{ fontSize: 11, color: deltaColor, marginLeft: 6 }}>
        {arrow}{label}
      </span>
    )
  }

  return (
    <motion.div variants={staggerItem} className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Glyph name={glyphId} size={20} color={color} />
        <span className="body" style={{ flex: 1, color: 'var(--ink-700)' }}>{name}</span>
        <span className="mono" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
          {formatValue(name, last.value)}
        </span>
        {deltaEl}
        {/* n=147: botón Ver/Ocultar gráfica */}
        {sorted.length >= 2 && (
          <button
            onClick={() => setChartOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-700)', fontSize: 12, padding: '2px 6px', borderRadius: 'var(--r-sm)', marginLeft: 4, whiteSpace: 'nowrap' }}
          >
            {chartOpen ? 'Ocultar ▴' : 'Ver gráfica ▾'}
          </button>
        )}
      </div>

      {/* n=147/148: gráfica expandible con selector de rango */}
      <AnimatePresence>
        {chartOpen && sorted.length >= 2 && (
          <motion.div
            key="chart"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* n=148: selector de rango */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              {(['7d', '30d', 'Todo'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 99, border: '1px solid',
                    borderColor: range === r ? 'var(--brand-700)' : 'var(--ink-200)',
                    background: range === r ? 'var(--brand-700)' : 'transparent',
                    color: range === r ? 'white' : 'var(--ink-400)',
                    cursor: 'pointer',
                  }}
                >
                  {r}
                </button>
              ))}
              <span className="sm" style={{ color: 'var(--ink-400)', marginLeft: 4, fontSize: 11 }}>
                {displaySamples.length} registros
              </span>
            </div>
            <div style={{ marginTop: 4, borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
              <LineChart
                data={values}
                color={color}
                labels={timeLabels}
                h={Math.max(90, Math.min(160, 70 + displaySamples.length * 6))}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!chartOpen && sorted.length < 2 && (
        <p className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
          Primer registro — agrega más para ver tu tendencia.
        </p>
      )}
    </motion.div>
  )
}

interface SectionHeaderProps {
  glyphId: string
  title: string
  count: number
}

function SectionHeader({ glyphId, title, count }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: '1px solid var(--ink-100, rgba(0,0,0,0.08))',
      }}
    >
      <Glyph name={glyphId} size={16} color="var(--ink-400)" />
      <span className="sm" style={{ color: 'var(--ink-700)', fontWeight: 600, flex: 1 }}>
        {title}
      </span>
      <span className="sm" style={{ color: 'var(--ink-400)' }}>{count}</span>
    </div>
  )
}

// n=149: gráfica SVG de dos series normalizadas (overlay)
function DualLineChart({ samplesA, samplesB, nameA, nameB }: {
  samplesA: MeasureSample[]
  samplesB: MeasureSample[]
  nameA: string
  nameB: string
}) {
  const W = 300
  const H = 120
  const PAD = 12

  function normalize(arr: MeasureSample[]): { x: number; y: number }[] {
    if (arr.length === 0) return []
    const sorted = [...arr].sort((a, b) => a.ts - b.ts)
    const minTs = sorted[0].ts
    const maxTs = sorted[sorted.length - 1].ts
    const tsRange = maxTs - minTs || 1
    const minV = Math.min(...sorted.map(s => s.value))
    const maxV = Math.max(...sorted.map(s => s.value))
    const vRange = maxV - minV || 1
    return sorted.map(s => ({
      x: PAD + ((s.ts - minTs) / tsRange) * (W - PAD * 2),
      y: (H - PAD) - ((s.value - minV) / vRange) * (H - PAD * 2),
    }))
  }

  function toPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }

  const ptsA = normalize(samplesA)
  const ptsB = normalize(samplesB)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {ptsA.length >= 2 && (
        <path d={toPath(ptsA)} fill="none" stroke="var(--brand-700)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {ptsB.length >= 2 && (
        <path d={toPath(ptsB)} fill="none" stroke="var(--warning)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 2" />
      )}
    </svg>
  )
}

export function ProgressDashboard() {
  const { state, dispatch } = useApp()
  const history = state.history

  const allKeys = Object.keys(history).filter(k => history[k] && history[k].length > 0)

  // n=146: gestión de KPI order
  const [kpiMgrOpen, setKpiMgrOpen] = useState(false)
  const kpiOrder = state.kpiOrder && state.kpiOrder.length > 0
    ? state.kpiOrder.filter(k => allKeys.includes(k))
    : null

  // n=149: comparar dos medidas
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [showCompare, setShowCompare] = useState(false)

  // n=150: semana A vs B
  const [weekCompOpen, setWeekCompOpen] = useState(false)

  if (allKeys.length === 0) {
    return (
      <EmptyState
        glyph="medidas"
        title="Aún no hay medidas"
        subtitle="Registra tu primera medida para ver tu progreso aquí."
        cta={{ label: 'Registrar medida', onClick: () => dispatch({ t: 'sheet', sheet: 'medida' }) }}
      />
    )
  }

  // n=168: botón Exportar CSV
  const exportBtn = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      <button
        onClick={() => exportCsv(history)}
        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--ink-200)', background: 'var(--ink-100)', color: 'var(--ink-700)', cursor: 'pointer' }}
      >
        Exportar CSV
      </button>
    </div>
  )

  // n=146: panel de gestión de KPIs
  const kpiMgrPanel = (
    <div style={{ marginBottom: 16, padding: 12, background: 'var(--ink-100)', borderRadius: 'var(--r-md)', border: '1px solid var(--ink-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>Mis KPIs (máx. 4)</span>
        <button
          onClick={() => setKpiMgrOpen(v => !v)}
          style={{ fontSize: 12, padding: '2px 10px', borderRadius: 99, border: '1px solid var(--ink-200)', background: 'white', color: 'var(--ink-700)', cursor: 'pointer' }}
        >
          {kpiMgrOpen ? 'Cerrar' : 'Gestionar'}
        </button>
      </div>
      <AnimatePresence>
        {kpiMgrOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allKeys.map(k => {
                const active = kpiOrder ? kpiOrder.includes(k) : false
                const order = kpiOrder ?? []
                const idx = order.indexOf(k)
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      onClick={() => {
                        const cur = state.kpiOrder ?? []
                        if (cur.includes(k)) {
                          dispatch({ t: 'setKpiOrder', order: cur.filter(x => x !== k) })
                        } else if (cur.length < 4) {
                          dispatch({ t: 'setKpiOrder', order: [...cur, k] })
                        }
                      }}
                      style={{
                        fontSize: 12, padding: '3px 10px', borderRadius: 99, border: '1px solid',
                        borderColor: active ? 'var(--brand-700)' : 'var(--ink-200)',
                        background: active ? 'var(--brand-700)' : 'white',
                        color: active ? 'white' : 'var(--ink-700)',
                        cursor: 'pointer',
                      }}
                    >
                      {k}
                    </button>
                    {active && idx > 0 && (
                      <button
                        onClick={() => {
                          const cur = [...(state.kpiOrder ?? [])]
                          const i = cur.indexOf(k)
                          if (i > 0) { [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]]; dispatch({ t: 'setKpiOrder', order: cur }) }
                        }}
                        style={{ fontSize: 11, padding: '1px 4px', background: 'none', border: '1px solid var(--ink-200)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink-400)' }}
                        aria-label={`Mover ${k} arriba`}
                      >↑</button>
                    )}
                    {active && kpiOrder && idx < kpiOrder.length - 1 && (
                      <button
                        onClick={() => {
                          const cur = [...(state.kpiOrder ?? [])]
                          const i = cur.indexOf(k)
                          if (i < cur.length - 1) { [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]]; dispatch({ t: 'setKpiOrder', order: cur }) }
                        }}
                        style={{ fontSize: 11, padding: '1px 4px', background: 'none', border: '1px solid var(--ink-200)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink-400)' }}
                        aria-label={`Mover ${k} abajo`}
                      >↓</button>
                    )}
                  </div>
                )
              })}
            </div>
            {(state.kpiOrder?.length ?? 0) > 0 && (
              <button
                onClick={() => dispatch({ t: 'setKpiOrder', order: [] })}
                style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Mostrar todos
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  // Segmentar: 'num' → corporales, 'scale' → bienestar
  const corporales = allKeys.filter(k => MEASURE_META[k]?.kind === 'num')
  const bienestar  = allKeys.filter(k => MEASURE_META[k]?.kind !== 'num')

  // Orden canónico para corporales
  const CORPORALES_ORDER = ['Peso', 'Altura', 'IMC', '% grasa', '% músculo', 'Cintura']
  const corporalesOrdenadas = [
    ...CORPORALES_ORDER.filter(k => corporales.includes(k)),
    ...corporales.filter(k => !CORPORALES_ORDER.includes(k)),
  ]

  // n=146: si hay kpiOrder, filtrar/reordenar
  const corporalesDisplay = kpiOrder
    ? kpiOrder.filter(k => corporalesOrdenadas.includes(k))
    : corporalesOrdenadas
  const bienestarDisplay = kpiOrder
    ? kpiOrder.filter(k => bienestar.includes(k))
    : bienestar

  // n=150: semana A (últimos 7d) vs semana B (8-14d atrás)
  const nowTs = Date.now()
  const weekAFrom = nowTs - 7 * 86400000
  const weekBFrom = nowTs - 14 * 86400000
  const weekBTo   = nowTs - 7 * 86400000

  function avgInRange(samples: MeasureSample[], from: number, to: number): number | null {
    const inRange = samples.filter(s => s.ts >= from && s.ts < to)
    if (inRange.length === 0) return null
    return Math.round((inRange.reduce((a, s) => a + s.value, 0) / inRange.length) * 10) / 10
  }

  const weekCompRows = allKeys.map(name => {
    const samples = history[name]
    const avgA = avgInRange(samples, weekAFrom, nowTs)
    const avgB = avgInRange(samples, weekBFrom, weekBTo)
    if (avgA === null && avgB === null) return null
    const delta = avgA !== null && avgB !== null ? Math.round((avgA - avgB) * 10) / 10 : null
    return { name, avgA, avgB, delta }
  }).filter((r): r is { name: string; avgA: number | null; avgB: number | null; delta: number | null } => r !== null)

  return (
    <div style={{ padding: '4px 0 8px' }}>
      {/* n=168: Exportar CSV */}
      {exportBtn}

      {/* n=146: Gestión de KPIs */}
      {kpiMgrPanel}

      {/* Sección: Medidas corporales */}
      {corporalesDisplay.length > 0 && (
        <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ marginBottom: 24 }}>
          <SectionHeader
            glyphId="medidas"
            title="Medidas corporales"
            count={corporalesDisplay.length}
          />
          {corporalesDisplay.map(name => (
            <KpiCard key={name} name={name} samples={history[name]} />
          ))}
        </motion.div>
      )}

      {/* Sección: Bienestar */}
      {bienestarDisplay.length > 0 && (
        <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ marginBottom: 8 }}>
          <SectionHeader
            glyphId="animo"
            title="Bienestar"
            count={bienestarDisplay.length}
          />
          {bienestarDisplay.map(name => (
            <KpiCard key={name} name={name} samples={history[name]} />
          ))}
        </motion.div>
      )}

      {/* n=149: Comparar dos medidas (overlay) */}
      <div style={{ marginBottom: 16, padding: 12, background: 'var(--ink-100)', borderRadius: 'var(--r-md)', border: '1px solid var(--ink-200)' }}>
        <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)', display: 'block', marginBottom: 8 }}>
          Comparar medidas
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={compareA}
            onChange={e => setCompareA(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--ink-200)', background: 'white', color: 'var(--ink-900)' }}
          >
            <option value="">Medida A</option>
            {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select
            value={compareB}
            onChange={e => setCompareB(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--ink-200)', background: 'white', color: 'var(--ink-900)' }}
          >
            <option value="">Medida B</option>
            {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button
            onClick={() => setShowCompare(!!(compareA && compareB))}
            disabled={!compareA || !compareB}
            style={{ fontSize: 13, padding: '4px 14px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--brand-700)', color: 'white', cursor: compareA && compareB ? 'pointer' : 'not-allowed', opacity: compareA && compareB ? 1 : 0.5 }}
          >
            Comparar
          </button>
        </div>
        <AnimatePresence>
          {showCompare && compareA && compareB && history[compareA] && history[compareB] && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{ marginTop: 10 }}
            >
              <DualLineChart
                samplesA={history[compareA]}
                samplesB={history[compareB]}
                nameA={compareA}
                nameB={compareB}
              />
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--brand-700)' }}>— {compareA}</span>
                <span style={{ fontSize: 12, color: 'var(--warning)' }}>- - {compareB}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* n=150: Semana A vs B */}
      <div style={{ marginBottom: 16, padding: 12, background: 'var(--ink-100)', borderRadius: 'var(--r-md)', border: '1px solid var(--ink-200)' }}>
        <button
          onClick={() => setWeekCompOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: 0 }}
        >
          <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>
            Semana A vs B {weekCompOpen ? '▴' : '▾'}
          </span>
        </button>
        <AnimatePresence>
          {weekCompOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
            >
              {weekCompRows.length === 0 ? (
                <p className="sm" style={{ color: 'var(--ink-400)', margin: '8px 0 0' }}>
                  Sin datos suficientes para comparar semanas.
                </p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: 'var(--ink-400)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Medida</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Sem A (últ. 7d)</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Sem B (8–14d)</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekCompRows.map(row => {
                        const down = MEASURE_META[row.name]?.down
                        let deltaColor = 'var(--ink-400)'
                        if (row.delta !== null && row.delta !== 0) {
                          const good = down ? row.delta < 0 : row.delta > 0
                          deltaColor = good ? 'var(--success)' : 'var(--error)'
                        }
                        return (
                          <tr key={row.name} style={{ borderTop: '1px solid var(--ink-200)' }}>
                            <td style={{ padding: '4px 6px', color: 'var(--ink-700)' }}>{row.name}</td>
                            <td style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--ink-900)' }}>
                              {row.avgA !== null ? row.avgA : '—'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--ink-400)' }}>
                              {row.avgB !== null ? row.avgB : '—'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '4px 6px', color: deltaColor, fontWeight: 600 }}>
                              {row.delta !== null ? (row.delta > 0 ? `+${row.delta}` : String(row.delta)) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Disclaimer kind="measure" />
    </div>
  )
}
