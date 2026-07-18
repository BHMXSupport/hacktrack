/**
 * Baseline.tsx — v2 flow
 *
 * Biométricos de onboarding: peso actual, meta de peso, altura, % grasa.
 * Estética "Bitácora": campos como placas de registro (numerales serif),
 * folio editorial de paso. Todos opcionales. Avanza con setBaseline → go 's-measures'.
 * Atrás → 's-goal'.
 *
 * ScreenId: 's-baseline'
 * Dispatch:
 *   { t: 'setBaseline', peso?, metaPesoKg?, est? }
 *   { t: 'go', screen: 's-measures' }
 */
import { useState, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Scale, Ruler, Target, Info, Percent } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Button } from '../ui/Button'
import { FolioLabel } from '../ui/FolioLabel'
import { fadeUp } from '../lib/motion'

// ── Subcomponente: campo numérico (placa de registro editorial) ───────────────

function NumericField({
  id,
  label,
  icon: Icon,
  placeholder,
  unit,
  min,
  max,
  value,
  onChange,
  optional = true,
  error,
}: {
  id: string
  label: string
  icon: React.ElementType
  placeholder: string
  unit: string
  min: number
  max: number
  value: string
  onChange: (v: string) => void
  optional?: boolean
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
        <Icon size={14} className="text-blue" aria-hidden="true" />
        {label}
        {optional && <span className="ml-auto text-[12px] font-normal text-ink-3">opcional</span>}
      </label>
      <div className="relative">
        {/* Numeral serif tabular — el registro se ve compuesto, no clínico */}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          placeholder={placeholder}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-14 w-full rounded-[10px] border bg-surface px-4 pr-14 font-serif text-[24px] font-normal tabular-nums text-ink placeholder:font-sans placeholder:text-[16px] placeholder:font-normal placeholder:text-ink-3 focus:outline-none transition-[border-color,box-shadow] ${error ? 'border-alert focus:border-alert focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--alert)_18%,transparent)]' : 'border-hairline focus:border-blue focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_18%,transparent)]'}`}
        />
        {/* Unidad en mono — el "instrumento" */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[12px] font-medium text-ink-2"
        >
          {unit}
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-alert">
          {error}
        </p>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

// Validación de rangos
function validateField(val: string, min: number, max: number): string | undefined {
  if (!val) return undefined // campo vacío = omitido, siempre válido
  const n = parseFloat(val)
  if (isNaN(n) || n < min || n > max) return `Debe estar entre ${min} y ${max}`
  return undefined
}

export function Baseline() {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()

  const [peso, setPeso] = useState('')
  const [meta, setMeta] = useState('')
  const [est, setEst] = useState('')
  const [grasa, setGrasa] = useState('')

  // Errores inline (undefined = sin error)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  const uid = useId()

  function handleContinuar() {
    const newErrors = {
      peso: validateField(peso, 20, 300),
      meta: validateField(meta, 20, 300),
      est: validateField(est, 100, 250),
      grasa: validateField(grasa, 1, 60),
    }
    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    dispatch({
      t: 'setBaseline',
      peso: peso ? parseFloat(peso) : undefined,
      metaPesoKg: meta ? parseFloat(meta) : undefined,
      est: est ? parseFloat(est) : undefined,
    })
    // % grasa: saveMedidas lo guarda en profile.grasa + history['% grasa'] (setBaseline no lo acepta)
    if (grasa) {
      dispatch({ t: 'saveMedidas', values: { grasa: parseFloat(grasa) } })
    }
    dispatch({ t: 'go', screen: 's-measures' })
  }

  // IMC preview (solo si peso y est están rellenos y son válidos)
  const pesoN = parseFloat(peso)
  const estN = parseFloat(est)
  const bmi =
    pesoN >= 20 && pesoN <= 300 && estN >= 100 && estN <= 250
      ? (pesoN / ((estN / 100) * (estN / 100))).toFixed(1)
      : null

  return (
    <div
      className="relative z-10 flex h-full flex-col overflow-y-auto"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      {/* App bar — folio editorial */}
      <header
        className="flex flex-shrink-0 items-center gap-4 px-4"
        style={{
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <button
          aria-label="Atrás"
          onClick={() => dispatch({ t: 'go', screen: 's-goal' })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="flex flex-1 flex-col gap-1.5">
          <FolioLabel n={2}>Paso 2 de 5</FolioLabel>
          <div className="h-1 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={2} aria-valuemin={1} aria-valuemax={5} aria-label="Paso 2 de 5">
            <div className="h-full w-[40%] rounded-full bg-blue" />
          </div>
        </div>

        <div className="w-11" />
      </header>

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        className="flex flex-1 flex-col gap-6 px-5 pt-2"
      >
        {/* Título serif */}
        <motion.div variants={fadeUp}>
          <h1 className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
            Cuéntame sobre ti
          </h1>
          <p className="mt-2 text-[14px] text-ink-2">
            Solo para personalizar tu experiencia. Puedes omitir cualquier campo.
          </p>
        </motion.div>

        {/* Campos */}
        <motion.div variants={fadeUp} className="flex flex-col gap-4">
          <NumericField
            id={`${uid}-peso`}
            label="Peso actual"
            icon={Scale}
            placeholder="ej. 78"
            unit="kg"
            min={20}
            max={300}
            value={peso}
            onChange={(v) => { setPeso(v); setErrors((e) => ({ ...e, peso: undefined })) }}
            error={errors.peso}
          />
          <NumericField
            id={`${uid}-meta`}
            label="Meta de peso"
            icon={Target}
            placeholder="ej. 70"
            unit="kg"
            min={20}
            max={300}
            value={meta}
            onChange={(v) => { setMeta(v); setErrors((e) => ({ ...e, meta: undefined })) }}
            error={errors.meta}
          />
          <NumericField
            id={`${uid}-est`}
            label="Altura"
            icon={Ruler}
            placeholder="ej. 170"
            unit="cm"
            min={100}
            max={250}
            value={est}
            onChange={(v) => { setEst(v); setErrors((e) => ({ ...e, est: undefined })) }}
            error={errors.est}
          />
          <NumericField
            id={`${uid}-grasa`}
            label="% grasa"
            icon={Percent}
            placeholder="ej. 20"
            unit="%"
            min={1}
            max={60}
            value={grasa}
            onChange={(v) => { setGrasa(v); setErrors((e) => ({ ...e, grasa: undefined })) }}
            error={errors.grasa}
          />
          <p className="-mt-2 text-[12px] leading-relaxed text-ink-2">¿No tienes báscula de bioimpedancia? Omítelo — puedes registrarlo después desde Cambio de medidas.</p>
        </motion.div>

        {/* IMC preview — nota impresa con numeral serif */}
        {bmi && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex items-center gap-3 rounded-sm border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(26,23,18,.05)]">
              <Info size={14} className="flex-shrink-0 text-blue" aria-hidden="true" />
              <p className="text-[13px] text-ink">
                IMC estimado:{' '}
                <span className="font-serif text-[17px] font-normal tabular-nums text-ink">{bmi}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <motion.div variants={fadeUp}>
          <p className="text-[12px] leading-relaxed text-ink-2">
            Hacktrack es una herramienta de seguimiento personal. No reemplaza consejo médico.
          </p>
        </motion.div>

        {/* CTA — sin "usar valores recomendados": son datos personales (peso/altura/%). Los campos son
            opcionales, así que Continuar procede aunque los dejes vacíos. */}
        <motion.div variants={fadeUp} className="mt-auto flex flex-col gap-2">
          <Button
            size="full"
            onClick={handleContinuar}
            aria-label="Guardar mis datos biométricos y continuar"
          >
            Continuar
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
