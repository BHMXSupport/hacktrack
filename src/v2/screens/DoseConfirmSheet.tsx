// DoseConfirmSheet v2 — confirmación rápida / backfill de dosis
// Design system "Precision × Accessible".
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
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: i === index ? 20 : 15,
            fontWeight: i === index ? 700 : 400,
            color: i === index ? 'var(--teal, #5FC9B8)' : 'rgba(255,255,255,0.3)',
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
    <div
      className="relative flex gap-1 rounded-2xl bg-raised/60 px-3"
      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-2"
        style={{
          top: ITEM_H,
          height: ITEM_H,
          borderTop: '1px solid rgba(95,201,184,0.35)',
          borderBottom: '1px solid rgba(95,201,184,0.35)',
        }}
      />
      <WheelCol items={HOURS} index={hi} onIndex={setHi} label="Hora" />
      <div
        className="self-center text-muted-foreground"
        style={{ lineHeight: `${ITEM_H * 3}px`, fontFamily: 'monospace', fontWeight: 700 }}
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

  function commitEffect(eff: string) {
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
    if (itemId) dispatch({ t: 'setLogEffect', id: itemId, effect: eff })
    onClose()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const slideProps = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: -14 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, x: 0 },
    exit:    reduce ? { opacity: 0 } : { opacity: 0, x: 14 },
    transition: { duration: 0.18 },
  }

  const btnRow = 'flex h-[60px] w-full flex-col items-center justify-center gap-0.5 rounded-xl font-semibold transition-all active:scale-[.98]'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === 'time' ? '¿A qué hora?' : '¿Cómo te sientes?'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === 'time' ? (
          <motion.div key="step-time" {...slideProps} className="flex flex-col gap-4">

            {/* Descripción */}
            <p className="text-[14px] text-foreground">
              <strong>{product}</strong>
              {value != null ? ` · ${value} ${unit}` : ''}
              . Tu hora programada no coincide con la actual — ¿cuándo te la aplicaste?
            </p>

            {/* Nota opcional */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="dc-note">
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
                className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
              {note.length > 100 && (
                <span className="text-right text-[11px] text-muted-foreground">{note.length}/120</span>
              )}
            </div>

            {/* Toggle modo hora */}
            <div className="flex justify-center gap-2">
              <Chip
                active={timeMode === 'preset'}
                onClick={() => setTimeMode('preset')}
                className="h-9 text-[12px] px-3"
              >
                Presets
              </Chip>
              <Chip
                active={timeMode === 'wheel'}
                onClick={() => setTimeMode('wheel')}
                className="h-9 text-[12px] px-3"
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
                    className={`${btnRow} bg-primary text-primary-foreground shadow-glow`}
                    onClick={() => logWithTime(scheduledTs)}
                  >
                    <span className="text-[16px]">A mi hora programada</span>
                    <span className="font-mono text-[12px] opacity-80">{fmtTime(new Date(scheduledTs))}</span>
                  </button>
                  <button
                    type="button"
                    className={`${btnRow} border border-teal/50 text-teal`}
                    onClick={() => logWithTime(nowTs)}
                  >
                    <span className="text-[16px]">Ahora mismo</span>
                    <span className="font-mono text-[12px] opacity-70">{fmtTime(new Date(nowTs))}</span>
                  </button>
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
                    className={`${btnRow} bg-primary text-primary-foreground shadow-glow`}
                    onClick={() => logWithTime(wheelTs)}
                  >
                    <span className="text-[16px]">
                      Registrar a las{' '}
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

            <p className="text-[14px] text-foreground">
              Dosis registrada.{' '}
              <span className="text-muted-foreground">¿Cómo te sientes?</span>
            </p>
            <p className="text-[12px] text-muted-foreground/70 -mt-2">
              Dato personal observacional — no es una promesa de resultado.
            </p>

            <div className="flex flex-wrap gap-2">
              {EFFECT_OPTIONS.filter((o) => o !== 'Otro').map((opt) => (
                <Chip
                  key={opt}
                  active={effect === opt}
                  onClick={() => {
                    setEffect(opt)
                    commitEffect(opt)
                  }}
                >
                  {opt}
                </Chip>
              ))}
              <Chip
                active={showCustomEffect}
                onClick={() => setShowCustomEffect((v) => !v)}
              >
                Otro
              </Chip>
            </div>

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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={80}
                      value={customEffect}
                      onChange={(e) => setCustomEffect(e.target.value)}
                      placeholder="Describe cómo te sientes…"
                      aria-label="Efecto personalizado"
                      autoFocus
                      className="h-11 flex-1 rounded-lg border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!customEffect.trim()}
                      onClick={() => { if (customEffect.trim()) commitEffect(customEffect.trim()) }}
                    >
                      Guardar
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button variant="outline" size="full" onClick={onClose}>
              Omitir
            </Button>

          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}
