// ImportSheet v2 — design system "Precision × Accessible"
// Selector MANUAL de productos: el usuario elige del catálogo público lo que registra.
// Sin proveedor externo, sin puente de importación, sin flujo de conexión externa.
// Es un multi-select del catálogo; la app no ingiere datos de ninguna cuenta externa.
// Compliance: sin precios, sin catálogo comercial, sin claims médicos, es-MX, tap targets ≥44px.
// Excluido del build STORE_BUILD — el punto de entrada vive tras IMPORT_ENTRY_ENABLED.
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Check, Search } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'
import { PEPTIDES, CATEGORY_COLOR } from '../../lib/catalog'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cadencia legible desde PEPTIDES — ritmo general, nunca dosis ni prescripción. */
function cadenceLabel(name: string): string {
  const e = PEPTIDES[name]
  if (!e) return '—'
  switch (e.type) {
    case 'diaria':      return 'Diaria'
    case 'semanal':     return 'Semanal'
    case 'lv':          return 'Lun / Vie'
    case 'ciclo':       return `Ciclo ${e.on}/${e.off} sem`
    case 'cadaN':       return `Cada ${e.n} días`
    case 'por-demanda': return 'Por demanda'
    default:            return e.type
  }
}

// ── Sub-componente: fila de producto seleccionable ──────────────────────────────

function ProductRow({
  name,
  selected,
  onToggle,
}: {
  name: string
  selected: boolean
  onToggle: () => void
}) {
  const reduce = useReducedMotion()
  const entry = PEPTIDES[name]
  const color = entry ? CATEGORY_COLOR[entry.cat] : 'var(--teal)'

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
        <p className="text-[14px] font-semibold text-foreground leading-tight">{name}</p>
        {entry && (
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {entry.cat} · {cadenceLabel(name)}
          </p>
        )}
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

// ── Componente principal ───────────────────────────────────────────────────────

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()

  const [query, setQuery] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())

  // Resetear al cerrar para que la próxima apertura empiece limpia
  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setQuery('')
        setSel(new Set())
      }, 350)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const allNames = useMemo(() => Object.keys(PEPTIDES), [])
  // Ya rastreados: se ocultan del picker (importProducts fusiona, nunca duplica).
  const tracked = useMemo(() => new Set(Object.keys(state.protocols)), [state.protocols])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allNames
      .filter((n) => !tracked.has(n) && (!q || n.toLowerCase().includes(q)))
      .slice(0, 40)
  }, [query, allNames, tracked])

  const toggle = useCallback((name: string) => {
    setSel((s) => {
      const n = new Set(s)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }, [])

  const handleConfirm = useCallback(() => {
    const names = [...sel]
    if (names.length === 0) return
    dispatch({ t: 'importProducts', names })
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'toast', msg: `${names.length} producto${names.length !== 1 ? 's' : ''} agregado${names.length !== 1 ? 's' : ''}` })
    onClose()
  }, [sel, dispatch, onClose])

  const count = sel.size

  return (
    <Sheet open={open} onClose={onClose} title="Agrega tus productos">
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-secondary-foreground">
          Elige los que registras. Solo organizan tu seguimiento — no es recomendación médica ni de dosificación.
        </p>

        {/* Buscar en el catálogo */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto en el catálogo"
            className="h-12 w-full rounded-lg border border-white/20 bg-card pl-9 pr-3 text-[15px] text-foreground placeholder:text-secondary-foreground focus:border-teal/60 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>

        {/* Contador */}
        {count > 0 && (
          <span className="text-[12px] text-muted-foreground" aria-live="polite">
            {count} seleccionado{count !== 1 ? 's' : ''}
          </span>
        )}

        {/* Lista del catálogo */}
        <Glass className="p-0 divide-y divide-white/8 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
              <p className="text-[14px] text-secondary-foreground">
                {query.trim()
                  ? 'Sin resultados. Prueba otro nombre.'
                  : 'Ya estás rastreando todo el catálogo.'}
              </p>
            </div>
          ) : (
            results.map((n) => (
              <ProductRow
                key={n}
                name={n}
                selected={sel.has(n)}
                onToggle={() => toggle(n)}
              />
            ))
          )}
        </Glass>

        <p className="text-[12px] text-muted-foreground text-center">
          Tu historial se guarda solo en tu dispositivo.
        </p>

        <Button
          variant="primary"
          size="full"
          disabled={count === 0}
          onClick={handleConfirm}
        >
          {count === 0 ? (
            'Selecciona al menos uno'
          ) : (
            <>
              <Check size={16} aria-hidden="true" />
              Agregar {count} producto{count !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </Sheet>
  )
}
