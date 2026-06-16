// Confirmación destructiva reutilizable — bottom-sheet.
// Items: 304 (borrado de log con undo de 5s — sin doble confirmación),
//        336 (shake + haptic de error cuando BORRAR es incorrecto)
import { useState, useRef, useEffect } from 'react'
import { motion, useAnimate, AnimatePresence } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'
import { errorHaptic } from '../lib/haptics'

const CONFIRM_WORD = 'BORRAR'

export function ConfirmDeleteSheet() {
  const { state, dispatch } = useApp()
  const isAccount = state.sheetArg === '__account'
  const isLogout = state.sheetArg === '__logout'
  const isProduct = !!state.sheetArg?.startsWith('product:')
  const productName = isProduct ? state.sheetArg!.slice('product:'.length) : null
  // item 304: es un registro del diario (no cuenta/logout/producto)
  const isLogEntry = !isAccount && !isLogout && !isProduct && !!state.sheetArg

  const [typed, setTyped] = useState('')
  const confirmed = isAccount ? typed === CONFIRM_WORD : true

  // item 336: shake + haptic de error
  const [inputScope, animateInput] = useAnimate()
  const prevTyped = useRef('')

  useEffect(() => {
    if (!isAccount) return
    if (typed.length >= CONFIRM_WORD.length && typed !== CONFIRM_WORD) {
      // solo disparar cuando alcanza la longitud y es incorrecto
      if (prevTyped.current !== typed) {
        errorHaptic()
        animateInput(inputScope.current, {
          x: [-4, 4, -4, 4, -3, 3, 0],
        }, { duration: 0.35, ease: 'easeInOut' })
      }
    }
    prevTyped.current = typed
  }, [typed, isAccount, animateInput, inputScope])

  function handleCancel() {
    dispatch({ t: 'sheet', sheet: isAccount ? 'perfil' : null })
  }

  function handleDelete() {
    if (!confirmed) return
    if (isAccount) {
      dispatch({ t: 'arcoDelete' })
    } else if (isLogout) {
      dispatch({ t: 'reset' })
    } else if (isProduct && productName) {
      dispatch({ t: 'deleteProduct', product: productName })
      dispatch({ t: 'toast', msg: `${productName} quitado del seguimiento` })
      dispatch({ t: 'sheet', sheet: null })
    } else if (isLogEntry && state.sheetArg) {
      // item 304: borrado inmediato con undo de 5s
      dispatch({ t: 'deleteLog', id: state.sheetArg })
      // El toast con undo ya lo maneja el store (deletedLogBuffer + toastUndoId)
      dispatch({ t: 'sheet', sheet: null })
    } else if (state.sheetArg) {
      dispatch({ t: 'deleteLog', id: state.sheetArg })
    }
  }

  const title = isAccount ? 'Borrar mi cuenta' : isLogout ? 'Cerrar sesión' : isProduct ? `Quitar ${productName}` : 'Borrar registro'

  // item 304: para log entries, mostrar flujo simplificado sin doble confirmación
  if (isLogEntry) {
    return (
      <Sheet title="Borrar registro" onClose={handleCancel}>
        <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            background: 'color-mix(in srgb, var(--error) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
              Este registro se eliminará de tu diario.{' '}
              <strong>Tendrás 5 segundos para deshacer.</strong>
            </p>
          </div>

          <Disclaimer kind="general" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn"
              style={{
                width: '100%', height: 52, borderRadius: 16, fontSize: 16, fontWeight: 600,
                background: 'var(--error)', color: '#fff', cursor: 'pointer',
              }}
              onClick={handleDelete}>
              Borrar
            </button>
            <button className="btn btn-ghost"
              style={{ width: '100%', height: 48, borderRadius: 16, fontSize: 16 }}
              onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={title} onClose={handleCancel}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Advertencia */}
        <div style={{
          background: 'color-mix(in srgb, var(--error) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          {isAccount ? (
            <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
              Esta acción eliminará todos tus datos de forma permanente: registros, protocolo, perfil y configuración.{' '}
              <strong>No se puede deshacer.</strong>
            </p>
          ) : isLogout ? (
            <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
              Se cerrará tu sesión y se borrarán los datos guardados en este dispositivo.{' '}
              <strong>No se puede deshacer.</strong>
            </p>
          ) : (
            <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
              <strong>{productName}</strong> dejará de aparecer en tu calendario y adherencia a futuro.{' '}
              Tus <strong>registros pasados se conservan</strong> en el diario.
            </p>
          )}
        </div>

        {/* Campo de confirmación — solo para borrado de cuenta (item 336: shake + haptic) */}
        {isAccount && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label" htmlFor="confirm-borrar" style={{ color: 'var(--ink-700)' }}>
              Escribe <span className="mono" style={{ fontWeight: 700 }}>{CONFIRM_WORD}</span> para confirmar
            </label>
            <motion.div ref={inputScope}>
              <input
                id="confirm-borrar"
                type="text"
                className={'field body' + (typed.length > 0 && typed !== CONFIRM_WORD ? ' error' : '')}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder={CONFIRM_WORD}
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                style={{ width: '100%', letterSpacing: '0.08em' }}
              />
            </motion.div>
            <AnimatePresence>
              {typed.length > 0 && typed !== CONFIRM_WORD && (
                <motion.span
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="field-error sm" style={{ color: 'var(--error)' }}>
                  Escribe exactamente {CONFIRM_WORD}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )}

        <Disclaimer kind="general" />

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn"
            style={{
              width: '100%', height: 52, borderRadius: 16, fontSize: 16, fontWeight: 600,
              background: confirmed ? 'var(--error)' : 'color-mix(in srgb, var(--error) 40%, var(--ink-100))',
              color: '#fff', cursor: confirmed ? 'pointer' : 'not-allowed',
              opacity: confirmed ? 1 : 0.6, transition: 'opacity .15s, background .15s',
            }}
            disabled={!confirmed}
            aria-disabled={!confirmed}
            onClick={handleDelete}
          >
            {isAccount ? 'Borrar definitivamente' : isLogout ? 'Cerrar sesión' : 'Quitar producto'}
          </button>
          <button className="btn btn-ghost"
            style={{ width: '100%', height: 48, borderRadius: 16, fontSize: 16 }}
            onClick={handleCancel}>
            Cancelar
          </button>
        </div>

      </div>
    </Sheet>
  )
}
