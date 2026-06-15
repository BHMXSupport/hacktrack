// ProgressDashboard — dashboard de progreso desde state.history. Solo datos reales.
import { motion } from 'framer-motion'
import { MEASURE_META, MEASURE_ICON } from '../lib/catalog'
import { useApp } from '../lib/store'
import { LineChart } from '../components/charts'
import { Disclaimer } from '../components/controls'
import { Glyph } from '../components/glyphs'
import type { MeasureSample } from '../lib/types'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

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

  return (
    <motion.div variants={item} className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Glyph name={glyphId} size={20} color={color} />
        <span className="body" style={{ flex: 1, color: 'var(--ink-700)' }}>{name}</span>
        <span className="mono" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
          {formatValue(name, last.value)}
        </span>
      </div>

      {sorted.length >= 2 ? (
        <div style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden' }}>
          <LineChart
            data={values}
            color={color}
            labels={timeLabels}
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
      <Glyph name={glyphId} size={16} color="var(--ink-500)" />
      <span className="sm" style={{ color: 'var(--ink-600)', fontWeight: 600, flex: 1 }}>
        {title}
      </span>
      <span className="sm" style={{ color: 'var(--ink-400)' }}>{count}</span>
    </div>
  )
}

export function ProgressDashboard() {
  const { state } = useApp()
  const history = state.history

  const allKeys = Object.keys(history).filter(k => history[k] && history[k].length > 0)

  if (allKeys.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          gap: 12,
        }}
      >
        <Glyph name="medidas" size={40} color="var(--ink-300)" />
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>
          Aún no hay datos. Toca + para registrar y ver tu progreso.
        </p>
      </div>
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
      <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 20 }}>
        tus datos
      </p>

      {/* Sección: Medidas corporales */}
      {corporalesOrdenadas.length > 0 && (
        <motion.div variants={stagger} initial="initial" animate="animate" style={{ marginBottom: 24 }}>
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
        <motion.div variants={stagger} initial="initial" animate="animate" style={{ marginBottom: 8 }}>
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
