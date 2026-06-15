// ProgressDashboard — dashboard de progreso desde state.history. Solo datos reales.
import { motion } from 'framer-motion'
import { MEASURE_META, MEASURE_ICON } from '../lib/catalog'
import { useApp } from '../lib/store'
import { LineChart } from '../components/charts'
import { Disclaimer } from '../components/controls'
import type { MeasureSample } from '../lib/types'

// Medidas objetivas que van primero (en este orden)
const OBJETIVAS_ORDER = ['Peso', 'Altura', 'IMC', '% grasa', '% músculo']

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

function formatValue(name: string, value: number): string {
  const meta = MEASURE_META[name]
  if (!meta) return String(value)
  if (meta.kind === 'num') {
    const unit = meta.unit ? ` ${meta.unit}` : ''
    return `${value}${unit}`
  }
  // scale — muéstralo "/100" cuando max===100
  if (meta.max === 100) return `${value}/100`
  return String(value)
}

function lastLabel(name: string, value: number): string {
  return formatValue(name, value)
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
  // Ordenar por ts ascendente
  const sorted = [...samples].sort((a, b) => a.ts - b.ts)
  const values = sorted.map(s => s.value)
  const last = sorted[sorted.length - 1]
  const icon = MEASURE_ICON[name]
  const meta = MEASURE_META[name]
  const color = icon?.cat ?? 'var(--brand-700)'

  // Etiquetas del eje temporal: primera y última muestra
  const timeLabels: [string, string] | undefined =
    sorted.length >= 2
      ? [fmtDate(sorted[0].ts), fmtDate(sorted[sorted.length - 1].ts)]
      : undefined

  return (
    <motion.div variants={item} className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon && <span aria-hidden style={{ fontSize: 20 }}>{icon.ic}</span>}
        <span className="body" style={{ flex: 1, color: 'var(--ink-700)' }}>{name}</span>
        <span className="mono" style={{ color }}>
          {lastLabel(name, last.value)}
        </span>
      </div>

      {/* Solo LineChart si hay ≥2 puntos */}
      {sorted.length >= 2 ? (
        <div style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden' }}>
          <LineChart
            data={values}
            color={color}
            labels={timeLabels}
          />
        </div>
      ) : (
        /* 1 solo punto: valor ya visible arriba, sin gráfica */
        <p className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>
          Primer registro — agrega más para ver tu tendencia.
        </p>
      )}
    </motion.div>
  )
}

export function ProgressDashboard() {
  const { state } = useApp()
  const history = state.history

  // Nombres de KPIs con al menos 1 muestra
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
        <span aria-hidden style={{ fontSize: 40 }}>📈</span>
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>
          Aún no hay datos. Toca + para registrar y ver tu progreso.
        </p>
      </div>
    )
  }

  // Separar objetivas (en el orden canónico) del resto (escalas)
  const objetivasPresentes = OBJETIVAS_ORDER.filter(k => allKeys.includes(k))
  const escalasPresentes = allKeys.filter(k => !OBJETIVAS_ORDER.includes(k))
  const ordered = [...objetivasPresentes, ...escalasPresentes]

  return (
    <div style={{ padding: '4px 0 8px' }}>
      <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 16 }}>
        tus datos
      </p>
      <motion.div variants={stagger} initial="initial" animate="animate">
        {ordered.map(name => (
          <KpiCard key={name} name={name} samples={history[name]} />
        ))}
      </motion.div>
      <Disclaimer kind="measure" />
    </div>
  )
}
