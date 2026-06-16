// MedidaDetail — sheet de detalle de una medida/KPI (item 146).
// Lee state.sheetArg = nombre de la medida y muestra:
//   · LineChart del historial (state.history[medida])
//   · Último valor + delta vs. anterior
//   · Botón "Registrar" que abre el sheet 'medida' con esa medida pre-seleccionada
// Compliance: sin claims médicos; "tus datos" educativos.
import { motion } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { LineChart } from '../components/charts'
import { useApp } from '../lib/store'
import { MEASURE_META, MEASURE_ICON, KPIS } from '../lib/catalog'
import { dur, ease } from '../lib/motion'

const FIRST_SCALE_KEY = KPIS.find((k) => k.kind === 'scale')?.key ?? 'Energía'

/** Construye la etiqueta de fecha mínima y máxima de la serie para el gráfico. */
function edgeLabels(series: { ts: number; value: number }[]): [string, string] | undefined {
  if (series.length < 2) return undefined
  const sorted = [...series].sort((a, b) => a.ts - b.ts)
  const fmt = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  return [fmt(sorted[0].ts), fmt(sorted[sorted.length - 1].ts)]
}

export function MedidaDetailSheet() {
  const { state, dispatch } = useApp()

  const name: string = state.sheetArg ?? FIRST_SCALE_KEY
  const meta = MEASURE_META[name]
  const iconMeta = MEASURE_ICON[name]
  const accentColor = iconMeta?.cat ?? 'var(--brand-700)'

  // Historial ordenado ascendente (el LineChart espera orden cronológico)
  const rawHistory = state.history[name] ?? []
  const series = [...rawHistory].sort((a, b) => a.ts - b.ts)
  const values = series.map((s) => s.value)

  // Último valor registrado
  const lastSample = series.length > 0 ? series[series.length - 1] : null
  const lastValue = lastSample?.value ?? null

  // Unidad legible
  const unitLabel = meta
    ? meta.kind === 'scale'
      ? `/ ${meta.max}`
      : (meta.unit ?? '')
    : ''

  // Delta vs. anterior (dirección semántica: down=true → positivo si baja)
  const deltaRaw = series.length >= 2
    ? Math.round((series[series.length - 1].value - series[series.length - 2].value) * 10) / 10
    : null
  const isPositive = deltaRaw !== null
    ? (meta?.down ? deltaRaw < 0 : deltaRaw > 0)
    : false
  const deltaColor = deltaRaw !== null
    ? (isPositive ? 'var(--success)' : 'var(--error)')
    : 'var(--ink-300)'
  const deltaArrow = deltaRaw !== null ? (deltaRaw > 0 ? '↑' : '↓') : ''

  /** Abre el sheet 'medida' con esta medida pre-seleccionada. */
  function handleRegistrar() {
    dispatch({ t: 'sheet', sheet: 'medida', arg: name })
  }

  const labels = edgeLabels(series)

  return (
    <Sheet
      title={name}
      onClose={() => dispatch({ t: 'sheet', sheet: null })}
    >
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Número hero + delta ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.base, ease: ease.decelerate }}
          style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingTop: 4 }}
        >
          {lastValue !== null ? (
            <>
              <span
                className="mono"
                style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: accentColor }}
              >
                {lastValue}
              </span>
              {unitLabel && (
                <span className="sm" style={{ color: 'var(--ink-400)', fontWeight: 500 }}>
                  {unitLabel}
                </span>
              )}
              {deltaRaw !== null && deltaRaw !== 0 && (
                <span
                  className="sm mono"
                  style={{ marginLeft: 4, fontWeight: 700, color: deltaColor }}
                  aria-label={`Delta vs. anterior: ${deltaRaw > 0 ? '+' : ''}${deltaRaw}`}
                >
                  {deltaArrow}{Math.abs(deltaRaw)} vs. anterior
                </span>
              )}
            </>
          ) : (
            <span className="mono" style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: 'var(--ink-300)' }}>
              —
            </span>
          )}
        </motion.div>

        {/* ── Gráfica del historial ───────────────────────────────────────── */}
        {values.length >= 2 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: dur.base, delay: 0.08 }}
          >
            <p className="sm" style={{ margin: '0 0 8px', color: 'var(--ink-400)', fontWeight: 500 }}>
              Tus datos
            </p>
            <LineChart
              data={values}
              color={accentColor}
              w={320}
              h={140}
              labels={labels}
            />
          </motion.div>
        ) : (
          <div
            style={{
              height: 80,
              border: '1px dashed var(--border)',
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p className="sm" style={{ color: 'var(--ink-300)', margin: 0 }}>
              Registra al menos 2 medidas para ver la gráfica
            </p>
          </div>
        )}

        {/* ── Número de registros ─────────────────────────────────────────── */}
        {series.length > 0 && (
          <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>
            {series.length} registro{series.length === 1 ? '' : 's'} · último:{' '}
            {lastSample
              ? new Date(lastSample.ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        )}

        {/* ── CTA Registrar ───────────────────────────────────────────────── */}
        <motion.button
          className="btn btn-brand"
          style={{ width: '100%', height: 48 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleRegistrar}
          aria-label={`Registrar ${name}`}
        >
          Registrar
        </motion.button>

        <Disclaimer kind="measure" />
      </div>
    </Sheet>
  )
}
