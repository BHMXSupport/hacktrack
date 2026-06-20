import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../../lib/store'

// Toast + "Deshacer" — diseño del rebuild (píldora de vidrio). Lógica reusada de lib/store:
// toastUndoId que empieza con __undo_delete__ → undoDeleteLog; si no → deleteLog (deshacer registro).
export function Toast() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()
  const hasUndo = !!state.toastUndoId

  useEffect(() => {
    if (!state.toast) return
    const t = window.setTimeout(() => dispatch({ t: 'toast', msg: null }), hasUndo ? 5000 : 2400)
    return () => window.clearTimeout(t)
  }, [state.toast, hasUndo, dispatch])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {state.toast && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 z-[10001] flex justify-center px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 30 }}
          role="status"
          aria-live="polite"
        >
          <div className="glass pointer-events-auto flex max-w-full items-center gap-3 rounded-full px-4 py-2.5 text-[14px] text-foreground shadow-glass">
            <span className="truncate">{state.toast}</span>
            {hasUndo && (
              <button
                type="button"
                className="shrink-0 font-semibold text-teal"
                onClick={() => {
                  const id = state.toastUndoId!
                  if (id.startsWith('__undo_delete__')) dispatch({ t: 'undoDeleteLog' })
                  else dispatch({ t: 'deleteLog', id })
                  dispatch({ t: 'toast', msg: null })
                }}
              >
                Deshacer
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
