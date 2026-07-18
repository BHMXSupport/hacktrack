// DoseConfirmSheet v2 — confirmación rápida / backfill de dosis
// Design system "Bitácora" (papel-y-tinta editorial): resumen serif del producto,
// cantidades como "tu registro", ruedas de hora en mono con banda azul-tinta.
// Prop `arg`: string|null — producto a confirmar (parseado desde sheetArg).
// Flujo: paso 1 → elige hora + nota libre; paso 2 → efecto/síntoma opcional.
// Dispatch: logDose con ts elegido, note, effect.
// Compliance: sin jeringas, sin claims médicos, dato observacional.
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { EFFECT_OPTIONS } from '../../lib/catalog'
import { fmtTime } from '../../lib/cadence'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'

// ── Clases compartidas "Bitácora" (solo presentación) ─────────────────────────
const KICKER = 'font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2'
// Campo cálido; foco azul-tinta (color-mix porque el alfa sobre var() no se emite en este setup).
const FIELD =
  'rounded-[8px] border border-hairline bg-raised px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-2 focus:ring-[color-mix(in_srgb,var(--blue)_30%,transparent)]'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Payload {
  product: string
  value: number | null
  unit: string
  doseMg?: number
  scheduledTs: number
  nowTs: number
  suggestedSite?: import('../../lib/types').InjectionSite
}

type Step = 'time' | 'effect'
type TimeMode = 'preset' | 'wheel'

// ── TimeWheel inline ligero (mismo patrón que RegistrarSheet v2) ───────────────

const ITEM_H = 40
const HOURS  = Array.from({ length: 12 }, (_, i) => i + 1)
const MINS5  = Array.from({ length: 12 }, (_, i) => i * 5)
const APS    = ['AM', 'PM']
// El "instrumento" va en mono (JetBrains) — ítem activo azul-tinta, inactivos en tinta terciaria.
const WHEEL_MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"

function WheelCol({
  items,
  index,
  onIndex,
  fmt,
  label,
}: {
  items: (number | string)[]
  index: number
  onIndex: (i: number) => void
  fmt?: (v: number | string) => string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
      if (i !== index) onIndex(i)
    })
  }

  function goTo(i: number) {
    const c = Math.max(0, Math.min(items.length - 1, i))
    if (ref.current) ref.current.scrollTop = c * ITEM_H
    if (c !== index) onIndex(c)
  }

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={items.length - 1}
      aria-valuenow={index}
      aria-valuetext={String(fmt ? fmt(items[index]) : items[index])}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); goTo(index + 1) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(index - 1) }
        else if (e.key === 'Home') { e.preventDefault(); goTo(0) }
        else if (e.key === 'End') { e.preventDefault(); goTo(items.length - 1) }
      }}
      className="flex-1 overflow-y-auto text-center"
      style={{
        height: ITEM_H * 3,
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        borderRadius: 8,
      }}
    >
      <div style={{ height: ITEM_H }} aria-hidden />
      {items.map((v, i) => (
        <div
          key={String(v)}
          style={{
            height: ITEM_H,
            lineHeight: `${ITEM_H}px`,
            scrollSnapAlign: 'center',
            fontFamily: WHEEL_MONO,
            fontVariantNumeric: 'tabular-nums',
            fontSize: i === index ? 20 : 15,
            fontWeight: i === index ? 600 : 400,
            color: i === index ? 'var(--blue)' : 'var(--ink-3)',
            transition: 'font-size .1s, color .1s',
          }}
        >
          {fmt ? fmt(v) : v}
        </div>
      ))}
      <div style={{ height: ITEM_H }} aria-hidden />
    </div>
  )
}

function TimeWheelInline({ nowTs, onChange }: { nowTs: number; onChange: (ts: number) => void }) {
  const base = new Date(nowTs)
  const h24 = base.getHours()
  const [hi, setHi] = useState(((h24 % 12) || 12) - 1)
  const [mi, setMi] = useState(Math.round(base.getMinutes() / 5) % 12)
  const [ai, setAi] = useState(h24 >= 12 ? 1 : 0)

  useEffect(() => {
    const h = HOURS[hi]
    let hour = h % 12
    if (ai === 1) hour += 12
    const d = new Date(nowTs)
    d.setHours(hour, MINS5[mi], 0, 0)
    onChange(d.getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hi, mi, ai])

  return (
    <div className="relative flex gap-1 rounded-sm border border-hairline bg-raised px-3">
      {/* banda de selección — azul-tinta (interactivo), theme-aware vía color-mix */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-2"
        style={{
          top: ITEM_H,
          height: ITEM_H,
          borderTop: '1px solid color-mix(in srgb, var(--blue) 35%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--blue) 35%, transparent)',
        }}
      />
      <WheelCol items={HOURS} index={hi} onIndex={setHi} label="Hora" />
      <div
        className="self-center text-ink-3"
        style={{ lineHeight: `${ITEM_H * 3}px`, fontFamily: WHEEL_MONO, fontWeight: 600 }}
      >
        :
      </div>
      <WheelCol
        items={MINS5}
        index={mi}
        onIndex={setMi}
        fmt={(v) => String(v).padStart(2, '0')}
        label="Minutos"
      />
      <WheelCol items={APS} index={ai} onIndex={setAi} label="AM o PM" />
    </div>
  )
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function DoseConfirmSheet({
  open,
  onClose,
  arg,
}: {
  open: boolean
  onClose: () => void
  arg?: string | null
}) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Parsear payload desde arg (JSON) o tratar arg como nombre de producto
  let payload: Payload | null = null
  if (arg) {
    try {
      payload = JSON.parse(arg) as Payload
    } catch {
      // arg es el nombre del producto directamente
      const nowTs = Date.now()
      payload = {
        product: arg,
        value: null,
        unit: 'mg',
        scheduledTs: nowTs,
        nowTs,
      }
    }
  }

  const { product, value, unit, doseMg, scheduledTs, nowTs, suggestedSite } = payload ?? {
    product: '',
    value: null,
    unit: 'mg',
    scheduledTs: Date.now(),
    nowTs: Date.now(),
    suggestedSite: undefined,
  }

  // ── Estado ────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('time')
  const [timeMode, setTimeMode] = useState<TimeMode>('preset')
  const [chosenTs, setChosenTs] = useState<number | null>(null)
  const [wheelTs, setWheelTs] = useState<number>(nowTs)
  const [note, setNote] = useState('')
  const [effect, setEffect] = useState<string | undefined>(undefined)
  const [customEffect, setCustomEffect] = useState('')
  const [showCustomEffect, setShowCustomEffect] = useState(false)
  const [effectIntensity, setEffectIntensity] = useState(60) // intensidad 0–100 del efecto

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setStep('time')
      setTimeMode('preset')
      setChosenTs(null)
      setWheelTs(nowTs)
      setNote('')
      setEffect(undefined)
      setCustomEffect('')
      setShowCustomEffect(false)
      setEffectIntensity(60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function logWithTime(ts: number) {
    const rawNote = note.trim().slice(0, 120) || undefined
    dispatch({
      t: 'logDose',
      product,
      value,
      unit,
      ts,
      doseMg,
      site: suggestedSite,
      note: rawNote,
      keepSheet: true,
    })
    setChosenTs(ts)
    setStep('effect')
  }

  function commitEffect(eff: string, intensity?: number) {
    // #31: buscar la dosis con |ts - chosenTs| mínimo para este producto;
    // si chosenTs es null, tomar la más reciente. Así evitamos taggear la primera dosis del historial.
    let itemId: string | undefined
    let bestDelta = Infinity
    for (const g of state.log) {
      for (const it of g.items) {
        if (it.type !== 'dose' || it.product !== product) continue
        const delta = chosenTs != null ? Math.abs(it.ts - chosenTs) : 0
        if (delta < bestDelta) {
          bestDelta = delta
          itemId = it.id
        }
      }
    }
    if (itemId) dispatch({ t: 'setLogEffect', id: itemId, effect: eff, effectIntensity: intensity })
    onClose()
  }

  // ── Puntualidad — true si |ahora - programada| ≤ 30 min ─────────────────────
  const isPunctual = Math.abs(nowTs - scheduledTs) <= 30 * 60 * 1000

  // ── Render ────────────────────────────────────────────────────────────────────

  const slideProps = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: -14 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, x: 0 },
    exit:    reduce ? { opacity: 0 } : { opacity: 0, x: 14 },
    transition: { duration: 0.18 },
  }

  // Botones de hora (60px): rectángulo de imprenta radio 8; el primario azul-tinta con sombra
  // susurro (sin glow — el ámbar es del anillo, no del botón); alternativo = contorno azul + tinte.
  const btnRow = 'flex h-[60px] w-full flex-col items-center justify-center gap-0.5 rounded-[8px] font-semibold transition-all active:scale-[.98]'
  const btnPri = 'bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(26,23,18,.20)]'
  const btnAlt = 'border border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] text-blue'

  const stepSubtitle =
    step === 'time'
      ? isPunctual
        ? 'Confirmar hora'
        : 'Hora de inyección'
      : '¿Cómo te sientes?'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Confirmar dosis"
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === 'time' ? (
          <motion.div key="step-time" {...slideProps} className="flex flex-col gap-4">

            {/* Subtítulo del paso */}
            <p className={KICKER}>
              {stepSubtitle}
            </p>

            {/* Resumen serif — el producto es la voz (Fraunces); la cantidad, "tu registro" en mono */}
            <div className="flex flex-col gap-1">
              <span className="font-serif text-[24px] font-normal leading-tight text-ink">{product}</span>
              {value != null && (
                <span className="font-mono text-[13px] tabular-nums text-ink-2">{value} {unit} · tu registro</span>
              )}
              {!isPunctual && (
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
                  Tu hora programada no coincide con la actual — ¿cuándo te la aplicaste?
                </p>
              )}
            </div>

            {/* Nota opcional */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink-2" htmlFor="dc-note">
                Nota opcional
              </label>
              <input
                id="dc-note"
                type="text"
                maxLength={120}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ej: abdomen, náusea leve, energía…"
                aria-label="Nota de la dosis (máx. 120 caracteres)"
                className={`h-11 w-full ${FIELD}`}
              />
              {note.length > 100 && (
                <span className="text-right font-mono text-[12px] tabular-nums text-ink-2">{note.length}/120</span>
              )}
            </div>

            {/* Toggle modo hora */}
            <div className="flex justify-center gap-2">
              <Chip
                active={timeMode === 'preset'}
                onClick={() => setTimeMode('preset')}
              >
                Presets
              </Chip>
              <Chip
                active={timeMode === 'wheel'}
                onClick={() => setTimeMode('wheel')}
              >
                Hora exacta
              </Chip>
            </div>

            {/* Contenido del modo */}
            <AnimatePresence mode="wait" initial={false}>
              {timeMode === 'preset' ? (
                <motion.div
                  key="presets"
                  initial={reduce ? { opacity: 0 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="flex flex-col gap-3"
                >
                  <button
                    type="button"
                    className={`${btnRow} ${isPunctual ? btnPri : btnAlt}`}
                    onClick={() => logWithTime(nowTs)}
                  >
                    <span className="text-[16px]">Ahora mismo</span>
                    <span className="font-mono text-[12px] tabular-nums opacity-80">{fmtTime(new Date(nowTs))}</span>
                  </button>
                  {!isPunctual && (
                    <button
                      type="button"
                      className={`${btnRow} ${btnPri}`}
                      onClick={() => logWithTime(scheduledTs)}
                    >
                      <span className="text-[16px]">A mi hora programada</span>
                      <span className="font-mono text-[12px] tabular-nums opacity-80">{fmtTime(new Date(scheduledTs))}</span>
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="wheel"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-3"
                >
                  <TimeWheelInline
                    nowTs={nowTs}
                    onChange={(ts) => setWheelTs(ts)}
                  />
                  <button
                    type="button"
                    className={`${btnRow} ${btnPri}`}
                    onClick={() => logWithTime(wheelTs)}
                  >
                    <span className="text-[16px]">
                      Confirmar a las{' '}
                      {(() => {
                        const d = new Date(wheelTs)
                        return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
                      })()}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        ) : (
          <motion.div key="step-effect" {...slideProps} className="flex flex-col gap-4">

            {/* Cabecera del paso (el cierre vive en el header del Sheet) */}
            <p className={KICKER}>{stepSubtitle}</p>

            <p className="text-[15px] text-ink">
              Dosis registrada.{' '}
              <span className="text-ink-2">¿Cómo te sientes?</span>
            </p>
            <p className="-mt-2 text-[12px] text-ink-2">
              Dato personal observacional — no es una promesa de resultado.
            </p>

            <div className="flex flex-wrap gap-2">
              {EFFECT_OPTIONS.filter((o) => o !== 'Otro').map((opt) => (
                <Chip
                  key={opt}
                  active={effect === opt}
                  onClick={() => {
                    // "Sin efectos" no tiene intensidad → commitea directo, sin slider
                    if (opt === 'Sin efectos') { commitEffect(opt); return }
                    setEffect(effect === opt ? undefined : opt)
                    setShowCustomEffect(false)
                  }}
                >
                  {opt}
                </Chip>
              ))}
              <Chip
                active={showCustomEffect}
                onClick={() => { setShowCustomEffect((v) => !v); setEffect(undefined) }}
              >
                Otro
              </Chip>
            </div>

            {/* Slider de intensidad + Guardar — al elegir un efecto de la lista (no en "Sin efectos") */}
            {effect && effect !== 'Sin efectos' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-[12px] text-ink-2">Intensidad</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={effectIntensity}
                    onChange={(e) => setEffectIntensity(Number(e.target.value))}
                    aria-label="Intensidad del efecto, de 0 a 100"
                    className="h-1.5 flex-1 cursor-pointer accent-blue"
                  />
                  <span className="w-7 text-right font-mono text-[13px] font-semibold tabular-nums text-blue">{effectIntensity}</span>
                </div>
                <Button variant="primary" size="full" onClick={() => commitEffect(effect, effectIntensity)}>
                  Guardar
                </Button>
              </div>
            )}

            <AnimatePresence initial={false}>
              {showCustomEffect && (
                <motion.div
                  key="otro"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      maxLength={80}
                      value={customEffect}
                      onChange={(e) => setCustomEffect(e.target.value)}
                      placeholder="Describe cómo te sientes…"
                      aria-label="Efecto personalizado"
                      autoFocus
                      className={`h-11 w-full ${FIELD}`}
                    />
                    {customEffect.trim() && (
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 text-[12px] text-ink-2">Intensidad</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={effectIntensity}
                          onChange={(e) => setEffectIntensity(Number(e.target.value))}
                          aria-label="Intensidad del efecto, de 0 a 100"
                          className="h-1.5 flex-1 cursor-pointer accent-blue"
                        />
                        <span className="w-7 text-right font-mono text-[13px] font-semibold tabular-nums text-blue">{effectIntensity}</span>
                      </div>
                    )}
                    <Button
                      variant="primary"
                      size="full"
                      disabled={!customEffect.trim()}
                      onClick={() => { if (customEffect.trim()) commitEffect(customEffect.trim(), effectIntensity) }}
                    >
                      Guardar
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}
