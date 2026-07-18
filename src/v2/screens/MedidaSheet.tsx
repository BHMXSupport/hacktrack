// MedidaSheet v2 — design system "Bitácora" (papel-y-tinta editorial)
// Registra un KPI/medida (escala 1–100 o numérica).
// Si `measure` es null/undefined, muestra selector para elegir cuál registrar.
// Compliance: sin claims médicos, privacidad local, es-MX.
import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { useApp } from '../../lib/store'
import { KPIS, MEASURE_META } from '../../lib/catalog'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { DataPlate } from '../ui/DataPlate'
import { StatNumber } from '../ui/StatNumber'

// ── Clases compartidas "Bitácora" (solo presentación) ─────────────────────────
// Kicker de sección: mono 12 UPPER (piso de label) sobre tinta secundaria (AA).
const KICKER = 'font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2'
// Campo cálido: pozo de papel + hairline; foco azul-tinta (color-mix: el alfa sobre var() no se emite).
const FIELD =
  'rounded-[8px] border border-hairline bg-raised px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-2 focus:ring-[color-mix(in_srgb,var(--blue)_30%,transparent)]'

// ── Etiquetas semánticas por KPI (5 niveles) ─────────────────────────────────

const SCALE_LABELS: Record<string, [string, string, string, string, string]> = {
  'Energía':                ['Sin energía',    'Baja',       'Normal',    'Buena',     'Lleno de energía'],
  'Estado de ánimo':        ['Muy bajo',       'Bajo',       'Estable',   'Bueno',     'Excelente'],
  'Sueño':                  ['Pésimo',         'Mal',        'Regular',   'Bien',      'Descansado'],
  'Dolor':                  ['Sin dolor',      'Leve',       'Moderado',  'Intenso',   'Severo'],
  'Foco':                   ['Sin foco',       'Poco',       'Normal',    'Claro',     'Concentrado'],
  'Libido':                 ['Nulo',           'Bajo',       'Normal',    'Alto',      'Muy alto'],
  'Elasticidad piel':       ['Sin mejora',     'Poca',       'Moderada',  'Buena',     'Excelente'],
  'Recuperación muscular':  ['Sin recuperar',  'Lenta',      'Normal',    'Rápida',    'Completa'],
  'Efecto secundario':      ['Sin efecto',     'Leve',       'Moderado',  'Fuerte',    'Severo'],
  'Saciedad':               ['Hambre',         'Algo',       'Normal',    'Satisfecho','Sin hambre'],
  'Náusea':                 ['Sin náusea',     'Leve',       'Moderada',  'Fuerte',    'Intensa'],
  'Inflamación':            ['Sin inflamación','Leve',       'Moderada',  'Notable',   'Severa'],
  'Niebla mental':          ['Clara',          'Leve niebla','Moderada',  'Bastante',  'Mucha niebla'],
  'Ansiedad':               ['Tranquilo',      'Leve',       'Moderada',  'Alta',      'Intensa'],
  'Memoria':                ['Muy difícil',    'Costosa',    'Normal',    'Buena',     'Excelente'],
  'Fuerza percibida':       ['Muy débil',      'Débil',      'Normal',    'Fuerte',    'Muy fuerte'],
}

const DEFAULT_LABELS: [string, string, string, string, string] = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto']

function getLabels(name: string): [string, string, string, string, string] {
  return SCALE_LABELS[name] ?? DEFAULT_LABELS
}

// Mapeo de 5 botones rápidos a valores (uniformes en el rango 1–100)
const QUICK_VALUES = [10, 30, 50, 70, 90]

function lastMeasure(
  history: Record<string, { value: number; ts: number }[]>,
  name: string,
): { value: number; ts: number } | null {
  const arr = history[name]
  if (!arr || arr.length === 0) return null
  return arr[arr.length - 1]
}

// ── Selector de KPIs disponibles (excluye "Cambio de medidas" compuesto) ──────
const SELECTABLE_KPIS = KPIS.filter((k) => k.kind === 'scale')

// ── Componente principal ──────────────────────────────────────────────────────

export function MedidaSheet({
  open,
  onClose,
  measure,
}: {
  open: boolean
  onClose: () => void
  measure?: string | null
}) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Si no se pasa measure, usamos sheetArg o permitimos que el usuario elija
  const resolvedMeasure = measure ?? state.sheetArg ?? null

  const [selectedName, setSelectedName] = useState<string | null>(resolvedMeasure)
  const [showSelector, setShowSelector] = useState(!resolvedMeasure)

  // Sincronizar cuando cambia el prop o el sheetArg
  useEffect(() => {
    const m = measure ?? state.sheetArg ?? null
    setSelectedName(m)
    setShowSelector(!m)
  }, [measure, state.sheetArg])

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setSelectedName(resolvedMeasure)
      setShowSelector(!resolvedMeasure)
      setTouched(false)
      setNumStr('')
      setScaleNumStr('')
      setValue(50)
      setNota('')
      setInputMode('buttons')
      setRangeError(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const name = selectedName ?? ''
  const meta = MEASURE_META[name]
  const maxVal = meta?.max ?? 100
  const isNum = meta?.kind === 'num'

  // ── Estado compartido ──────────────────────────────────────────────────────
  const [value, setValue] = useState<number>(Math.round(maxVal / 2))
  const [touched, setTouched] = useState(false)
  const [nota, setNota] = useState('')

  // ── Modo de entrada (escalas) ──────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<'buttons' | 'stepper'>('buttons')

  // ── Numéricas ──────────────────────────────────────────────────────────────
  const [numStr, setNumStr] = useState('')
  const [scaleNumStr, setScaleNumStr] = useState('')

  const prevMeasure = name ? lastMeasure(state.history as Record<string, { value: number; ts: number }[]>, name) : null
  const labels = name ? getLabels(name) : DEFAULT_LABELS

  // ── Delta feedback al guardar ──────────────────────────────────────────────
  const [savedDelta, setSavedDelta] = useState<string | null>(null)
  const [rangeError, setRangeError] = useState(false)

  function computeDelta(v: number): string | null {
    if (prevMeasure == null) return null
    const delta = v - prevMeasure.value
    if (delta === 0) return 'Sin cambio vs. anterior'
    const sign = delta > 0 ? '+' : ''
    const isGood = meta?.down ? delta < 0 : delta > 0
    const dir = isGood ? '↑ mejor' : '↓ peor'
    return `${sign}${delta.toFixed(delta % 1 === 0 ? 0 : 1)} vs. anterior · ${dir}`
  }

  // ── Stepper para escalas ───────────────────────────────────────────────────
  function stepValue(delta: number) {
    setValue((v) => {
      const next = Math.min(maxVal, Math.max(1, v + delta))
      setTouched(true)
      return next
    })
  }

  // ── Topes máximos para medidas numéricas (sin campo max en MEASURE_META) ──
  const NUM_MAX: Record<string, number> = {
    'Peso':           300,   // kg
    'Altura':         250,   // cm
    'Cintura':        200,   // cm
    '% grasa':        70,    // %
    '% músculo':      70,    // %
    'IMC':            70,
    'Glucosa ayunas': 600,   // mg/dL
    'Frecuencia sexual': 99, // /sem
  }

  function numMaxFor(n: string): number {
    return NUM_MAX[n] ?? 9999
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!name) {
      setShowSelector(true)
      return
    }

    if (isNum) {
      const v = parseFloat(numStr)
      if (isNaN(v) || v < 0) return
      const maxAllowed = numMaxFor(name)
      if (v > maxAllowed) {
        setRangeError(true)
        setTimeout(() => setRangeError(false), 2200)
        return
      }
      setRangeError(false)
      const delta = computeDelta(v)
      dispatch({ t: 'saveMeasure', name, value: v, nota: nota.trim() || undefined })
      if (delta) {
        setSavedDelta(delta)
        setTimeout(() => { setSavedDelta(null); onClose() }, 1800)
      } else if (prevMeasure == null) {
        setSavedDelta('Primera medida · punto de partida')
        setTimeout(() => { setSavedDelta(null); onClose() }, 1800)
      } else {
        onClose()
      }
    } else {
      if (!touched) return
      const delta = computeDelta(value)
      dispatch({ t: 'saveMeasure', name, value, nota: nota.trim() || undefined })
      if (delta) {
        setSavedDelta(delta)
        setTimeout(() => { setSavedDelta(null); onClose() }, 1800)
      } else if (prevMeasure == null) {
        setSavedDelta('Primera medida · punto de partida')
        setTimeout(() => { setSavedDelta(null); onClose() }, 1800)
      } else {
        onClose()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, isNum, numStr, nota, touched, value, dispatch, onClose])

  // ── Validación CTA ────────────────────────────────────────────────────────
  const numValid = isNum && numStr.trim() !== '' && !isNaN(parseFloat(numStr)) && parseFloat(numStr) >= 0
  const scaleValid = !isNum && touched
  const canSave = !!name && (isNum ? numValid : scaleValid)

  const sheetTitle = name ? name : 'Registrar medida'

  return (
    <Sheet open={open} onClose={onClose} title={sheetTitle}>
      <div className="flex flex-col gap-5">

        {/* ── Selector de KPI ── */}
        {(!name || showSelector) && (
          <div className="flex flex-col gap-3">
            <p className={KICKER}>
              ¿Qué deseas registrar?
            </p>
            <div className="flex flex-wrap gap-2">
              {SELECTABLE_KPIS.map((k) => (
                <Chip
                  key={k.key}
                  active={selectedName === k.key}
                  onClick={() => {
                    setSelectedName(k.key)
                    setShowSelector(false)
                    setTouched(false)
                    setValue(50)
                    setNota('')
                    setInputMode('buttons')
                  }}
                >
                  {k.label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* ── Si ya hay nombre seleccionado, mostrar el formulario ── */}
        {name && !showSelector && (
          <>
            {/* Botón para cambiar de medida — el nombre en SERIF (la voz editorial) */}
            <button
              type="button"
              onClick={() => { setShowSelector(true); setInputMode('buttons') }}
              className="flex min-h-[44px] items-center justify-between rounded-[8px] border border-hairline bg-raised px-4 py-3 text-left active:scale-[.99]"
            >
              <span className="font-serif text-[19px] leading-tight text-ink">{name}</span>
              <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-blue">Cambiar</span>
            </button>

            {/* Último valor registrado */}
            {prevMeasure && (
              <p className="text-[13px] text-ink-2">
                Último: <span className="font-mono font-semibold tabular-nums text-ink">
                  {prevMeasure.value}{meta?.unit ? ` ${meta.unit}` : ''}
                </span>
              </p>
            )}

            {/* ── NUMÉRICA ── */}
            {isNum ? (
              <div className="flex flex-col gap-3">
                <p className={KICKER}>
                  Valor{meta?.unit ? ` (${meta.unit})` : ''}
                </p>
                <Stepper
                  onDec={() => {
                    const cur = parseFloat(numStr) || 0
                    const step = meta?.unit === 'kg' ? 0.1 : (name === 'Cintura' || name === 'Altura' ? 0.5 : 1)
                    const next = Math.max(0, parseFloat((cur - step).toFixed(2)))
                    setNumStr(String(next))
                  }}
                  onInc={() => {
                    const cur = parseFloat(numStr) || 0
                    const step = meta?.unit === 'kg' ? 0.1 : (name === 'Cintura' || name === 'Altura' ? 0.5 : 1)
                    const next = parseFloat((cur + step).toFixed(2))
                    setNumStr(String(next))
                  }}
                  decLabel={`Disminuir ${name}`}
                  incLabel={`Aumentar ${name}`}
                >
                  <DataPlate className="flex items-center justify-center px-4 py-5">
                    {/* Numeral SERIF de instrumento (Fraunces, peso 400) — hereda el blanco cálido de la placa. */}
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Valor de ${name}${meta?.unit ? ` en ${meta.unit}` : ''}`}
                      placeholder="—"
                      value={numStr}
                      onChange={(e) => {
                        const v = e.target.value.replace(',', '.')
                        if (/^\d*\.?\d*$/.test(v)) setNumStr(v)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                      autoFocus
                      className="w-full bg-transparent text-center font-serif text-[42px] font-normal tabular-nums tracking-[-0.02em] placeholder:text-[#8A8272] focus:outline-none"
                    />
                  </DataPlate>
                </Stepper>
                {meta?.unit && (
                  <p className="text-center font-mono text-[13px] text-ink-2">{meta.unit}</p>
                )}
              </div>
            ) : (
              /* ── ESCALA 1–100 ── */
              <div className="flex flex-col gap-4">
                {/* Numeral hero serif con count-up (StatNumber) + etiqueta semántica */}
                <motion.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2 py-2"
                >
                  <StatNumber value={value} decimals={0} size={64} unit={`/ ${maxVal}`} align="center" />
                  <AnimatePresence>
                    {touched && (
                      <motion.span
                        key={Math.floor(value / 20)}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-full border border-hairline bg-raised px-3 py-1 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2"
                      >
                        {(() => {
                          const qi = QUICK_VALUES.indexOf(value)
                          const idx = inputMode === 'buttons' && qi >= 0
                            ? qi
                            : Math.min(4, Math.floor(((value - 1) / Math.max(1, maxVal - 1)) * 5))
                          return labels[Math.min(4, Math.max(0, idx))]
                        })()}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Selector de modo de entrada */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setInputMode((m) => m === 'buttons' ? 'stepper' : 'buttons')}
                    className="min-h-[44px] px-3 text-[13px] font-semibold text-blue"
                  >
                    Modo: {inputMode === 'buttons' ? '5 niveles' : 'Stepper'} · cambiar
                  </button>
                </div>

                {/* Modo botones rápidos */}
                {inputMode === 'buttons' && (
                  <div className="flex gap-2" role="group" aria-label={`Nivel de ${name}`}>
                    {QUICK_VALUES.map((v, i) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={value === v && touched}
                        onClick={() => { setValue(v); setTouched(true) }}
                        className={[
                          'flex flex-1 flex-col items-center gap-1 rounded-[8px] border py-3 transition-colors',
                          value === v && touched
                            ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] text-blue'
                            : 'border-hairline bg-raised text-ink-2',
                        ].join(' ')}
                      >
                        <span className="font-serif text-[17px] font-normal leading-none tabular-nums">{v}</span>
                        <span className="px-0.5 text-center text-[12px] font-medium leading-tight">
                          {labels[i]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Modo stepper */}
                {inputMode === 'stepper' && (
                  <Stepper
                    onDec={() => stepValue(-5)}
                    onInc={() => stepValue(5)}
                    decLabel={`Disminuir ${name} 5 puntos`}
                    incLabel={`Aumentar ${name} 5 puntos`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Valor de ${name}, 1 a ${maxVal}`}
                        value={scaleNumStr !== '' ? scaleNumStr : touched ? String(value) : ''}
                        placeholder={String(Math.round(maxVal / 2))}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '')
                          setScaleNumStr(raw)
                          const v = parseInt(raw, 10)
                          if (!isNaN(v) && v >= 1 && v <= maxVal) {
                            setValue(v)
                            setTouched(true)
                          }
                        }}
                        onBlur={() => setScaleNumStr('')}
                        className="w-20 bg-transparent text-center font-serif text-[36px] font-normal tabular-nums tracking-[-0.02em] text-ink placeholder:text-ink-3 focus:outline-none"
                      />
                      <span className="self-end pb-1 font-mono text-[13px] text-ink-2">/ {maxVal}</span>
                    </div>
                  </Stepper>
                )}
              </div>
            )}

            {/* ── Nota opcional ── */}
            <div className="flex flex-col gap-2">
              <p className={KICKER}>
                Nota <span className="font-normal normal-case tracking-normal text-ink-3">· opcional</span>
              </p>
              <textarea
                rows={2}
                maxLength={200}
                aria-label="Nota opcional sobre esta medida"
                placeholder="Observación libre sobre este registro…"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className={`w-full resize-none py-3 ${FIELD}`}
              />
            </div>

            {/* ── Recordarme medir cada N días (recordatorio periódico de ESTA medida) ── */}
            {name && (
              <div className="flex flex-col gap-2">
                <p className={KICKER}>
                  Recordarme medir <span className="font-normal normal-case tracking-normal text-ink-3">· opcional</span>
                </p>
                <div role="group" aria-label={`Recordatorio para medir ${name}`} className="flex overflow-hidden rounded-[8px] border border-hairline">
                  {([{ k: null, l: 'No' }, { k: 3, l: 'Cada 3d' }, { k: 7, l: 'Cada 7d' }, { k: 14, l: 'Cada 14d' }, { k: 30, l: 'Cada 30d' }] as const).map(({ k, l }) => {
                    const active = ((state.measureReminders?.[name] ?? null) as number | null) === k
                    return (
                      <button
                        key={String(k)}
                        type="button"
                        aria-pressed={active}
                        aria-label={k === null ? 'Sin recordatorio' : `Recordar cada ${k} días`}
                        onClick={() => dispatch({ t: 'setMeasureReminder', name, intervalDays: k })}
                        className={[
                          'h-11 flex-1 border-l border-hairline font-mono text-[12px] font-medium transition-colors first:border-l-0',
                          active ? 'bg-blue text-primary-foreground' : 'text-ink-2 hover:text-ink',
                        ].join(' ')}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[12px] leading-relaxed text-ink-2">
                  Te avisamos cuando toque volver a medir tu {name.toLowerCase()} (desde tu último registro).
                </p>
              </div>
            )}

            {/* ── Error de rango ── */}
            <AnimatePresence>
              {rangeError && (
                <motion.p
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-[13px] font-semibold text-alert"
                >
                  Valor fuera de rango — revisa el número ingresado
                </motion.p>
              )}
            </AnimatePresence>

            {/* ── Delta / primera medida feedback — chip de delta (mono, píldora, unidad incluida) ── */}
            <AnimatePresence>
              {savedDelta && (
                <motion.p
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={[
                    'mx-auto inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-[12px] font-medium tabular-nums text-ink',
                    savedDelta.includes('peor')
                      ? 'border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]'
                      : 'border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]',
                  ].join(' ')}
                >
                  {savedDelta}
                </motion.p>
              )}
            </AnimatePresence>

            {/* ── CTA ── */}
            <Button
              variant="primary"
              size="full"
              disabled={!canSave}
              onClick={handleSave}
            >
              {canSave
                ? 'Guardar'
                : isNum
                ? 'Ingresa un valor'
                : inputMode === 'buttons'
                ? 'Elige un nivel'
                : 'Ajusta el valor'}
            </Button>
          </>
        )}

        {/* ── Privacidad ── */}
        <p className="flex items-center justify-center gap-1.5 font-mono text-[12px] text-ink-2">
          <Shield size={12} className="shrink-0" />
          Tu historial se guarda solo en tu dispositivo
        </p>

      </div>
    </Sheet>
  )
}
