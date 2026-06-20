/**
 * Baseline.tsx — v2 flow
 *
 * Biométricos de onboarding: peso actual, meta de peso, altura, % grasa.
 * Todos opcionales. Avanza con setBaseline → go 's-measures'.
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

// ── Animación ─────────────────────────────────────────────────────────────────

const fade = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  },
}

// ── Subcomponente: campo numérico ─────────────────────────────────────────────

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
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary-foreground">
        <Icon size={14} className="text-teal" aria-hidden="true" />
        {label}
        {optional && <span className="ml-auto text-[11px] font-normal text-muted-foreground">opcional</span>}
      </label>
      <div className="relative">
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
          className={`h-14 w-full rounded-lg border bg-raised px-4 pr-14 text-[22px] font-bold tabular-nums text-foreground placeholder:text-[16px] placeholder:font-normal placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 transition-colors ${error ? 'border-red-400/70 focus:border-red-400/70 focus:ring-red-400/20' : 'border-white/10 focus:border-teal/60 focus:ring-teal/20'}`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-muted-foreground"
        >
          {unit}
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-red-400">
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

  function handleSaltar() {
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
      className="flex h-full flex-col bg-void overflow-y-auto"
      style={{ paddingBottom: 'max(40px, calc(32px + env(safe-area-inset-bottom)))' }}
    >
      {/* App bar */}
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Barra de progreso — paso 2 de 4 */}
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Paso 2 de 4</span>
          <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={2} aria-valuemin={1} aria-valuemax={4} aria-label="Paso 2 de 4">
            <div className="h-full w-[50%] rounded-full bg-teal" />
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
        {/* Título */}
        <motion.div variants={fade}>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Cuéntame sobre ti
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Solo para personalizar tu experiencia. Puedes omitir cualquier campo.
          </p>
        </motion.div>

        {/* Campos */}
        <motion.div variants={fade} className="flex flex-col gap-4">
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
        </motion.div>

        {/* IMC preview */}
        {bmi && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <div className="rounded-xl border border-white/10 bg-raised/80 p-4 flex items-center gap-3">
              <Info size={14} className="flex-shrink-0 text-teal" aria-hidden="true" />
              <p className="text-[13px] text-foreground">
                IMC estimado:{' '}
                <span className="font-bold tabular-nums text-foreground">{bmi}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <motion.div variants={fade}>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Hacktrack es una herramienta de seguimiento personal. No reemplaza consejo médico.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div variants={fade} className="mt-auto flex flex-col gap-2">
          <Button
            size="full"
            onClick={handleContinuar}
            aria-label="Guardar mis datos biométricos y continuar"
          >
            Continuar
          </Button>
          <Button
            size="full"
            variant="outline"
            onClick={handleSaltar}
            aria-label="Usar valores recomendados y omitir biométricos por ahora"
          >
            Usar valores recomendados
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
