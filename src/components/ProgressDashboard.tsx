// ProgressDashboard — dashboard de progreso desde state.history. Solo datos reales.
// n=463: Overlay de bandas de fase de titulación sobre la gráfica de peso.
// n=464: Marcadores de inicio de protocolo y cambios de fase sobre la curva de peso.
import { useState, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MEASURE_META, MEASURE_ICON, PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
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
  const allKeys = Object.keys(history).filter(k => k !== 'Altura' && history[k] && history[k].length > 0)
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

// ── n=463/464: Overlay de fases y marcadores sobre gráfica de peso ───────────
interface PhaseOverlayProps {
  samples: MeasureSample[]
  protocols: ReturnType<typeof useApp>['state']['protocols']
  w?: number
  h?: number
}

const PHASE_COLORS = [
  'rgba(27,138,125,0.08)',   // fase 0 → brand tenue
  'rgba(107,123,232,0.08)',  // fase 1 → índigo
  'rgba(168,132,47,0.08)',   // fase 2 → ámbar
  'rgba(155,95,196,0.08)',   // fase 3 → morado
  'rgba(232,93,58,0.08)',    // fase 4 → naranja
]

const PHASE_STROKE = [
  'rgba(27,138,125,0.4)',
  'rgba(107,123,232,0.4)',
  'rgba(168,132,47,0.4)',
  'rgba(155,95,196,0.4)',
  'rgba(232,93,58,0.4)',
]

function WeightPhaseOverlay({ samples, protocols, w = 320, h = 150 }: PhaseOverlayProps) {
  const uid = useId()
  if (samples.length < 2) return null

  const sorted = [...samples].sort((a, b) => a.ts - b.ts)
  const minTs = sorted[0].ts
  const maxTs = sorted[sorted.length - 1].ts
  const tsRange = maxTs - minTs || 1
  const PAD = 6
  const ch = h - 22 // canvas height (sans label space)

  function tsToX(ts: number) {
    return PAD + ((ts - minTs) / tsRange) * (w - PAD * 2)
  }

  // ── n=463: bandas de fase ──────────────────────────────────────
  const phaseBands: { x1: number; x2: number; phase: number; label: string }[] = []

  for (const proto of Object.values(protocols)) {
    if (!proto || proto.archived) continue
    const entry = PEPTIDES[proto.product]
    if (!entry?.phaseWeeks || !entry.phases) continue

    const startTs = proto.startDate
    const phaseWeeksMs = (entry.phaseWeeks ?? 4) * 7 * 86400000

    for (let ph = 0; ph < (entry.phases ?? 1); ph++) {
      const bandStart = startTs + ph * phaseWeeksMs
      const bandEnd = startTs + (ph + 1) * phaseWeeksMs

      // Solo mostrar bandas que intersectan con el rango de datos
      if (bandEnd < minTs || bandStart > maxTs) continue

      phaseBands.push({
        x1: Math.max(tsToX(bandStart), PAD),
        x2: Math.min(tsToX(bandEnd), w - PAD),
        phase: ph,
        label: `F${ph + 1}`,
      })
    }
  }

  // ── n=464: marcadores de inicio de protocolo y cambio de fase ─────────────
  interface Marker {
    x: number
    label: string
    color: string
    product: string
  }
  const markers: Marker[] = []

  for (const proto of Object.values(protocols)) {
    if (!proto || proto.archived) continue
    const entry = PEPTIDES[proto.product]
    const color = entry ? (CATEGORY_COLOR[entry.cat] ?? 'var(--brand-500)') : 'var(--brand-500)'
    const startTs = proto.startDate

    // Marcador de inicio de protocolo (si cae dentro del rango)
    if (startTs >= minTs && startTs <= maxTs) {
      markers.push({ x: tsToX(startTs), label: proto.product.slice(0, 4), color, product: proto.product })
    }

    // Marcadores de cambio de fase
    if (entry?.phaseWeeks && entry.phases && entry.phases > 1) {
      const phaseWeeksMs = entry.phaseWeeks * 7 * 86400000
      for (let ph = 1; ph < entry.phases; ph++) {
        const changeTs = startTs + ph * phaseWeeksMs
        if (changeTs >= minTs && changeTs <= maxTs) {
          markers.push({ x: tsToX(changeTs), label: `F${ph + 1}`, color, product: proto.product })
        }
      }
    }
  }

  // n=464: evitar texto-sobre-texto — ordenar por x, descartar marcadores a <16px
  // del anterior visible y limitar a un máximo de 3 etiquetas.
  const sortedMarkers = [...markers].sort((a, b) => a.x - b.x)
  const visibleMarkers: Marker[] = []
  let lastX = -Infinity
  for (const m of sortedMarkers) {
    if (m.x - lastX < 16) continue
    visibleMarkers.push(m)
    lastX = m.x
    if (visibleMarkers.length >= 3) break
  }

  if (phaseBands.length === 0 && visibleMarkers.length === 0) return null

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden
    >
      {/* n=463: bandas de fase */}
      {phaseBands.map((band, i) => (
        <g key={`band-${i}`}>
          <rect
            x={band.x1}
            y={PAD}
            width={Math.max(0, band.x2 - band.x1)}
            height={ch - PAD}
            fill={PHASE_COLORS[band.phase % PHASE_COLORS.length]}
          />
          {/* etiqueta de fase si hay espacio suficiente */}
          {band.x2 - band.x1 > 24 && (
            <text
              x={(band.x1 + band.x2) / 2}
              y={PAD + 12}
              textAnchor="middle"
              fontSize={9}
              fill={PHASE_STROKE[band.phase % PHASE_STROKE.length].replace('0.4', '0.8')}
              fontWeight={600}
            >
              {band.label}
            </text>
          )}
        </g>
      ))}

      {/* n=464: líneas verticales de inicio/fase (solo marcadores no encimados) */}
      {visibleMarkers.map((m, i) => {
        const labelW = m.label.length * 5 + 4
        const clampedX = Math.min(m.x + 3, w - labelW - 2)
        return (
          <g key={`marker-${i}`}>
            <line
              x1={m.x}
              x2={m.x}
              y1={PAD}
              y2={ch}
              stroke={m.color}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              opacity={0.7}
            />
            {/* fondo para que la etiqueta no se mezcle con la línea de datos */}
            <rect
              x={clampedX - 2}
              y={ch - 13}
              width={labelW}
              height={11}
              rx={2}
              fill="var(--surface)"
              opacity={0.7}
            />
            <text
              x={clampedX}
              y={ch - 4}
              fontSize={8}
              fill={m.color}
              fontWeight={600}
              style={{ userSelect: 'none' }}
            >
              {m.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// n=147/148: KpiCard con gráfica expandible + selector de rango
// n=463/464: si la medida es 'Peso', mostrar overlay de fases sobre la gráfica
interface KpiCardProps {
  name: string
  samples: MeasureSample[]
  protocols: ReturnType<typeof useApp>['state']['protocols']
}

function KpiCard({ name, samples, protocols }: KpiCardProps) {
  const [chartOpen, setChartOpen] = useState(false)
  const [range, setRange] = useState<'7d' | '30d' | 'Todo'>('Todo')
  // n=463/464: overlay de fases opt-in (no por defecto) para reducir densidad sobre el KPI
  const [showPhases, setShowPhases] = useState(false)

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
      <span className="mono" style={{ fontSize: 11, color: deltaColor, whiteSpace: 'nowrap' }}>
        {arrow}{label}
      </span>
    )
  }

  // n=463/464: ¿es la gráfica de Peso?
  const isPeso = name === 'Peso'

  return (
    <motion.div variants={staggerItem} className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
        <Glyph name={glyphId} size={20} color={color} />
        <span className="body" style={{ flex: 1, minWidth: 0, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        {/* valor + delta + toggle agrupados: pueden bajar de línea juntos sin partir el par valor/delta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span className="mono" style={{ color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
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

            {/* n=463/464: toggle "Mostrar fases" — opt-in, solo en Peso con titulación activa */}
            {isPeso && (() => {
              const hasPhases = Object.values(protocols).some(
                (p) => !p?.archived && PEPTIDES[p?.product ?? '']?.phaseWeeks,
              )
              if (!hasPhases) return null
              return (
                <button
                  onClick={() => setShowPhases(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-700)', fontSize: 11, padding: '2px 0', marginBottom: 4, whiteSpace: 'nowrap' }}
                >
                  {showPhases ? 'Ocultar fases ▴' : 'Mostrar fases ▾'}
                </button>
              )
            })()}

            {/* n=463/464: contenedor relativo para el overlay */}
            <div
              style={{
                marginTop: 4,
                borderRadius: 'var(--r-sm)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <LineChart
                data={values}
                color={color}
                labels={timeLabels}
                h={Math.max(90, Math.min(160, 70 + displaySamples.length * 6))}
              />
              {/* n=463/464: overlay de fases solo en gráfica de Peso y bajo demanda */}
              {isPeso && showPhases && (
                <WeightPhaseOverlay
                  samples={displaySamples}
                  protocols={protocols}
                  h={Math.max(90, Math.min(160, 70 + displaySamples.length * 6))}
                />
              )}
            </div>

            {/* n=463/464: leyenda de fases (solo si el overlay está activo) */}
            {isPeso && showPhases && (() => {
              const protos = Object.values(protocols).filter(
                (p) => !p?.archived && PEPTIDES[p?.product ?? '']?.phaseWeeks,
              )
              if (protos.length === 0) return null
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {protos.map((p) => {
                    const entry = p ? PEPTIDES[p.product] : null
                    const nPhases = entry?.phases ?? 0
                    const color = entry ? (CATEGORY_COLOR[entry.cat] ?? 'var(--brand-500)') : 'var(--brand-500)'
                    return Array.from({ length: nPhases }, (_, i) => (
                      <span key={`${p?.product}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: PHASE_COLORS[i % PHASE_COLORS.length].replace('0.08', '0.35'), display: 'block', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>
                          {p?.product} F{i + 1}
                        </span>
                      </span>
                    ))
                  })}
                </div>
              )
            })()}
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
  const protocols = state.protocols ?? {}

  const allKeys = Object.keys(history).filter(k => k !== 'Altura' && history[k] && history[k].length > 0)
  // medidas con suficientes datos para graficar/comparar una línea (≥2 puntos)
  const measuresWithData = allKeys.filter(k => (history[k]?.length ?? 0) >= 2)

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

  // Densidad: agrupar herramientas analíticas (CSV, comparar, semana A/B) tras un disclosure
  const [toolsOpen, setToolsOpen] = useState(false)

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
            <KpiCard key={name} name={name} samples={history[name]} protocols={protocols} />
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
            <KpiCard key={name} name={name} samples={history[name]} protocols={protocols} />
          ))}
        </motion.div>
      )}

      {/* Herramientas de análisis — colapsadas por defecto para bajar densidad */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setToolsOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Glyph name="medidas" size={16} color="var(--ink-400)" />
          <span className="sm" style={{ fontWeight: 600, color: 'var(--ink-700)', flex: 1 }}>
            Herramientas de análisis
          </span>
          <span className="sm" style={{ color: 'var(--ink-400)' }}>{toolsOpen ? '▴' : '▾'}</span>
        </button>
        <AnimatePresence>
          {toolsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              {/* n=168: Exportar CSV */}
              {exportBtn}

      {/* n=149: Comparar dos medidas — solo si hay ≥2 medidas con datos suficientes (si no, no sirve) */}
      {measuresWithData.length >= 2 && (
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
            {measuresWithData.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select
            value={compareB}
            onChange={e => setCompareB(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--ink-200)', background: 'white', color: 'var(--ink-900)' }}
          >
            <option value="">Medida B</option>
            {measuresWithData.map(k => <option key={k} value={k}>{k}</option>)}
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
      )}

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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Disclaimer kind="measure" />
    </div>
  )
}
