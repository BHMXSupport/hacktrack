// ConfirmDeleteSheet v2 — design system "Precision × Accessible"
// Confirmación destructiva para borrar un registro del diario.
// El borrado es inmediato; el store guarda el buffer de deshacer (5 s) vía toast + toastUndoId.
// Compliance: sin claims médicos, es-MX, tap targets ≥44px.
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

        {/* ── Advertencia ── */}
        <div className="flex gap-3 rounded-xl border border-alert/20 bg-alert/8 px-4 py-4">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-alert"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <p
              id="confirm-delete-title"
              className="text-[14px] font-semibold text-foreground"
            >
              ¿Eliminar este registro?
            </p>
            <p
              id="confirm-delete-desc"
              className="text-[13px] leading-relaxed text-secondary-foreground"
            >
              El registro se eliminará de tu diario.{' '}
              <strong className="text-foreground">
                Tendrás 5 segundos para deshacer.
              </strong>
            </p>
          </div>
        </div>

        {/* ── Acciones ── */}
        <div className="flex flex-col gap-3">
          {/* Botón destructivo — variante "plate" recoloreada con clases de alerta */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={!targetId}
            aria-disabled={!targetId}
            className="flex h-12 w-full items-center justify-center rounded-md bg-alert px-5 text-[15px] font-semibold text-white transition-[transform,opacity] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
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
