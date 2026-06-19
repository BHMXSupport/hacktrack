// RegistrarSheet v2 — design system "Precision × Accessible"
// Compliance: sin dosis precargada, sin vía de administración, sin claims médicos.
// Privacidad: historial local only.
import { useState, useCallback, useEffect, useRef } from 'react'
import { Shield } from 'lucide-react'
import { useApp } from '../../lib/store'
import { PEPTIDES } from '../../lib/catalog'
import { presetCad } from '../../lib/cadence'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { DataPlate } from '../ui/DataPlate'

// ── Tipos y constantes ────────────────────────────────────────────────────────

type DoseUnit = 'mg' | 'mcg' | 'UI' | 'mL'

const UNITS: { value: DoseUnit; label: string }[] = [
  { value: 'mg',  label: 'mg' },
  { value: 'mcg', label: 'mcg' },
  { value: 'UI',  label: 'UI' },
  { value: 'mL',  label: 'mL' },
]

// Step adaptativo por unidad (alineado con la hoja vieja)
const UNIT_STEP: Record<DoseUnit, number> = {
  mcg: 50,
  mg: 0.1,
  UI: 1,
  mL: 0.05,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProductList(importedProducts: string[]): string[] {
  const catalog = Object.keys(PEPTIDES)
  return [...new Set([...importedProducts, ...catalog])]
}

type LogGroups = ReturnType<typeof useApp>['state']['log']

/** Últimas 3 dosis únicas del producto (chips "Usadas antes"). */
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

/** Unidad recordada por producto en localStorage (item 429). */
function getStoredUnit(product: string): DoseUnit | null {
  try { return (localStorage.getItem(`ht_unit_${product}`) as DoseUnit) || null } catch { return null }
}

// ── Componente ────────────────────────────────────────────────────────────────

export function RegistrarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()

  // ── Producto ────────────────────────────────────────────────────────────────
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

  // Sincronizar producto cuando cambia sheetArg
  useEffect(() => {
    const arg = state.sheetArg
    if (!arg || arg === product) return
    setProduct(arg)
    setShowPicker(false)
    setPickingCustom(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sheetArg])

  // ── Dosis — campo controlado; SIEMPRE vacío al abrir ─────────────────────
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState<DoseUnit>(() => {
    const saved = product ? getStoredUnit(product) : null
    return saved ?? 'mg'
  })

  // Restaurar unidad recordada al cambiar producto
  const prevProduct = useRef(product)
  useEffect(() => {
    if (product && product !== prevProduct.current) {
      prevProduct.current = product
      const pu = getStoredUnit(product)
      if (pu) setUnit(pu)
    }
  }, [product])

  // ── Stepper −/+ ──────────────────────────────────────────────────────────
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

  // Limpiar ramp al desmontar
  useEffect(() => () => stopRamp(), [])

  // ── Chips "Usadas antes" ─────────────────────────────────────────────────
  const doseChips = product ? lastDoses(state.log, product) : []

  // ── Guardar ──────────────────────────────────────────────────────────────
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
    // Crear protocolo si el producto no tiene uno aún
    if (!state.protocols[finalProduct] && finalProduct in PEPTIDES) {
      dispatch({ t: 'setProtocol', product: finalProduct })
      dispatch({ t: 'setCadence', cadence: presetCad(PEPTIDES[finalProduct]) })
    }
    dispatch({
      t: 'logDose',
      product: finalProduct,
      value: val || null,
      unit,
    })
    // Persistir unidad recordada (item 429)
    try { localStorage.setItem(`ht_unit_${finalProduct}`, unit) } catch { /* noop */ }
    onClose()
  }, [saving, product, dose, unit, state.protocols, dispatch, onClose])

  // Reset estado interno al cerrar/abrir
  useEffect(() => {
    if (!open) {
      setSaving(false)
      setDose('')
      setSearchQuery('')
      setPickingCustom(false)
      setCustomProduct('')
    }
  }, [open])

  // ── Render ────────────────────────────────────────────────────────────────
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

          {showPicker && (
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-void p-3">
              {/* Búsqueda */}
              <input
                type="search"
                placeholder="Buscar producto…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="h-11 w-full rounded-md border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
              />

              {/* Recientes */}
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

              {/* Catálogo filtrado */}
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

              {/* Producto personalizado */}
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
            </div>
          )}
        </div>

        {/* ── Dosis — DataPlate + Stepper ── */}
        <div className="flex flex-col gap-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dosis
          </p>

          <Stepper
            onDec={() => stepDose(-1)}
            onInc={() => stepDose(1)}
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
                onPointerDown={(e) => {
                  // Permitir long-press en los botones de Stepper
                  const target = e.target as HTMLElement
                  if (target.tagName !== 'INPUT') return
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

          {/* "Usadas antes" — solo cuando hay historial y el campo está vacío */}
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
                      setUnit(d.unit as DoseUnit)
                    }}
                  >
                    {d.value} {d.unit}
                  </Chip>
                ))}
              </div>
            </div>
          )}
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
