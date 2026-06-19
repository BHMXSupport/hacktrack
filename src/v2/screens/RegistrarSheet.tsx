// RegistrarSheet v2 — design system "Precision × Accessible"
// Compliance: sin dosis precargada, sin vía de administración, sin claims médicos.
// Privacidad: historial local only.
// R16/R17: reconstitución del vial + doseMg/recon en logDose.
// R19: nota libre (≤200 chars) + selector de efecto/síntoma.
// R22: selector de hora (v2 time-input) en vez de Date.now().
//       Unidades: 'mg' | 'mcg' | 'UI' | 'mL'  (clics == UI → no se registra por separado)
import { useState, useCallback, useEffect, useRef } from 'react'
import { Shield, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { PEPTIDES, EFFECT_OPTIONS } from '../../lib/catalog'
import { presetCad } from '../../lib/cadence'
import { doseToMg, needsRecon } from '../../lib/calc'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { DataPlate } from '../ui/DataPlate'
import { InjectionMap } from '../ui/InjectionMap'
import type { InjectionSite } from '../../lib/types'

// ── Tipos y constantes ─────────────────────────────────────────────────────────

type DoseUnit = 'mg' | 'mcg' | 'UI' | 'mL'

const UNITS: { value: DoseUnit; label: string }[] = [
  { value: 'mg',    label: 'mg' },
  { value: 'mcg',   label: 'mcg' },
  { value: 'UI',    label: 'UI' },
  { value: 'mL',    label: 'mL' },
]

// Step adaptativo por unidad
const UNIT_STEP: Record<DoseUnit, number> = {
  mcg: 50,
  mg: 0.1,
  UI: 1,
  mL: 0.05,
}

// 'clics' es lo mismo que UI (pluma/jeringa de insulina) → normaliza datos viejos a 'UI'.
const normUnit = (u: string | null | undefined): DoseUnit =>
  u === 'clics' ? 'UI' : ((u as DoseUnit) ?? 'mg')

// ── Time-wheel inline ligero (v2, autocontenido) ──────────────────────────────

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

function TimeWheelV2({
  onChange,
}: {
  onChange: (ts: number | null) => void  // null = "Ahora"
}) {
  const now = new Date()
  const h24 = now.getHours()
  const [hi, setHi] = useState(((h24 % 12) || 12) - 1)
  const [mi, setMi] = useState(Math.round(now.getMinutes() / 5) % 12)
  const [ai, setAi] = useState(h24 >= 12 ? 1 : 0)
  const first = useRef(true)

  useEffect(() => {
    // Emitir inmediatamente el ts correspondiente a la posición actual
    const h = HOURS[hi]
    let hour = h % 12
    if (ai === 1) hour += 12
    const d = new Date()
    d.setHours(hour, MINS5[mi], 0, 0)
    onChange(d.getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hi, mi, ai])

  useEffect(() => {
    // montaje: no emitir para que el padre arranque con "Ahora" = null
    first.current = false
  }, [])

  return (
    <div
      className="relative flex gap-1 rounded-2xl bg-raised/60 px-3"
      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* banda de selección */}
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildProductList(importedProducts: string[]): string[] {
  return [...new Set([...importedProducts, ...Object.keys(PEPTIDES)])]
}

type LogGroups = ReturnType<typeof useApp>['state']['log']

function lastDoses(
  log: LogGroups,
  product: string,
): { value: number; unit: string }[] {
  const seen = new Set<string>()
  const out: { value: number; unit: string }[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (it.type !== 'dose' || it.product !== product || it.value == null) continue
      const key = `${it.value}|${it.unit}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ value: it.value, unit: it.unit as string })
      }
      if (out.length >= 3) return out
    }
  }
  return out
}

function getStoredUnit(product: string): DoseUnit | null {
  try { return (localStorage.getItem(`ht_unit_${product}`) as DoseUnit) || null } catch { return null }
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function RegistrarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // ── Producto ─────────────────────────────────────────────────────────────────
  const defaultProduct = state.sheetArg ?? state.protocol?.product ?? state.importedProducts[0] ?? ''
  const [product, setProduct] = useState<string>(defaultProduct)
  const [showPicker, setShowPicker] = useState(!defaultProduct)
  const [searchQuery, setSearchQuery] = useState('')
  const [customProduct, setCustomProduct] = useState('')
  const [pickingCustom, setPickingCustom] = useState(false)

  const allProducts = buildProductList(state.importedProducts)

  const recentProducts = (() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const group of state.log) {
      for (const it of group.items) {
        if (it.type === 'dose' && it.product && !seen.has(it.product)) {
          seen.add(it.product)
          out.push(it.product)
        }
      }
      if (out.length >= 5) break
    }
    return out.slice(0, 5)
  })()

  const filteredProducts = searchQuery.trim().length > 0
    ? allProducts.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
    : allProducts

  function pickProduct(p: string) {
    setProduct(p)
    setShowPicker(false)
    setPickingCustom(false)
    setSearchQuery('')
    setVialStr('')
    setAguaStr('')
    setReconOpen(false)
  }

  function confirmCustom() {
    const name = customProduct.trim()
    if (!name) return
    setProduct(name)
    setShowPicker(false)
    setPickingCustom(false)
    setCustomProduct('')
    setSearchQuery('')
  }

  useEffect(() => {
    const arg = state.sheetArg
    if (!arg || arg === product) return
    setProduct(arg)
    setShowPicker(false)
    setPickingCustom(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sheetArg])

  // ── Dosis ────────────────────────────────────────────────────────────────────
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState<DoseUnit>(() => {
    const saved = product ? getStoredUnit(product) : null
    return saved ? normUnit(saved) : 'mg'
  })
  const [site, setSite] = useState<InjectionSite | null>(null)

  const prevProduct = useRef(product)
  useEffect(() => {
    if (product && product !== prevProduct.current) {
      prevProduct.current = product
      const pu = getStoredUnit(product)
      if (pu) setUnit(normUnit(pu))
    }
  }, [product])

  // ── Stepper ──────────────────────────────────────────────────────────────────
  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rampTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stepDose(delta: number) {
    const step = UNIT_STEP[unit] ?? 1
    const sign = delta > 0 ? 1 : -1
    const current = parseFloat(dose) || 0
    const next = Math.max(0, current + sign * step)
    setDose(String(next % 1 === 0 ? next : parseFloat(next.toFixed(4)).toString().replace(/\.?0+$/, '')))
  }

  function startRamp(delta: number) {
    rampTimeoutRef.current = setTimeout(() => {
      rampRef.current = setInterval(() => stepDose(delta), 200)
    }, 300)
  }

  function stopRamp() {
    if (rampRef.current) clearInterval(rampRef.current)
    if (rampTimeoutRef.current) clearTimeout(rampTimeoutRef.current)
    rampRef.current = null
    rampTimeoutRef.current = null
  }

  useEffect(() => () => stopRamp(), [])

  // ── Chips "Usadas antes" ─────────────────────────────────────────────────────
  const doseChips = product ? lastDoses(state.log, product) : []

  // ── R16/R17: Reconstitución del vial ─────────────────────────────────────────
  const [reconOpen, setReconOpen] = useState(false)
  const [vialStr, setVialStr] = useState('')
  const [aguaStr, setAguaStr] = useState('')

  // Precargar reconstitución recordada del producto
  useEffect(() => {
    const rec = product ? state.productRecon[product] : undefined
    if (rec) {
      setVialStr(String(rec.vialMg))
      setAguaStr(String(rec.aguaMl))
      setReconOpen(true)
    } else {
      setVialStr('')
      setAguaStr('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  // Abrir automáticamente solo cuando la unidad es UI (única que requiere reconstitución visible)
  useEffect(() => {
    if (unit === 'UI') setReconOpen(true)
  }, [unit])

  const vialMg = parseFloat(vialStr)
  const aguaMl = parseFloat(aguaStr)
  const doseNum = parseFloat(dose)

  const derivedMg = doseNum > 0 && vialMg > 0 && aguaMl > 0
    ? doseToMg(doseNum, unit, vialMg, aguaMl)
    : (unit === 'mg' && doseNum > 0 ? doseNum : (unit === 'mcg' && doseNum > 0 ? doseNum / 1000 : null))

  // ── R22: Hora de registro ──────────────────────────────────────────────────
  const [useNow, setUseNow] = useState(true)
  const [wheelTs, setWheelTs] = useState<number | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const finalTs = useNow ? undefined : (wheelTs ?? undefined)

  // ── R19: Nota libre ──────────────────────────────────────────────────────────
  const [nota, setNota] = useState('')
  const [showNota, setShowNota] = useState(false)

  // ── R19: Selector de efecto/síntoma ──────────────────────────────────────────
  const [effect, setEffect] = useState<string | undefined>(undefined)
  const [customEffect, setCustomEffect] = useState('')
  const [showCustomEffect, setShowCustomEffect] = useState(false)

  // ── Guardar ──────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(() => {
    if (saving) return
    const finalProduct = product.trim()
    if (!finalProduct) {
      dispatch({ t: 'toast', msg: 'Elige un producto primero' })
      setShowPicker(true)
      return
    }
    setSaving(true)

    const val = parseFloat(dose)
    if (!state.protocols[finalProduct] && finalProduct in PEPTIDES) {
      dispatch({ t: 'setProtocol', product: finalProduct })
      dispatch({ t: 'setCadence', cadence: presetCad(PEPTIDES[finalProduct]) })
    }

    const doseMg = (vialMg > 0 && aguaMl > 0)
      ? (doseToMg(val, unit, vialMg, aguaMl) ?? undefined)
      : (unit === 'mg' ? (val > 0 ? val : undefined) : unit === 'mcg' ? (val > 0 ? val / 1000 : undefined) : undefined)

    const recon = needsRecon(unit) && vialMg > 0 && aguaMl > 0
      ? { vialMg, aguaMl }
      : undefined

    const noteStr = nota.trim().slice(0, 200) || undefined
    const effectStr = showCustomEffect && customEffect.trim()
      ? customEffect.trim()
      : (effect ?? undefined)

    dispatch({
      t: 'logDose',
      product: finalProduct,
      value: val || null,
      unit,
      ts: finalTs,
      doseMg,
      recon,
      site: site ?? undefined,
      note: noteStr,
      effect: effectStr,
    })

    try { localStorage.setItem(`ht_unit_${finalProduct}`, unit) } catch { /* noop */ }
    onClose()
  }, [
    saving, product, dose, unit, site, finalTs,
    vialMg, aguaMl, nota, effect, customEffect, showCustomEffect,
    state.protocols, dispatch, onClose,
  ])

  // Reset al cerrar/abrir
  useEffect(() => {
    if (!open) {
      setSaving(false)
      setDose('')
      setSearchQuery('')
      setPickingCustom(false)
      setCustomProduct('')
      setSite(null)
      setNota('')
      setShowNota(false)
      setEffect(undefined)
      setCustomEffect('')
      setShowCustomEffect(false)
      setUseNow(true)
      setWheelTs(null)
      setShowTimePicker(false)
    }
  }, [open])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onClose={onClose} title="Registrar dosis">
      <div className="flex flex-col gap-5">

        {/* ── Selector de producto ── */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Producto
          </p>
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex min-h-[44px] items-center justify-between rounded-lg border border-white/10 bg-raised px-4 py-3 text-left active:scale-[.99]"
          >
            <span className="font-medium text-foreground">
              {product || 'Selecciona un producto'}
            </span>
            <span className="text-[13px] font-semibold text-teal">
              {showPicker ? 'Cerrar' : 'Cambiar'}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {showPicker && (
              <motion.div
                key="picker"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-3 rounded-lg border border-white/10 bg-void p-3"
              >
                <input
                  type="search"
                  placeholder="Buscar producto…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="h-11 w-full rounded-md border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                />

                {!searchQuery && recentProducts.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recientes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recentProducts.map((p) => (
                        <Chip key={p} active={p === product && !pickingCustom} onClick={() => pickProduct(p)}>
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {!searchQuery && (
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Catálogo
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {filteredProducts.map((p) => (
                      <Chip key={p} active={p === product && !pickingCustom} onClick={() => pickProduct(p)}>
                        {p}
                      </Chip>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="text-[13px] text-muted-foreground">Sin resultados</p>
                    )}
                    <Chip active={pickingCustom} onClick={() => setPickingCustom(true)}>
                      Otro
                    </Chip>
                  </div>
                </div>

                {pickingCustom && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={customProduct}
                      onChange={(e) => setCustomProduct(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmCustom()}
                      autoFocus
                      className="h-11 flex-1 rounded-md border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                    />
                    <button
                      type="button"
                      onClick={confirmCustom}
                      className="h-11 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground"
                    >
                      Listo
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Dosis — DataPlate + Stepper + unidades ── */}
        <div className="flex flex-col gap-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dosis
          </p>

          <Stepper
            onDec={() => { stepDose(-1) }}
            onInc={() => { stepDose(1) }}
            decLabel="Disminuir dosis"
            incLabel="Aumentar dosis"
          >
            <DataPlate className="flex items-center justify-center px-4 py-5">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Cantidad de dosis"
                placeholder="—"
                value={dose}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.')
                  if (/^\d*\.?\d*$/.test(v)) setDose(v)
                }}
                className="w-full bg-transparent text-center font-mono text-[42px] font-bold tabular-nums text-[var(--teal-bright)] placeholder:text-muted-foreground focus:outline-none"
              />
            </DataPlate>
          </Stepper>

          {/* Chips de unidad */}
          <div className="flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <Chip
                key={u.value}
                active={unit === u.value}
                onClick={() => setUnit(u.value)}
              >
                {u.label}
              </Chip>
            ))}
          </div>

          <p className="text-center text-[12px] text-muted-foreground">
            Paso: {UNIT_STEP[unit]} {unit}
            <span className="opacity-50"> · mantén ± para rampa</span>
          </p>

          {/* "Usadas antes" */}
          {doseChips.length > 0 && !dose && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Usadas antes
              </p>
              <div className="flex flex-wrap gap-2">
                {doseChips.map((d, i) => (
                  <Chip
                    key={i}
                    active={false}
                    onClick={() => {
                      setDose(String(d.value))
                      setUnit(normUnit(d.unit))
                    }}
                  >
                    {d.value} {normUnit(d.unit)}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── R16/R17: Reconstitución del vial — solo para UI (al registrar dosis) ── */}
        {unit === 'UI' && (
        <div
          className="rounded-xl border border-white/10 bg-raised/50 overflow-hidden"
          aria-label="Panel de reconstitución"
        >
          <button
            type="button"
            onClick={() => setReconOpen((v) => !v)}
            className="flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-foreground">
                Reconstitución del vial
              </span>
              {vialMg > 0 && aguaMl > 0 && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {vialMg} mg / {aguaMl} mL · {(vialMg / aguaMl).toFixed(2)} mg/mL
                </span>
              )}
            </div>
            {reconOpen ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
          </button>

          <AnimatePresence initial={false}>
            {reconOpen && (
              <motion.div
                key="recon-panel"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="flex flex-col gap-3 px-4 pb-4">
                  <p className="text-[12px] text-muted-foreground">
                    Ingresa el vial y el agua para calcular mg canónicos automáticamente.
                  </p>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1" htmlFor="reg-vial">
                        Vial (mg)
                      </label>
                      <input
                        id="reg-vial"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        placeholder="ej. 10"
                        value={vialStr}
                        onChange={(e) => setVialStr(e.target.value)}
                        className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 font-mono text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1" htmlFor="reg-agua">
                        Agua (mL)
                      </label>
                      <input
                        id="reg-agua"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        placeholder="ej. 2"
                        value={aguaStr}
                        onChange={(e) => setAguaStr(e.target.value)}
                        className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 font-mono text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                      />
                    </div>
                  </div>

                  {/* Resultado de conversión */}
                  {derivedMg != null ? (
                    <div className="rounded-lg bg-teal/10 border border-teal/25 px-3 py-2 text-center">
                      <span className="font-mono text-[15px] font-bold text-teal">
                        {derivedMg < 1 ? derivedMg.toFixed(3) : derivedMg < 10 ? derivedMg.toFixed(2) : derivedMg.toFixed(1)} mg
                      </span>
                      <span className="ml-2 text-[12px] text-muted-foreground">canónicos</span>
                    </div>
                  ) : (vialStr && aguaStr) ? (
                    <p className="text-center text-[12px] text-muted-foreground">
                      Ingresa también una dosis para ver la conversión
                    </p>
                  ) : null}

                  <p className="text-[11px] text-muted-foreground/60">
                    Dato orientativo. No es consejo médico.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* ── Zona de inyección (mapa interactivo) ── */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zona de inyección <span className="font-normal normal-case text-muted-foreground/70">· opcional</span>
          </p>
          <InjectionMap selected={site} onSelect={setSite} />
        </div>

        {/* ── Calculadora de reconstitución ── */}
        <button
          type="button"
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-teal/40 text-teal text-[13px] font-semibold active:scale-[.98] transition-transform"
          onClick={() => dispatch({ t: 'sheet', sheet: 'calc' })}
        >
          Calculadora de unidades
        </button>

        {/* ── R22: Hora de registro ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock size={13} className="opacity-70" />
              Hora de registro
            </p>
            <Chip
              active={useNow}
              onClick={() => {
                setUseNow(true)
                setShowTimePicker(false)
              }}
              className="h-8 text-[12px] px-3"
            >
              Ahora
            </Chip>
          </div>

          <button
            type="button"
            onClick={() => {
              setUseNow(false)
              setShowTimePicker((v) => !v)
            }}
            className="flex min-h-[44px] items-center justify-between rounded-lg border border-white/10 bg-raised/60 px-4 py-2.5 text-left active:scale-[.99]"
          >
            <span className={`text-[13px] font-medium ${!useNow ? 'text-teal' : 'text-muted-foreground'}`}>
              {!useNow && wheelTs
                ? (() => {
                    const d = new Date(wheelTs)
                    return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
                  })()
                : 'Elegir hora exacta'}
            </span>
            {showTimePicker && !useNow
              ? <ChevronUp size={15} className="text-muted-foreground" />
              : <ChevronDown size={15} className="text-muted-foreground" />}
          </button>

          <AnimatePresence initial={false}>
            {showTimePicker && !useNow && (
              <motion.div
                key="time-wheel"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <TimeWheelV2
                  onChange={(ts) => {
                    setWheelTs(ts)
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── R19: Nota libre ── */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex min-h-[44px] items-center gap-2 text-[13px] text-muted-foreground font-medium"
            onClick={() => setShowNota((v) => !v)}
          >
            {showNota ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showNota ? 'Ocultar nota' : 'Añadir nota (opcional)'}
          </button>
          <AnimatePresence initial={false}>
            {showNota && (
              <motion.div
                key="nota"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="relative">
                  <textarea
                    rows={2}
                    maxLength={200}
                    placeholder="Estado general, observaciones personales…"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    aria-label="Nota opcional (máx. 200 caracteres)"
                    className="w-full resize-none rounded-lg border border-white/10 bg-raised px-3 py-2.5 pb-6 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50 box-border"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <span className="absolute bottom-2 right-3 text-[11px] text-muted-foreground pointer-events-none">
                    {nota.length}/200
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── R19: Efecto/síntoma post-dosis ── */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            ¿Cómo te sientes? <span className="font-normal normal-case text-muted-foreground/70">· opcional</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {EFFECT_OPTIONS.filter((o) => o !== 'Otro').map((opt) => (
              <Chip
                key={opt}
                active={effect === opt}
                onClick={() => {
                  setEffect(effect === opt ? undefined : opt)
                  setShowCustomEffect(false)
                }}
              >
                {opt}
              </Chip>
            ))}
            <Chip
              active={showCustomEffect}
              onClick={() => {
                setShowCustomEffect((v) => !v)
                setEffect(undefined)
              }}
            >
              Otro
            </Chip>
          </div>
          <AnimatePresence initial={false}>
            {showCustomEffect && (
              <motion.div
                key="custom-effect"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden' }}
              >
                <input
                  type="text"
                  maxLength={80}
                  value={customEffect}
                  onChange={(e) => setCustomEffect(e.target.value)}
                  placeholder="Describe cómo te sientes…"
                  aria-label="Efecto personalizado"
                  autoFocus
                  className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CTA primario ── */}
        <Button
          variant="primary"
          size="full"
          disabled={saving}
          onClick={handleSave}
        >
          Registrar
        </Button>

        {/* ── Nota de privacidad ── */}
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
          <Shield size={12} className="shrink-0" />
          Tu historial se guarda solo en tu dispositivo
        </p>

      </div>
    </Sheet>
  )
}
