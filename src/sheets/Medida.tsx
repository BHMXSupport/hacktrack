import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { KPIS, MEASURE_META } from '../lib/catalog'

// Primer KPI de tipo scale como fallback canónico
const FIRST_SCALE_KEY = KPIS.find((k) => k.kind === 'scale')?.key ?? 'Energía'

function qualLabel(value: number): string {
  if (value <= 33) return 'bajo'
  if (value <= 66) return 'medio'
  return 'alto'
}

export function MedidaSheet() {
  const { state, dispatch } = useApp()

  const name: string = state.sheetArg ?? FIRST_SCALE_KEY
  const isEfecto = name === 'Efecto secundario'
  const maxVal = MEASURE_META[name]?.max ?? 100

  const [value, setValue] = useState<number>(Math.round(maxVal / 2))
  const [nota, setNota] = useState<string>('')
  const [touched, setTouched] = useState(false) // sin precarga implícita: exige elección explícita

  const qual = qualLabel(value)

  // Color del track fill proporcional al valor
  const fillPct = ((value - 1) / (maxVal - 1)) * 100

  // Etiqueta contextual del slider
  const scaleLabel = isEfecto ? 'Severidad' : 'Nivel'

  function onSlide(v: number) {
    setValue(v)
    setTouched(true)
  }

  function handleSave() {
    dispatch({ t: 'saveMeasure', name, value, nota: isEfecto && nota.trim() ? nota.trim() : undefined })
    dispatch({ t: 'sheet', sheet: null })
  }

  return (
    <Sheet
      title={name}
      onClose={() => dispatch({ t: 'sheet', sheet: null })}
    >
      <div
        style={{
          padding: '0 20px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Valor actual + etiqueta cualitativa */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          style={{ textAlign: 'center', paddingTop: 8 }}
        >
          <span
            className="mono"
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--brand-700)',
              display: 'block',
            }}
          >
            {value}
          </span>
          <span
            className="sm"
            style={{
              display: 'inline-block',
              marginTop: 6,
              padding: '3px 12px',
              borderRadius: 99,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--ink-700)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {qual}
          </span>
        </motion.div>

        {/* Slider principal */}
        <section>
          <p
            className="label"
            style={{ marginBottom: 12, textAlign: 'center', color: 'var(--ink-400)' }}
          >
            {scaleLabel} · <span className="mono">1</span> — <span className="mono">{maxVal}</span>
          </p>

          {/* Wrapper para el track de color personalizado */}
          <div style={{ position: 'relative' }}>
            {/* Track background (simulado debajo del range nativo) */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                transform: 'translateY(-50%)',
                height: 10,
                borderRadius: 5,
                background: `linear-gradient(to right, var(--brand-700) ${fillPct}%, var(--ink-100) ${fillPct}%)`,
                pointerEvents: 'none',
              }}
            />
            <input
              type="range"
              min={1}
              max={maxVal}
              step={1}
              value={value}
              onChange={(e) => onSlide(Number(e.target.value))}
              aria-label={`${scaleLabel} de ${name}, valor ${value}`}
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
                width: '100%',
                height: 44,
                background: 'transparent',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 1,
                /* thumb */
                /* CSS nativo no admite ::-webkit-slider-thumb inline, se cubre con style global si existe */
              }}
            />
          </div>

          {/* Extremos de escala */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
            }}
          >
            <span className="sm" style={{ color: 'var(--ink-400)' }}>
              {isEfecto ? 'Leve' : 'Bajo'}
            </span>
            <span className="sm" style={{ color: 'var(--ink-400)' }}>
              {isEfecto ? 'Severo' : 'Alto'}
            </span>
          </div>
        </section>

        {/* Nota opcional — solo para "Efecto secundario" */}
        {isEfecto && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>
              Nota (opcional)
            </p>
            <textarea
              className="field"
              rows={3}
              placeholder="Describe el efecto secundario observado…"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              style={{
                width: '100%',
                resize: 'vertical',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 15,
                borderRadius: 10,
                padding: '10px 14px',
                background: 'var(--card)',
                border: '1.5px solid var(--border)',
                color: 'var(--ink-900)',
                boxSizing: 'border-box',
              }}
              aria-label="Nota sobre el efecto secundario"
            />
          </section>
        )}

        {/* CTA */}
        <button
          className="btn btn-brand"
          onClick={handleSave}
          disabled={!touched}
          style={{ marginTop: 4, opacity: touched ? 1 : 0.45, cursor: touched ? 'pointer' : 'not-allowed' }}
        >
          {touched ? 'Guardar' : 'Mueve para elegir tu valor'}
        </button>

        {/* Disclaimer — siempre visible (no reducir instancias) */}
        <Disclaimer kind="measure" />
      </div>
    </Sheet>
  )
}
