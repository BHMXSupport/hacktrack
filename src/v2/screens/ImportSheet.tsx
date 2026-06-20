// ImportSheet v2 — design system "Precision × Accessible"
// Conectar cuenta BiohackMX (OAuth-style mock) → elegir compras → importProducts.
// Flujo de 3 fases: connect → orders → preview.
// Compliance: sin precios, sin catálogo, sin claims médicos, es-MX, tap targets ≥44px.
// SheetId sugerido: 'import' (agregar al tipo en AppV2/store).
import { useState, useEffect, useCallback } from 'react'
import { Check, FlaskConical, ChevronRight, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { MOCK_BIOHACKMX_PURCHASES, PEPTIDES, CATEGORY_COLOR } from '../../lib/catalog'
import type { BiohackmxPurchase } from '../../lib/catalog'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { Chip } from '../ui/Chip'

// ── Tipos locales ─────────────────────────────────────────────────────────────

type Phase = 'connect' | 'orders' | 'preview'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fecha relativa en es-MX a partir de '12 may 2026'. */
function relDate(raw: string): string {
  try {
    const months: Record<string, string> = {
      ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
      jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
    }
    const parts = raw.trim().toLowerCase().split(/\s+/)
    if (parts.length !== 3) return raw
    const [d, m, y] = parts
    const mm = months[m]
    if (!mm) return raw
    const date = new Date(`${y}-${mm}-${d.padStart(2, '0')}T12:00:00`)
    const diffMs = date.getTime() - Date.now()
    const diffDays = Math.round(diffMs / 86400000)
    const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })
    if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day')
    const diffMonths = Math.round(diffDays / 30)
    if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month')
    return rtf.format(Math.round(diffDays / 365), 'year')
  } catch {
    return raw
  }
}

/** Badge de estado basado en antigüedad: >90 días → terminado. */
function orderBadge(raw: string): 'activo' | 'terminado' {
  try {
    const months: Record<string, string> = {
      ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
      jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
    }
    const parts = raw.trim().toLowerCase().split(/\s+/)
    if (parts.length !== 3) return 'activo'
    const [d, m, y] = parts
    const mm = months[m]
    if (!mm) return 'activo'
    const date = new Date(`${y}-${mm}-${d.padStart(2, '0')}T12:00:00`)
    return (Date.now() - date.getTime()) / 86400000 > 90 ? 'terminado' : 'activo'
  } catch {
    return 'activo'
  }
}

/** Cadencia legible desde PEPTIDES. */
function cadenceLabel(name: string): string {
  const e = PEPTIDES[name]
  if (!e) return '—'
  switch (e.type) {
    case 'diaria':     return 'Diaria'
    case 'semanal':    return 'Semanal'
    case 'lv':         return 'Lun / Vie'
    case 'ciclo':      return `Ciclo ${e.on}/${e.off} sem`
    case 'cadaN':      return `Cada ${e.n} días`
    case 'por-demanda': return 'Por demanda'
    default:           return e.type
  }
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 opacity-50 pointer-events-none">
      <span className="h-2.5 w-2.5 rounded-full bg-white/15 shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <span className="h-3.5 w-28 rounded bg-white/10" />
        <span className="h-3 w-40 rounded bg-white/8" />
      </div>
    </div>
  )
}

// Fila de compra seleccionable
function PurchaseRow({
  purchase,
  selected,
  onToggle,
}: {
  purchase: BiohackmxPurchase
  selected: boolean
  onToggle: () => void
}) {
  const reduce = useReducedMotion()
  const entry = PEPTIDES[purchase.product]
  const color = entry ? CATEGORY_COLOR[entry.cat] : 'var(--teal)'
  const badge = orderBadge(purchase.date)

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
    >
      {/* Dot categoría */}
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-foreground leading-tight">{purchase.product}</p>
        <p className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] text-muted-foreground">
            {cadenceLabel(purchase.product)} · {relDate(purchase.date)}
          </span>
          <span
            className="text-[11px] font-semibold px-1.5 py-px rounded-full"
            style={{
              background: badge === 'activo'
                ? 'rgba(47,181,124,0.18)'
                : 'rgba(255,255,255,0.08)',
              color: badge === 'activo' ? '#2FB57C' : 'var(--muted-foreground)',
            }}
          >
            {badge}
          </span>
        </p>
      </div>

      {/* Checkbox visual */}
      <motion.span
        animate={reduce ? undefined : { scale: selected ? 1 : 0.85, opacity: selected ? 1 : 0.35 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="shrink-0 h-6 w-6 rounded-[7px] flex items-center justify-center"
        style={{
          background: selected ? 'var(--teal)' : 'transparent',
          border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
        }}
        aria-hidden="true"
      >
        {selected && <Check size={14} strokeWidth={2.5} className="text-void" />}
      </motion.span>
    </button>
  )
}

// ── Fases ──────────────────────────────────────────────────────────────────────

function PhaseConnect({ onNext }: { onNext: () => void }) {
  const [consent, setConsent] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      {/* Aviso de demostración — la conexión real no existe todavía */}
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          style={{ background: 'rgba(95,201,184,0.18)', color: '#5FC9B8' }}
        >
          Demo
        </span>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Vista de demostración — la sincronización real estará disponible pronto.
        </p>
      </div>

      {/* Hero BiohackMX — branding partner */}
      <Glass className="flex flex-col items-center gap-4 py-7 text-center">
        {/* Matraz BiohackMX — lucide FlaskConical con gradiente mint de marca */}
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)',
            boxShadow: '0 0 24px rgba(95,201,184,0.18)',
          }}
        >
          <FlaskConical size={28} style={{ color: '#5FC9B8' }} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Partner oficial
          </p>
          <h3 className="text-[17px] font-bold text-foreground">BiohackMX</h3>
        </div>
        <p className="text-[13px] text-secondary-foreground leading-relaxed max-w-[260px]">
          Conecta tu cuenta para importar las compras que quieres trackear.
          Iniciamos sesión en el sitio de BiohackMX — nunca vemos tu contraseña.
        </p>
      </Glass>

      {/* Consentimiento */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-describedby="consent-desc"
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-teal"
        />
        <span
          id="consent-desc"
          className="text-[13px] text-secondary-foreground leading-relaxed"
        >
          Doy mi consentimiento para transferir los datos de mis compras de forma segura.
        </span>
      </label>

      {/* Nota de privacidad */}
      <p className="text-[12px] text-muted-foreground text-center">
        Tu historial se guarda solo en tu dispositivo.
      </p>

      <Button
        variant="primary"
        size="full"
        disabled={!consent}
        onClick={onNext}
        className="flex items-center justify-center gap-2"
      >
        <FlaskConical size={16} aria-hidden="true" />
        Conectar con BiohackMX
      </Button>
    </div>
  )
}

function PhaseOrders({
  purchases,
  loading,
  errored,
  selected,
  onToggle,
  onToggleAll,
  onRetry,
  onNext,
  onSkip,
}: {
  purchases: BiohackmxPurchase[] | null
  loading: boolean
  errored: boolean
  selected: Set<string>
  onToggle: (product: string) => void
  onToggleAll: () => void
  onRetry: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const total = purchases?.length ?? 0
  const uniqueTotal = purchases != null ? new Set(purchases.map((p) => p.product)).size : 0
  const allSelected = uniqueTotal > 0 && selected.size === uniqueTotal

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[16px] font-bold text-foreground">Tus compras en BiohackMX</h3>
        <p className="mt-1 text-[13px] text-secondary-foreground">
          Elige las que estás usando actualmente. Omite las que ya terminaste.
        </p>
      </div>

      {/* Chip «seleccionar todo» */}
      {!loading && !errored && uniqueTotal > 0 && (
        <div className="flex items-center gap-3">
          <Chip active={allSelected} onClick={onToggleAll} className="h-9">
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </Chip>
          <span className="text-[12px] text-muted-foreground" aria-live="polite">
            {selected.size} de {uniqueTotal}
          </span>
        </div>
      )}

      {/* Lista */}
      <Glass className="p-0 divide-y divide-white/8 overflow-hidden">
        {loading && [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}

        {errored && (
          <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
            <p className="text-[14px] text-secondary-foreground">
              No encontramos compras recientes
            </p>
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RotateCcw size={14} aria-hidden="true" />
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !errored && purchases && purchases.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
            <p className="text-[14px] text-secondary-foreground">
              No encontramos compras en tu cuenta
            </p>
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RotateCcw size={14} aria-hidden="true" />
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !errored && purchases && purchases.map((p) => (
          <PurchaseRow
            key={p.product + p.orderId}
            purchase={p}
            selected={selected.has(p.product)}
            onToggle={() => onToggle(p.product)}
          />
        ))}
      </Glass>

      <Button
        variant="primary"
        size="full"
        disabled={selected.size === 0}
        onClick={onNext}
      >
        {selected.size === 0
          ? 'Selecciona al menos uno'
          : selected.size === 1
          ? 'Confirmar 1 producto'
          : `Confirmar ${selected.size} productos`}
        {selected.size > 0 && <ChevronRight size={16} aria-hidden="true" />}
      </Button>

      <Button variant="ghost" size="full" onClick={onSkip} className="text-muted-foreground">
        Lo agrego manualmente
      </Button>
    </div>
  )
}

function PhasePreview({
  selected,
  onConfirm,
  onBack,
}: {
  selected: string[]
  onConfirm: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[16px] font-bold text-foreground">Confirma tu selección</h3>
        <p className="mt-1 text-[13px] text-secondary-foreground">
          Estos productos se añadirán a tu protocolo activo.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {selected.map((name) => {
          const entry = PEPTIDES[name]
          const color = entry ? CATEGORY_COLOR[entry.cat] : 'var(--teal)'
          return (
            <Glass key={name} className="flex items-center gap-3 py-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-foreground">{name}</p>
                {entry && (
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {entry.cat} · {cadenceLabel(name)}
                  </p>
                )}
              </div>
              {entry && (
                <span
                  className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: color + '22', color }}
                >
                  {entry.cat}
                </span>
              )}
            </Glass>
          )
        })}
      </div>

      <p className="text-[12px] text-muted-foreground text-center">
        Tu historial se guarda solo en tu dispositivo.
      </p>

      <Button variant="primary" size="full" onClick={onConfirm}>
        <Check size={16} aria-hidden="true" />
        Importar {selected.length} producto{selected.length !== 1 ? 's' : ''}
      </Button>

      <Button variant="ghost" size="full" onClick={onBack} className="text-muted-foreground">
        Editar selección
      </Button>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useApp()
  const reduce = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('connect')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [purchases, setPurchases] = useState<BiohackmxPurchase[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [errored, setErrored] = useState(false)

  // Resetear al cerrar para que la próxima apertura empiece desde connect
  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setPhase('connect')
        setSel(new Set())
        setPurchases(null)
        setLoading(false)
        setErrored(false)
      }, 350)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const loadOrders = useCallback(() => {
    setLoading(true)
    setErrored(false)
    setPurchases(null)
    window.setTimeout(() => {
      setLoading(false)
      setPurchases(MOCK_BIOHACKMX_PURCHASES)
    }, 700)
  }, [])

  // Cargar pedidos al pasar a fase orders
  useEffect(() => {
    if (phase === 'orders' && purchases === null && !loading && !errored) {
      loadOrders()
    }
  }, [phase, purchases, loading, errored, loadOrders])

  const toggle = useCallback((product: string) => {
    setSel((s) => {
      const n = new Set(s)
      n.has(product) ? n.delete(product) : n.add(product)
      return n
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (!purchases) return
    const uniqueProducts = [...new Set(purchases.map((p) => p.product))]
    setSel((s) =>
      s.size === uniqueProducts.length ? new Set() : new Set(uniqueProducts),
    )
  }, [purchases])

  const handleSkip = useCallback(() => {
    dispatch({ t: 'go', screen: 's-app' })
    onClose()
  }, [dispatch, onClose])

  const handleConfirm = useCallback(() => {
    const names = [...sel]
    if (names.length === 0) return
    dispatch({ t: 'importProducts', names })
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'toast', msg: `${names.length} producto${names.length !== 1 ? 's' : ''} importado${names.length !== 1 ? 's' : ''}` })
    onClose()
  }, [sel, dispatch, onClose])

  const selList = [...sel]

  // Título dinámico por fase
  const title =
    phase === 'connect' ? 'Conectar BiohackMX'
    : phase === 'orders' ? 'Tus compras'
    : 'Confirmar importación'

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 20 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {phase === 'connect' && (
            <PhaseConnect onNext={() => setPhase('orders')} />
          )}
          {phase === 'orders' && (
            <PhaseOrders
              purchases={purchases}
              loading={loading}
              errored={errored}
              selected={sel}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onRetry={loadOrders}
              onNext={() => setPhase('preview')}
              onSkip={handleSkip}
            />
          )}
          {phase === 'preview' && (
            <PhasePreview
              selected={selList}
              onConfirm={handleConfirm}
              onBack={() => setPhase('orders')}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  )
}
