// ProgressDashboard — dashboard de progreso desde state.history. Solo datos reales.
import { motion } from 'framer-motion'
import { MEASURE_META, MEASURE_ICON } from '../lib/catalog'
import { useApp } from '../lib/store'
import { staggerParent, staggerItem } from '../lib/motion'
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

interface KpiCardProps {
  name: string
  samples: MeasureSample[]
}

function KpiCard({ name, samples }: KpiCardProps) {
  if (!samples.length) return null
  const sorted = [...samples].sort((a, b) => a.ts - b.ts)
  const values = sorted.map(s => s.value)
  const last = sorted[sorted.length - 1]
  const icon = MEASURE_ICON[name]
  const color = icon?.cat ?? 'var(--brand-700)'
  const glyphId = icon?.icon ?? 'medidas'

  const timeLabels: [string, string] | undefined =
    sorted.length >= 2
      ? [fmtDate(sorted[0].ts), fmtDate(sorted[sorted.length - 1].ts)]
      : undefined

  // Delta de tendencia (tarea 58)
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
      </div>

      {sorted.length >= 2 ? (
        <div style={{ marginTop: 4, borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
          <LineChart
            data={values}
            color={color}
            labels={timeLabels}
            h={Math.max(90, Math.min(160, 70 + sorted.length * 6))}
          />
        </div>
      ) : (
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

export function ProgressDashboard() {
  const { state, dispatch } = useApp()
  const history = state.history

  const allKeys = Object.keys(history).filter(k => history[k] && history[k].length > 0)

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

  // Segmentar: 'num' → corporales, 'scale' → bienestar
  const corporales = allKeys.filter(k => MEASURE_META[k]?.kind === 'num')
  const bienestar  = allKeys.filter(k => MEASURE_META[k]?.kind !== 'num')

  // Orden canónico para corporales
  const CORPORALES_ORDER = ['Peso', 'Altura', 'IMC', '% grasa', '% músculo', 'Cintura']
  const corporalesOrdenadas = [
    ...CORPORALES_ORDER.filter(k => corporales.includes(k)),
    ...corporales.filter(k => !CORPORALES_ORDER.includes(k)),
  ]

  return (
    <div style={{ padding: '4px 0 8px' }}>
      {/* Sección: Medidas corporales */}
      {corporalesOrdenadas.length > 0 && (
        <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ marginBottom: 24 }}>
          <SectionHeader
            glyphId="medidas"
            title="Medidas corporales"
            count={corporalesOrdenadas.length}
          />
          {corporalesOrdenadas.map(name => (
            <KpiCard key={name} name={name} samples={history[name]} />
          ))}
        </motion.div>
      )}

      {/* Sección: Bienestar */}
      {bienestar.length > 0 && (
        <motion.div variants={staggerParent} initial="initial" animate="animate" style={{ marginBottom: 8 }}>
          <SectionHeader
            glyphId="animo"
            title="Bienestar"
            count={bienestar.length}
          />
          {bienestar.map(name => (
            <KpiCard key={name} name={name} samples={history[name]} />
          ))}
        </motion.div>
      )}

      <Disclaimer kind="measure" />
    </div>
  )
}
