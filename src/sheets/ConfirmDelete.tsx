// Confirmación destructiva reutilizable — bottom-sheet.
// Casos: borrar registro (sheetArg = id de log) o borrar cuenta (sheetArg === '__account').
// Compliance: sin jeringas, sin promesas de resultado, disclaimers presentes.
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { useApp } from '../lib/store'

const CONFIRM_WORD = 'BORRAR'

export function ConfirmDeleteSheet() {
  const { state, dispatch } = useApp()
  const isAccount = state.sheetArg === '__account'
  const isLogout = state.sheetArg === '__logout'

  const [typed, setTyped] = useState('')
  const confirmed = isAccount ? typed === CONFIRM_WORD : true

  function handleCancel() {
    dispatch({ t: 'sheet', sheet: isAccount ? 'perfil' : null })
  }

  function handleDelete() {
    if (!confirmed) return
    if (isAccount) dispatch({ t: 'arcoDelete' })
    else if (isLogout) dispatch({ t: 'reset' })
    else if (state.sheetArg) dispatch({ t: 'deleteLog', id: state.sheetArg })
  }

  const title = isAccount ? 'Borrar mi cuenta' : isLogout ? 'Cerrar sesión' : 'Borrar registro'

  return (
    <Sheet title={title} onClose={handleCancel}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Advertencia */}
        <div style={{
          background: 'color-mix(in srgb, var(--error) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
          borderRadius: 12,
          padding: '14px 16px',
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
              Este registro se eliminará de tu diario de forma permanente.{' '}
              <strong>No se puede deshacer.</strong>
            </p>
          )}
        </div>

        {/* Campo de confirmación — solo para borrado de cuenta */}
        {isAccount && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label" htmlFor="confirm-borrar" style={{ color: 'var(--ink-700)' }}>
              Escribe <span className="mono" style={{ fontWeight: 700 }}>{CONFIRM_WORD}</span> para confirmar
            </label>
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
            {typed.length > 0 && typed !== CONFIRM_WORD && (
              <span className="field-error sm" style={{ color: 'var(--error)' }}>
                Escribe exactamente {CONFIRM_WORD}
              </span>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <Disclaimer kind="general" />

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn"
            style={{
              width: '100%',
              height: 52,
              borderRadius: 16,
              fontSize: 16,
              fontWeight: 600,
              background: confirmed ? 'var(--error)' : 'color-mix(in srgb, var(--error) 40%, var(--ink-100))',
              color: '#fff',
              cursor: confirmed ? 'pointer' : 'not-allowed',
              opacity: confirmed ? 1 : 0.6,
              transition: 'opacity .15s, background .15s',
            }}
            disabled={!confirmed}
            aria-disabled={!confirmed}
            onClick={handleDelete}
          >
            {isAccount ? 'Borrar definitivamente' : isLogout ? 'Cerrar sesión' : 'Borrar'}
          </button>

          <button
            className="btn btn-ghost"
            style={{ width: '100%', height: 48, borderRadius: 16, fontSize: 16 }}
            onClick={handleCancel}
          >
            Cancelar
          </button>
        </div>

      </div>
    </Sheet>
  )
}
