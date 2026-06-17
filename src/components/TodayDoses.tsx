// "Tus dosis de hoy" — checklist 1-tap: cada producto programado hoy con su dosis + botón "hecho".
// Sin escribir: la dosis viene de la fase activa o de la última registrada (doseForProduct).
import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { useApp, doseForProduct, nextInjectionSite } from '../lib/store'
import type { InjectionSite } from '../lib/types'
import { dayProducts, doseTakenOnProduct, doseSkippedOnProduct, loggedItemsForDay, upcomingDoses } from '../lib/calendar'
import { startOfDay, fmtTime } from '../lib/cadence'
import { doseToMg } from '../lib/calc'
import { tapHaptic } from '../lib/haptics'
import { PEPTIDES, CATEGORY_COLOR, EFFECT_OPTIONS } from '../lib/catalog'
import { IcCheck } from './icons'
import { Glyph } from './glyphs'
import { staggerParent, staggerItem, spring, dur, ease } from '../lib/motion'
import { presenceNow } from '../lib/pharma'

// ── Loop 140: selector de sitio de inyección ─────────────────────────────────
const SITE_OPTIONS: { value: InjectionSite; label: string }[] = [
  { value: 'abdomen-izq', label: 'Abd. izq.' },
  { value: 'abdomen-der', label: 'Abd. der.' },
  { value: 'muslo-izq',   label: 'Muslo izq.' },
  { value: 'muslo-der',   label: 'Muslo der.' },
  { value: 'gluteo-izq',  label: 'Glúteo izq.' },
  { value: 'gluteo-der',  label: 'Glúteo der.' },
]

interface SiteSelectorProps {
  suggested: InjectionSite
  onSelect: (site: InjectionSite) => void
  onSkip: () => void
}

function SiteSelector({ suggested, onSelect, onSkip }: SiteSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ overflow: 'hidden', padding: '8px 16px 10px', borderTop: '1px solid var(--border)' }}
    >
      <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 6, fontWeight: 500 }}>
        Zona de inyección
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {SITE_OPTIONS.map((opt) => {
          const isSuggested = opt.value === suggested
          return (
            <button
              key={opt.value}
              onClick={() => { tapHaptic(); onSelect(opt.value) }}
              aria-label={`${opt.label}${isSuggested ? ' (sugerida)' : ''}`}
              style={{
                height: 30, padding: '0 10px', borderRadius: 999,
                fontSize: 12, fontWeight: isSuggested ? 700 : 500, cursor: 'pointer',
                border: isSuggested ? '1.5px solid var(--brand-500)' : '1.5px solid var(--border)',
                background: isSuggested ? 'color-mix(in srgb, var(--brand-500) 12%, transparent)' : 'transparent',
                color: isSuggested ? 'var(--brand-700)' : 'var(--ink-400)',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}{isSuggested ? ' ✓' : ''}
            </button>
          )
        })}
      </div>
      <button
        onClick={() => { tapHaptic(); onSkip() }}
        style={{
          height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11,
          cursor: 'pointer', border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--ink-300)', fontWeight: 400,
        }}
      >
        Omitir zona
      </button>
    </motion.div>
  )
}

// ── Loop 138: campo de nota opcional pegada al registro de dosis ──────────────
interface NoteFieldProps {
  value: string
  onChange: (v: string) => void
}

function NoteField({ value, onChange }: NoteFieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ overflow: 'hidden', padding: '8px 16px 10px', borderTop: '1px solid var(--border)' }}
    >
      <div className="sm" style={{ color: 'var(--ink-400)', marginBottom: 5, fontWeight: 500 }}>
        Nota opcional
      </div>
      <input
        type="text"
        maxLength={120}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ej: abdomen, náusea leve, energía…"
        aria-label="Nota de la dosis (máx. 120 caracteres)"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '7px 10px',
          borderRadius: 'var(--r-sm)',
          border: '1.5px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--ink-900)',
          fontSize: 13,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {value.length > 100 && (
        <div className="sm" style={{ color: 'var(--ink-300)', textAlign: 'right', marginTop: 3 }}>
          {value.length}/120
        </div>
      )}
    </motion.div>
  )
}

// ── Loop 139: mini-sheet inline de efecto/síntoma post-dosis ──────────────────
// Dato observacional del usuario — no implica eficacia ni consejo médico.
interface EffectPickerProps {
  onSelect: (effect: string) => void
  onSkip: () => void
}

function EffectPicker({ onSelect, onSkip }: EffectPickerProps) {
  const [customText, setCustomText] = useState('')
  const [showOtro, setShowOtro] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      style={{ overflow: 'hidden', padding: '10px 16px 12px', borderTop: '1px solid var(--border)', background: 'color-mix(in srgb, var(--brand-500) 4%, transparent)' }}
    >
      <div className="sm" style={{ color: 'var(--ink-700)', marginBottom: 7, fontWeight: 600 }}>
        ¿Cómo te sientes?
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: showOtro ? 8 : 10 }}>
        {EFFECT_OPTIONS.filter((o) => o !== 'Otro').map((opt) => (
          <button
            key={opt}
            onClick={() => { tapHaptic(); onSelect(opt) }}
            aria-label={opt}
            style={{
              height: 30, padding: '0 11px', borderRadius: 999,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: '1.5px solid var(--border)',
              background: 'transparent',
              color: 'var(--ink-700)',
              transition: 'all 0.12s ease',
            }}
          >
            {opt}
          </button>
        ))}
        <button
          onClick={() => { tapHaptic(); setShowOtro((v) => !v) }}
          aria-label="Otro efecto (texto libre)"
          style={{
            height: 30, padding: '0 11px', borderRadius: 999,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: showOtro ? '1.5px solid var(--brand-500)' : '1.5px solid var(--border)',
            background: showOtro ? 'color-mix(in srgb, var(--brand-500) 10%, transparent)' : 'transparent',
            color: showOtro ? 'var(--brand-700)' : 'var(--ink-700)',
            transition: 'all 0.12s ease',
          }}
        >
          Otro
        </button>
      </div>

      {/* Campo de texto libre para "Otro" */}
      <AnimatePresence initial={false}>
        {showOtro && (
          <motion.div
            key="otro-input"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                maxLength={80}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Describe cómo te sientes…"
                aria-label="Efecto personalizado"
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--ink-900)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => { tapHaptic(); if (customText.trim()) onSelect(customText.trim()) }}
                disabled={!customText.trim()}
                style={{
                  height: 34, padding: '0 12px', borderRadius: 'var(--r-sm)',
                  fontSize: 12, fontWeight: 600, cursor: customText.trim() ? 'pointer' : 'not-allowed',
                  border: 'none', background: 'var(--brand-700)', color: 'var(--ink-0)',
                  opacity: customText.trim() ? 1 : 0.4,
                  transition: 'opacity 0.12s ease',
                }}
              >
                Guardar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => { tapHaptic(); onSkip() }}
        style={{
          height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11,
          cursor: 'pointer', border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--ink-300)', fontWeight: 400,
        }}
      >
        Omitir
      </button>
    </motion.div>
  )
}

// ── Loop 133: microcopy contextual por franja horaria ─────────────────────────
function getTimeGreeting(): { label: string; sub: string | null } {
  const h = new Date().getHours()
  if (h < 5) return { label: 'Protocolo del día', sub: null }
  if (h < 12) return { label: 'Buenos días — tus dosis de hoy', sub: null }
  if (h < 18) return { label: 'Tarde — ¿ya tomaste todo?', sub: null }
  return { label: 'Cierre del día', sub: null }
}

// ── Item 158: chip de franja del día ─────────────────────────────────────────
function getDaySlot(): { label: string; icon: ReactNode } {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return { label: 'Mañana · 6–12h', icon: <Glyph name="amanecer" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
  if (h >= 12 && h < 18) return { label: 'Tarde · 12–18h', icon: <Glyph name="sol" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
  if (h >= 18) return { label: 'Noche · 18–24h', icon: <Glyph name="sueno" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
  return { label: 'Madrugada · 0–6h', icon: <Glyph name="sueno" size={13} color="currentColor" style={{ verticalAlign: '-2px', marginRight: 3 }} /> }
}

// ── Loop 137: semáforo de ventana de toma (inline — no toca cadence.ts) ────────
// verde ±0 dentro de la ventana (≤30 min), naranja (31–120 min), rojo (>120 min)
function windowStatus(tsScheduled: number, nowTs: number, takenTs?: number): 'ok' | 'near' | 'late' | null {
  if (takenTs !== undefined) return null // ya tomada → ocultar
  const diffMin = Math.abs(nowTs - tsScheduled) / 60000
  if (diffMin <= 30) return 'ok'
  if (diffMin <= 120) return 'near'
  return 'late'
}
const WINDOW_COLOR: Record<'ok' | 'near' | 'late', string> = {
  ok: 'var(--success)',
  near: 'var(--warning)',
  late: 'var(--error)',
}
const WINDOW_LABEL: Record<'ok' | 'near' | 'late', string> = {
  ok: 'En ventana',
  near: '±30 min',
  late: 'Fuera de ventana',
}

// ── Loop 135: confetti particles ──────────────────────────────────────────────
const CONFETTI_COLORS = ['#5eead4', '#2FB57C', '#B6F09C', '#1B8A7D', '#5FC9B8', '#7BC96F', '#D6F2EC', '#0E5A52']
const PARTICLES = Array.from({ length: 8 }, (_, i) => i)

function Confetti() {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit' }}>
      {PARTICLES.map((i) => {
        const x = 10 + Math.random() * 80  // % from left
        const delay = i * 0.06
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, y: '-10%', x: `${x}vw`, scale: 0.8 }}
            animate={{ opacity: [1, 1, 0], y: ['0%', '90%'], scale: [0.8, 1.1, 0.7] }}
            transition={{ duration: 1.2, delay, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 7, height: 7, borderRadius: i % 2 === 0 ? 999 : 2,
              background: color,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Loop 169: mini-heatmap 7×1 de adherencia ─────────────────────────────────
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function WeekHeatmap({ product, state, today }: { product: string; state: any; today: Date }) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Build last-7-days array (Mon–Sun of this week, aligned)
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    // offset to Monday of this week
    const dow = today.getDay() // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    d.setDate(today.getDate() + mondayOffset + i)
    const isFuture = d > today
    const taken = !isFuture && doseTakenOnProduct(state, d, product)
    const isToday = d.toDateString() === today.toDateString()
    return { d, taken, isFuture, isToday, label: DAY_LABELS[i] }
  })

  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', padding: '2px 0 0' }}>
      {cells.map((cell, i) => (
        <motion.div
          key={i}
          initial={prefersReduced ? false : { opacity: 0, scaleY: 0.4 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: i * 0.01, duration: dur.fast, ease: ease.decelerate }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: cell.isFuture
              ? 'var(--border)'
              : cell.taken
                ? 'var(--success)'
                : cell.isToday
                  ? 'var(--ink-200)'
                  : 'var(--ink-200)',
            opacity: cell.isFuture ? 0.4 : 1,
            outline: cell.isToday ? '1.5px solid var(--brand-500)' : 'none',
            outlineOffset: 1,
          }} />
          <span style={{ fontSize: 7, color: 'var(--ink-400)', lineHeight: 1 }}>{cell.label}</span>
        </motion.div>
      ))}
    </div>
  )
}

// ── n°434: LongPressButton — tap directo; long-press 500ms → acción alternativa ──
interface LongPressButtonProps {
  onTap: () => void
  onLongPress: () => void
  ariaLabel: string
  active: boolean
  color: string
}

function LongPressButton({ onTap, onLongPress, ariaLabel, active, color: _color }: LongPressButtonProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  function startPress() {
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress()
    }, 500)
  }

  function endPress() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!didLongPress.current) onTap()
  }

  function cancelPress() {
    if (timerRef.current) clearTimeout(timerRef.current)
    didLongPress.current = false
  }

  return (
    <button
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      aria-label={ariaLabel}
      title={active ? 'Toca para deshacer · mantén para editar' : 'Toca para marcar · mantén para elegir hora'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 999,
        cursor: 'pointer', fontWeight: 600, fontSize: 13,
        border: active ? 'none' : '1.5px solid var(--border)',
        background: active ? 'var(--success)' : 'transparent',
        color: active ? 'var(--ink-0)' : 'var(--ink-400)',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <IcCheck size={15} />
          </motion.span>
        )}
      </AnimatePresence>
      {active ? 'Hecho' : 'Marcar'}
    </button>
  )
}

export function TodayDoses() {
  const { state, dispatch } = useApp()
  const today = startOfDay(new Date(state.todayTs))
  const prods = dayProducts(state, today)
  const [tick, setTick] = useState(0)

  // Loop 137: 30s ticker for window status refresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Loop 133: greeting computed once per render (hour changes rarely mid-session)
  const greeting = getTimeGreeting()

  // doneCount/allDone + hooks ANTES de cualquier early-return (regla de hooks de React)
  // Los productos con skip intencional se excluyen del denominador y no cuentan como pendientes.
  const skippedProds = prods.filter((p) => doseSkippedOnProduct(state, today, p))
  const activeProds = prods.filter((p) => !doseSkippedOnProduct(state, today, p))
  const doneCount = activeProds.filter((p) => doseTakenOnProduct(state, today, p)).length
  const allDone = activeProds.length > 0 && doneCount === activeProds.length
  const collapseKey = `hacktrack-doses-collapsed-${today.toISOString().slice(0, 10)}`
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(collapseKey) === '1' } catch { return false }
  })
  // loop 140: producto esperando selección de zona de inyección
  const [pendingSiteProduct, setPendingSiteProduct] = useState<string | null>(null)
  // loop 138: nota borrador por producto (se mantiene hasta que se registra la dosis)
  const [noteByProduct, setNoteByProduct] = useState<Record<string, string>>({})
  // loop 139: producto cuya dosis recién registrada espera selección de efecto
  // (el id real se resuelve al despachar el efecto buscando el item más reciente de ese producto hoy)
  const [pendingEffectProduct, setPendingEffectProduct] = useState<string | null>(null)
  const prevAllDone = useRef(allDone)
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      try { sessionStorage.setItem(collapseKey, '1') } catch { /* storage no disponible */ }
      setCollapsed(true)
    }
    prevAllDone.current = allDone
  }, [allDone, collapseKey])
  const [showCelebration, setShowCelebration] = useState(false)
  const prevAllDoneC = useRef(allDone)
  useEffect(() => {
    if (allDone && !prevAllDoneC.current) {
      setShowCelebration(true)
      const t = setTimeout(() => setShowCelebration(false), 3000)
      prevAllDoneC.current = allDone
      return () => clearTimeout(t)
    }
    prevAllDoneC.current = allDone
  }, [allDone])

  // item 36: estado vacío diferenciado
  if (prods.length === 0) {
    const hasProtocols = Object.keys(state.protocols).length > 0
    if (!hasProtocols) return null
    // hay protocolos activos pero hoy no toca ninguna dosis
    const next = upcomingDoses(state, new Date(), 1)[0]
    return (
      <div className="card" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <Glyph name="sueno" size={28} color="var(--ink-300)" />
        <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Hoy no toca ninguna dosis</span>
        {next && (
          <span className="sm" style={{ color: 'var(--ink-400)' }}>
            Próxima: <strong>{next.product}</strong> el {next.date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    )
  }

  // ts de la toma a la hora reminderTime DE ESE producto (cada uno puede tener la suya)
  function tsFor(product: string): number {
    const rt = state.protocols[product]?.reminderTime || state.protocol?.reminderTime || '08:00'
    const [hh, mm] = rt.split(':').map(Number)
    const at = new Date(today)
    at.setHours(hh || 0, mm || 0, 0, 0)
    return at.getTime()
  }

  // n°434: 1-tap registra directo; solo long-press (500ms) abre DoseConfirm
  function markDone(product: string, force = false) {
    tapHaptic()
    const dose = doseForProduct(state, product)
    if (!dose) { dispatch({ t: 'sheet', sheet: 'registrar', arg: product }); return }
    if (force) {
      // long-press → abrir DoseConfirm siempre (para backfill o corrección horaria)
      const rec = state.productRecon[product]
      const doseMg = doseToMg(dose.value, dose.unit, rec?.vialMg, rec?.aguaMl) ?? undefined
      const scheduledTs = tsFor(product)
      const nowTs = Date.now()
      const suggestedSite = nextInjectionSite(state.lastInjectionSite?.[product])
      dispatch({ t: 'sheet', sheet: 'dose-confirm', arg: JSON.stringify({ product, value: dose.value, unit: dose.unit, doseMg, scheduledTs, nowTs, suggestedSite }) })
    } else {
      // tap normal → muestra selector de zona antes de registrar (sin forzar confirm)
      setPendingSiteProduct(product)
    }
  }

  // loop 140 + 138 + 139: registra la dosis con o sin sitio/nota, luego pide efecto
  function commitDose(product: string, site?: InjectionSite) {
    const dose = doseForProduct(state, product)
    if (!dose) return
    const rec = state.productRecon[product]
    const doseMg = doseToMg(dose.value, dose.unit, rec?.vialMg, rec?.aguaMl) ?? undefined
    const scheduledTs = tsFor(product)
    const note = noteByProduct[product]?.trim() || undefined  // loop 138
    dispatch({ t: 'logDose', product, value: dose.value, unit: dose.unit, ts: scheduledTs, doseMg, site, note })
    setPendingSiteProduct(null)
    // limpiar el borrador de nota de este producto
    setNoteByProduct((prev) => { const n = { ...prev }; delete n[product]; return n })
    // loop 139: abrir picker de efecto post-dosis
    setPendingEffectProduct(product)
  }

  // loop 139: guarda el efecto en el logItem recién registrado para este producto
  function commitEffect(product: string, effect: string) {
    // busca el LogItem de dosis más reciente de hoy para este producto
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const group = state.log.find((g) => g.dateKey === todayKey)
    const item = group?.items.find((it) => it.type === 'dose' && it.product === product)
    if (item) dispatch({ t: 'setLogEffect', id: item.id, effect })
    setPendingEffectProduct(null)
  }
  function undo(product: string) {
    tapHaptic()
    const item = loggedItemsForDay(state, today).find((it) => it.type === 'dose' && it.product === product)
    if (item) dispatch({ t: 'deleteLog', id: item.id })
  }
  function skipDose(product: string) {
    tapHaptic()
    dispatch({ t: 'logSkip', product })
  }
  function undoSkip(product: string) {
    tapHaptic()
    const item = loggedItemsForDay(state, today).find((it) => it.type === 'skip' && it.product === product)
    if (item) dispatch({ t: 'deleteLog', id: item.id })
  }

  // n°419: presencia farmacológica actual para cada producto
  const presenceByProduct = useMemo(() => {
    const map: Record<string, number> = {}
    try {
      const pres = presenceNow(state, Date.now())
      for (const p of pres) map[p.product] = p.pct
    } catch { /* pharma fallback */ }
    return map
  }, [state.log, state.protocols]) // eslint-disable-line react-hooks/exhaustive-deps

  // n°484: CTA "Retomar protocolo" cuando hay ≥3 dosis perdidas consecutivas (rango 7 días)
  const missedStreakCount = useMemo(() => {
    let missed = 0
    const todayD = startOfDay(new Date(state.todayTs))
    for (let i = 1; i <= 7; i++) {
      const d = new Date(todayD.getTime() - i * 86400000)
      const hasAnyDue = prods.length > 0
      if (!hasAnyDue) break
      const anyTaken = prods.some((p) => doseTakenOnProduct(state, d, p))
      const anySkipped = prods.some((p) => doseSkippedOnProduct(state, d, p))
      if (!anyTaken && !anySkipped) missed++
      else break
    }
    return missed
  }, [state.log, state.protocols, state.todayTs, prods]) // eslint-disable-line react-hooks/exhaustive-deps

  // color de la primera categoría activa para la barra de progreso
  const firstCat = PEPTIDES[prods[0]]?.cat ?? 'Explorar'
  const progressColor = allDone ? 'var(--success)' : (CATEGORY_COLOR[firstCat] ?? 'var(--brand-700)')

  // timestamp of last taken dose today (for done-state summary line)
  const lastDoneTs = (() => {
    if (!allDone) return null
    const items = loggedItemsForDay(state, today).filter((it) => it.type === 'dose')
    if (!items.length) return null
    return Math.max(...items.map((it) => it.ts))
  })()

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <LayoutGroup id="today-doses">
      <motion.section
        layout
        variants={staggerParent}
        initial="initial"
        animate="animate"
        className="card"
        style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
      >
        {/* Loop 135: confetti overlay during celebration */}
        <AnimatePresence>
          {showCelebration && <Confetti key="confetti" />}
        </AnimatePresence>

        {/* Loop 133 + Loop 135: Header — celebrate or greeting */}
        <motion.div layout="position" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
          <AnimatePresence mode="wait" initial={false}>
            {showCelebration ? (
              <motion.span
                key="celebrate"
                className="sm"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                style={{ fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                ¡Todo listo por hoy!
              </motion.span>
            ) : allDone ? (
              <motion.span
                key="alldone"
                className="sm"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--success)', fontWeight: 700 }}
              >
                ¡Todo en orden hoy!
              </motion.span>
            ) : (
              // Loop 133: franja horaria
              <motion.span
                key="greeting"
                className="sm"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: dur.base, ease: ease.decelerate }}
                style={{ textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-400)', fontWeight: 700 }}
              >
                {greeting.label}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="sm mono" style={{ color: allDone ? 'var(--success)' : 'var(--ink-400)' }}>
            {doneCount}/{activeProds.length}
            {skippedProds.length > 0 && (
              <span style={{ color: 'var(--ink-300)', marginLeft: 4 }}>
                +{skippedProds.length} saltada{skippedProds.length !== 1 ? 's' : ''}
              </span>
            )}
          </span>
        </motion.div>

        {/* Item 158: Chip de franja del día */}
        {!allDone && (
          <div style={{ padding: '0 16px 8px' }}>
            {(() => {
              const slot = getDaySlot()
              const nightSlot = slot.label.startsWith('Noche')
              const hasNocturnalDue = !allDone && prods.some((p) => {
                const rt = state.protocols[p]?.reminderTime || state.protocol?.reminderTime
                if (!rt) return false
                const [hh] = rt.split(':').map(Number)
                return hh >= 18
              })
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                  background: 'var(--ink-100)', color: 'var(--ink-400)',
                  border: (nightSlot && hasNocturnalDue) ? '1.5px solid var(--brand-300)' : '1.5px solid transparent',
                }}>
                  {slot.icon} {slot.label}
                </span>
              )
            })()}
          </div>
        )}

        {/* Loop 169: mini-heatmap 7×1 by product — only when expanded */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="heatmap"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.base, ease: ease.decelerate }}
              style={{ overflow: 'hidden', padding: '0 16px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {prods.map((product) => (
                <div key={product} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: 'var(--ink-400)', minWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product}</span>
                  <WeekHeatmap product={product} state={state} today={today} />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barra de progreso */}
        <motion.div layout="position"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemax={activeProds.length}
          style={{ height: 3, background: 'var(--border)', margin: '0 0 2px' }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: activeProds.length > 0 ? `${(doneCount / activeProds.length) * 100}%` : '0%' }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
            style={{ height: '100%', background: progressColor, borderRadius: 999 }}
          />
        </motion.div>

        {/* Loop 134: Done-state colapsado */}
        <AnimatePresence initial={false}>
          {allDone && collapsed ? (
            <motion.div
              key="collapsed"
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.base, ease: ease.decelerate }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderTop: '1px solid var(--border)',
              }}>
                <span className="sm" style={{ color: 'var(--success)', fontWeight: 600 }}>
                  {activeProds.length}/{activeProds.length} completadas
                  {lastDoneTs ? ` · hoy a las ${fmtTime(new Date(lastDoneTs))}` : ''}
                  {skippedProds.length > 0 ? ` · ${skippedProds.length} saltada${skippedProds.length !== 1 ? 's' : ''}` : ''}
                </span>
                <button
                  onClick={() => {
                    tapHaptic()
                    setCollapsed(false)
                    try { sessionStorage.removeItem(collapseKey) } catch {}
                  }}
                  aria-label="Ver dosis del día"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-400)', fontSize: 13, padding: '0 4px',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 11 }}>▾</span> Ver
                </button>
              </div>
            </motion.div>
          ) : (
            // Loop 136: LayoutGroup animation + Loop 137: semáforo
            <motion.div key="rows" layout initial={false}>
              {/* Item 121: Registrar todo 1-tap */}
              {doneCount === 0 && activeProds.length > 0 && activeProds.every((p) => doseForProduct(state, p) !== null) && (
                <div style={{ padding: '10px 16px 6px', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => {
                      tapHaptic()
                      activeProds.forEach((p) => markDone(p))
                    }}
                    aria-label="Marcar todas las dosis de hoy como hechas"
                    style={{
                      width: '100%', height: 36, borderRadius: 999,
                      border: '1.5px solid var(--brand-300)',
                      background: 'color-mix(in srgb, var(--brand-500) 8%, transparent)',
                      color: 'var(--brand-700)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Marcar todo como hecho · {activeProds.length} dosis
                  </button>
                </div>
              )}
              {prods
                .slice()
                .sort((a, b) => {
                  // done/skipped rows sink to bottom
                  const aResolved = (doseTakenOnProduct(state, today, a) || doseSkippedOnProduct(state, today, a)) ? 1 : 0
                  const bResolved = (doseTakenOnProduct(state, today, b) || doseSkippedOnProduct(state, today, b)) ? 1 : 0
                  return aResolved - bResolved
                })
                .map((product) => {
                  const taken = doseTakenOnProduct(state, today, product)
                  const skipped = doseSkippedOnProduct(state, today, product)
                  const dose = doseForProduct(state, product)
                  const cat = PEPTIDES[product]?.cat ?? 'Explorar'
                  const color = CATEGORY_COLOR[cat] ?? 'var(--brand-700)'

                  // item 32: hora de recordatorio
                  const hasReminder = !!(state.protocols[product]?.reminderTime || state.protocol?.reminderTime)
                  const reminderLabel = hasReminder ? fmtTime(new Date(tsFor(product))) : null

                  // Loop 137: window status (refreshes on 30s tick — tick used as render trigger)
                  void tick
                  const scheduled = tsFor(product)
                  const win = (!skipped && !taken) ? windowStatus(scheduled, Date.now(), undefined) : null

                  // loop 140: sitio sugerido para este producto
                  const suggestedSite = nextInjectionSite(state.lastInjectionSite?.[product])
                  const showSiteSelector = pendingSiteProduct === product && !taken && !skipped
                  // loop 139: mostrar picker de efecto si esta dosis acaba de ser registrada
                  const showEffectPicker = pendingEffectProduct === product && taken

                  // n°419: presencia estimada del péptido (solo si > 0 y no tomada hoy)
                  const presencePct = presenceByProduct[product] ?? 0

                  // n°433: swipe horizontal para marcar/desmarcar (estado local por producto)
                  // Se gestiona con drag inline en el botón Marcar

                  return (
                    <motion.div
                      key={product}
                      layout="position"   // Loop 136
                      layoutId={`dose-row-${product}`}
                      variants={staggerItem}
                      transition={spring.ui}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        borderTop: '1px solid var(--border)',
                        // Loop 137: left-border semáforo; skip muestra borde neutro atenuado
                        borderLeft: skipped
                          ? '3px solid var(--border)'
                          : (!taken && win && hasReminder) ? `3px solid ${WINDOW_COLOR[win!]}` : '3px solid transparent',
                        // item 34 / skip: atenuar fila si tomada o saltada
                        opacity: (taken || skipped) ? 0.55 : 1,
                        transition: 'opacity 0.25s ease, border-left-color 0.3s ease',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {/* n°433: swipe-reveal panels */}
                      {!taken && !skipped && (
                        <div aria-hidden="true" style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: 72,
                          background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0,
                        }}>
                          <span style={{ color: '#fff', display: 'flex' }}><IcCheck size={22} /></span>
                        </div>
                      )}
                      {taken && (
                        <div aria-hidden="true" style={{
                          position: 'absolute', right: 0, top: 0, bottom: 0, width: 72,
                          background: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0,
                        }}>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>Deshacer</span>
                        </div>
                      )}

                      {/* fila principal: icono + info + botones — draggable (n°433) */}
                      <motion.div
                        drag={!skipped ? 'x' : false}
                        dragConstraints={{ left: taken ? -80 : 0, right: taken ? 0 : 80 }}
                        dragElastic={0.12}
                        onDragEnd={(_, info) => {
                          if (!taken && info.offset.x > 48) { markDone(product) }
                          else if (taken && info.offset.x < -48) { undo(product) }
                        }}
                        style={{ position: 'relative', zIndex: 1, background: 'var(--card, var(--surface))' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                          {/* item 31: pill de categoría (gris si skip) */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: skipped ? 'var(--ink-300)' : color }} />
                            <span style={{ fontSize: 9, color: 'var(--ink-400)', lineHeight: 1, textAlign: 'center', maxWidth: 36, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* item 34 / skip: line-through y texto diferenciado */}
                            <div className="body" style={{ fontWeight: 600, color: skipped ? 'var(--ink-400)' : 'var(--ink-900)', textDecoration: (taken || skipped) ? 'line-through' : 'none' }}>{product}</div>
                            <div className="sm mono" style={{ color: 'var(--ink-400)' }}>
                              {skipped
                                ? 'Saltada hoy (intencional)'
                                : dose ? `${dose.value} ${dose.unit}` : 'Establece tu dosis'}
                              {/* item 32: hora del recordatorio (solo si no saltada) */}
                              {!skipped && reminderLabel && (
                                <span style={{ marginLeft: 4 }}>· {reminderLabel}</span>
                              )}
                              {/* Loop 137: label de ventana */}
                              {!skipped && !taken && win && hasReminder && (
                                <span style={{ marginLeft: 4, color: WINDOW_COLOR[win!], fontWeight: 600 }}>
                                  · {WINDOW_LABEL[win!]}
                                </span>
                              )}
                            </div>
                            {/* Item 119: badge ¡Perdida! cuando reminderTime ya pasó y no se ha tomado */}
                            {!taken && !skipped && hasReminder && Date.now() > tsFor(product) && (
                              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)', padding: '1px 7px', borderRadius: 99, marginTop: 3 }}>¡Perdida!</span>
                            )}
                            {/* n°419: badge de presencia estimada (solo si hay presencia y no tomada hoy) */}
                            {!taken && !skipped && presencePct > 2 && (
                              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--ink-100)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min(100, presencePct)}%`, background: color, borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 9, color: 'var(--ink-400)' }}>
                                  {presencePct >= 50 ? 'presente' : presencePct >= 20 ? 'disminuyendo' : 'casi eliminado'} ~{Math.round(presencePct)}%
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Botones de acción: taken → deshacer; skipped → deshacer skip; pending → "Marcar" + "No hoy" */}
                          {skipped ? (
                            <button
                              onClick={() => undoSkip(product)}
                              aria-label={`Deshacer saltar ${product}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999,
                                cursor: 'pointer', flexShrink: 0, fontWeight: 500, fontSize: 12,
                                border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--ink-300)',
                              }}
                            >
                              Deshacer
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {/* n°434: botón Marcar: tap directo; long-press 500ms → DoseConfirm */}
                              <LongPressButton
                                onTap={() => taken ? undo(product) : markDone(product)}
                                onLongPress={() => taken ? undo(product) : markDone(product, true)}
                                ariaLabel={taken ? `Deshacer ${product}` : `Marcar ${product} como hecho`}
                                active={taken}
                                color={color}
                              />
                            {!taken && (
                              <button
                                onClick={() => skipDose(product)}
                                aria-label={`No tomar ${product} hoy (intencional)`}
                                style={{
                                  height: 34, padding: '0 10px', borderRadius: 999,
                                  cursor: 'pointer', fontWeight: 500, fontSize: 12,
                                  border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--ink-300)',
                                }}
                              >
                                No hoy
                              </button>
                            )}
                          </div>
                        )}
                        </div>
                      </motion.div>

                      {/* Loop 138 + Loop 140: campo de nota + selector de zona (aparecen tras pulsar "Marcar") */}
                      <AnimatePresence>
                        {showSiteSelector && (
                          <>
                            <NoteField
                              key={`note-${product}`}
                              value={noteByProduct[product] ?? ''}
                              onChange={(v) => setNoteByProduct((prev) => ({ ...prev, [product]: v }))}
                            />
                            <SiteSelector
                              key={`site-${product}`}
                              suggested={suggestedSite}
                              onSelect={(site) => commitDose(product, site)}
                              onSkip={() => commitDose(product)}
                            />
                          </>
                        )}
                      </AnimatePresence>

                      {/* Loop 139: picker de efecto/síntoma post-dosis (aparece tras registrar) */}
                      <AnimatePresence>
                        {showEffectPicker && (
                          <EffectPicker
                            key={`effect-${product}`}
                            onSelect={(effect) => commitEffect(product, effect)}
                            onSkip={() => setPendingEffectProduct(null)}
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* n°484: CTA "Retomar protocolo" cuando hay ≥3 dosis perdidas consecutivas */}
        <AnimatePresence>
          {missedStreakCount >= 3 && !allDone && (
            <motion.div
              key="retomar-cta"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: '10px 16px', borderTop: '1px solid var(--border)',
                background: 'color-mix(in srgb, var(--warning) 6%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span className="sm" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                  {missedStreakCount} días sin dosis registradas
                </span>
                <button
                  onClick={() => dispatch({ t: 'tab', tab: 'protocolo' })}
                  aria-label="Ir a la sección de protocolo para retomar"
                  style={{
                    marginLeft: 8, color: 'var(--brand-700)', fontWeight: 700, fontSize: 12,
                    background: 'none', border: '1.5px solid var(--brand-300)',
                    borderRadius: 999, padding: '3px 10px', cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  Retomar protocolo →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </LayoutGroup>
  )
}
