// ProtocolosSheet v2 — design system "Precision × Accessible"
// Lista y gestión de múltiples protocolos del usuario.
// Muestra cada protocolo con cadencia legible, estado activo/archivado,
// botones para editar (→ ProtocoloEditSheet) y archivar.
// Compliance: sin claims médicos, es-MX, tap targets ≥44px.
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Archive, ArchiveRestore, Settings2, ChevronDown, ChevronUp, Pencil, Droplet } from 'lucide-react'
import { useApp, doseForProduct } from '../../lib/store'
import { CATEGORY_COLOR, PEPTIDES } from '../../lib/catalog'
import { cadenceLabel, proximasCadence } from '../../lib/cadence'
import { Sheet } from '../ui/Sheet'
import { ProtocoloEditSheet } from './ProtocoloEditSheet'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

// ── Tarjeta de protocolo ─────────────────────────────────────────────────────

function ProtocolCard({
  product,
  onEdit,
}: {
  product: string
  onEdit: (product: string) => void
}) {
  const { state, dispatch } = useApp()
  const p = state.protocols[product]
  const entry = PEPTIDES[product]
  const reduce = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  if (!p) return null

  const isActive = !p.archived
  const cadLabel = p.cadence ? cadenceLabel(p.cadence) : 'Sin cadencia'
  const accentColor = entry ? CATEGORY_COLOR[entry.cat] : '#5FC9B8'
  const catLabel = entry?.cat ?? 'Personalizado'

  // Próximas 3 tomas para la vista expandida
  const proximas =
    p.cadence && isActive
      ? proximasCadence(p.cadence, new Date(p.startDate), new Date(), 3)
      : []

  function handleArchive() {
    dispatch({ t: 'archiveProtocol', product })
    dispatch({ t: 'toast', msg: `${product} archivado` })
  }
  function handleReactivate() {
    dispatch({ t: 'reactivateProtocol', product })
    dispatch({ t: 'toast', msg: `${product} reactivado` })
  }

  const isCurrentActive = state.activeProduct === product

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border transition-colors ${
        p.archived
          ? 'border-white/6 bg-raised/40 opacity-60'
          : isCurrentActive
          ? 'border-teal/30 bg-raised'
          : 'border-white/10 bg-raised'
      }`}
    >
      {/* Banda de color de categoría */}
      <div
        className="h-0.5 w-full"
        style={{ background: accentColor }}
        aria-hidden
      />

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-foreground truncate">
              {product}
            </span>
            {isCurrentActive && !p.archived && (
              <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal">
                Principal
              </span>
            )}
            {p.archived && (
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Archivado
              </span>
            )}
          </div>
          <span className="text-[12px] text-muted-foreground">{catLabel}</span>
          {/* #9: chip de cadencia TAPPABLE → editar días y cadencia (descubrible, con etiqueta) */}
          <button
            type="button"
            onClick={() => onEdit(product)}
            aria-label={`Editar días y cadencia de ${product} (actual: ${cadLabel})`}
            className="mt-1 inline-flex min-h-[32px] items-center gap-1.5 self-start rounded-full border border-teal/30 bg-teal/8 px-3 py-1 text-[11px] font-semibold text-teal transition-colors hover:bg-teal/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {cadLabel}
            <Pencil size={11} aria-hidden />
          </button>
          {/* #22: resumen de un vistazo — dosis por toma + vial restante */}
          {(() => {
            const dose = doseForProduct(state, product)
            const remaining = p.vialStock && p.vialStock.totalMg > 0
              ? p.vialStock.totalMg - (p.vialStock.usedMg ?? 0)
              : null
            if (!dose && remaining == null) return null
            return (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-secondary-foreground">
                {dose && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    {dose.value} {dose.unit}<span className="text-muted-foreground">/toma</span>
                  </span>
                )}
                {remaining != null && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Droplet size={11} className="text-teal" aria-hidden />
                    {remaining.toFixed(1)} mg<span className="text-muted-foreground"> en vial</span>
                  </span>
                )}
              </div>
            )
          })()}
        </div>

        {/* Botones de acción */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(product)}
            aria-label={`Editar protocolo de ${product}`}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-transparent text-secondary-foreground transition-colors hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Settings2 size={18} aria-hidden />
          </button>
          {isActive ? (
            <button
              type="button"
              onClick={handleArchive}
              aria-label={`Archivar ${product}`}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-transparent text-muted-foreground transition-colors hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Archive size={18} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReactivate}
              aria-label={`Reactivar ${product}`}
              className="grid h-11 w-11 place-items-center rounded-full border border-teal/30 bg-transparent text-teal transition-colors hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArchiveRestore size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Expandir: fechas + próximas tomas */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`proto-detail-${product}`}
        className="flex h-9 items-center justify-center gap-1 border-t border-white/6 px-4 text-[12px] text-muted-foreground hover:bg-white/4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        {expanded ? 'Ocultar detalle' : 'Ver detalle'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`proto-detail-${product}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 border-t border-white/6 px-4 py-3">
              {/* Fechas */}
              <div className="flex gap-4 text-[12px]">
                <span className="text-muted-foreground">
                  Inicio:{' '}
                  <strong className="text-secondary-foreground font-mono">
                    {new Date(p.startDate).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                </span>
                {p.endDate && (
                  <span className="text-muted-foreground">
                    Fin:{' '}
                    <strong className="text-secondary-foreground font-mono">
                      {new Date(p.endDate).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                  </span>
                )}
              </div>

              {/* Hora de recordatorio */}
              {p.reminderTime && (
                <span className="text-[12px] text-muted-foreground">
                  Recordatorio:{' '}
                  <strong className="font-mono text-secondary-foreground">
                    {p.reminderTime}
                  </strong>
                </span>
              )}

              {/* Titulación */}
              {p.progOn && (
                <span className="text-[12px] text-muted-foreground">
                  Titulación:{' '}
                  <strong className="text-secondary-foreground">{p.progN} fases</strong>
                </span>
              )}

              {/* Stock */}
              {p.vialStock && p.vialStock.totalMg > 0 && (
                <span className="text-[12px] text-muted-foreground">
                  Vial:{' '}
                  <strong className="font-mono text-secondary-foreground">
                    {(p.vialStock.totalMg - (p.vialStock.usedMg ?? 0)).toFixed(1)} mg restantes
                  </strong>
                </span>
              )}

              {/* Próximas tomas */}
              {proximas.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">
                    Próximas tomas:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {proximas.map((d, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-teal/25 bg-teal/8 px-2.5 py-0.5 text-[11px] font-semibold text-teal"
                      >
                        {fmtShortDate(d)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ProtocolosSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { state } = useApp()
  const [editProduct, setEditProduct] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const activeProducts = Object.keys(state.protocols).filter(
    (k) => !state.protocols[k].archived,
  )
  const archivedProducts = Object.keys(state.protocols).filter(
    (k) => state.protocols[k].archived,
  )

  const hasArchived = archivedProducts.length > 0

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Mis protocolos">
        <div className="flex flex-col gap-4 pb-4">

          {activeProducts.length === 0 && archivedProducts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-[14px] text-secondary-foreground">
                Sin protocolos configurados.
              </p>
              <p className="text-[12px] text-muted-foreground">
                Agrega un producto en la pantalla principal para empezar.
              </p>
            </div>
          )}

          {/* Protocolos activos */}
          {activeProducts.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                Activos ({activeProducts.length})
              </p>
              {activeProducts.map((prod) => (
                <ProtocolCard
                  key={prod}
                  product={prod}
                  onEdit={(p) => {
                    setEditProduct(p)
                  }}
                />
              ))}
            </div>
          )}

          {/* Toggle archivados */}
          {hasArchived && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex h-11 items-center gap-2 self-start rounded-full bg-transparent px-1 text-[13px] font-semibold text-muted-foreground hover:text-secondary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                aria-expanded={showArchived}
              >
                {showArchived ? (
                  <ChevronUp size={15} aria-hidden />
                ) : (
                  <ChevronDown size={15} aria-hidden />
                )}
                Archivados ({archivedProducts.length})
              </button>

              <AnimatePresence>
                {showArchived && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-3 overflow-hidden"
                  >
                    {archivedProducts.map((prod) => (
                      <ProtocolCard
                        key={prod}
                        product={prod}
                        onEdit={(p) => {
                          setEditProduct(p)
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Tu historial se guarda solo en tu dispositivo. Hacktrack no prescribe dosis ni
            cadencias.
          </p>
        </div>
      </Sheet>

      {/* Sheet de edición anidado — se monta encima del listado */}
      {/* #37: key fuerza remontaje limpio al cambiar de producto */}
      <ProtocoloEditSheet
        key={editProduct ?? undefined}
        open={editProduct != null}
        onClose={() => setEditProduct(null)}
        product={editProduct}
      />
    </>
  )
}
