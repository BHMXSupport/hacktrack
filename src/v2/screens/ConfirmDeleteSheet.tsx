// ConfirmDeleteSheet — "Bitácora": confirmación destructiva cálida (rojo de alerta sobre papel/tinta).
// El borrado es inmediato; el store guarda el buffer de deshacer (5 s) vía toast + toastUndoId.
// Compliance: sin claims médicos, es-MX, tap targets ≥44px. Elevación = reglas (hairline), no glows.
import { useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'

export function ConfirmDeleteSheet({
  open,
  onClose,
  id,
}: {
  open: boolean
  onClose: () => void
  id?: string | null
}) {
  const { dispatch } = useApp()

  // El id puede venir por prop o bien por sheetArg (compatibilidad con el flujo del store).
  // En ambos casos es el id del LogItem a borrar.
  const { state } = useApp()
  const targetId = id ?? state.sheetArg ?? null

  const handleDelete = useCallback(() => {
    if (!targetId) return
    dispatch({ t: 'deleteLog', id: targetId })
    // El store cierra el sheet (sheet: null) y activa el toast con undo automáticamente.
    // Si el caller gestiona el cierre explícitamente, llamamos onClose también.
    onClose()
  }, [targetId, dispatch, onClose])

  const handleCancel = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <Sheet
      open={open}
      onClose={handleCancel}
      title="Borrar registro"
    >
      {/* role=alertdialog indica contenido destructivo para lectores de pantalla */}
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title" aria-describedby="confirm-delete-desc" className="flex flex-col gap-5">

        {/* ── Advertencia: nota al margen en rojo cálido (tinte + hairline de alerta) ──
            color-mix en clases arbitrarias: el alfa sobre var(--x) (bg-alert/8) NO se emite en este setup. */}
        <div className="flex gap-3 rounded-sm border border-[color-mix(in_srgb,var(--alert)_35%,transparent)] bg-[color-mix(in_srgb,var(--alert)_7%,transparent)] px-4 py-4">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-alert"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            {/* Serif = la voz editorial también en el momento de borrar */}
            <p
              id="confirm-delete-title"
              className="font-serif text-[17px] font-medium tracking-tight text-ink"
            >
              ¿Eliminar este registro?
            </p>
            <p
              id="confirm-delete-desc"
              className="text-[14px] leading-relaxed text-ink-2"
            >
              El registro se eliminará de tu diario.{' '}
              <strong className="font-semibold text-ink">
                Tendrás 5 segundos para deshacer.
              </strong>
            </p>
          </div>
        </div>

        {/* ── Acciones ── */}
        <div className="flex flex-col gap-3">
          {/* Botón destructivo — relleno de alerta sólido; la tinta del texto la resuelve
              --primary-foreground por tema (blanco cálido sobre rojo profundo en Papel;
              tinta oscura sobre coral luminoso en Tinta) → AA en ambos. Radio 8 de imprenta. */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={!targetId}
            aria-disabled={!targetId}
            className="flex h-12 w-full items-center justify-center rounded-[8px] bg-alert px-5 text-[15px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(26,23,18,.20)] transition-[transform,opacity] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            Borrar
          </button>

          {/* Botón cancelar */}
          <Button
            variant="ghost"
            size="full"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
        </div>

      </div>
    </Sheet>
  )
}
