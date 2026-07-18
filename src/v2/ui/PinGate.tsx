import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useApp } from '../../lib/store'
import { hashPin } from '../../lib/pin'
import { PinPad } from './PinPad'

// Pantalla de bloqueo por PIN. Se monta sobre la app (s-app) cuando settings.pinEnabled && pinHash y aún no
// se ha desbloqueado en esta sesión (se relockea en cada apertura/recarga). z-95: el splash (LaunchSequence,
// z-100) lo cubre y, al desmontarse, aparece el PIN → secuencia splash → PIN → app.
//
// Anti-lockout: sin backend NO hay recuperación de PIN. El escape honesto es "borrar y empezar de nuevo"
// (limpia el estado local), con confirmación explícita. (Un 4-dígitos recién puesto rara vez se olvida.)
//
// Piel "Bitácora": portada editorial de papel — kicker mono, titular serif (Fraunces), candado en
// medallón hairline azul (confianza), teclas cálidas del PinPad. Lógica intacta.
export function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const { state } = useApp()
  const [value, setValue] = useState('')
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)
  const [forgot, setForgot] = useState(false)

  async function onChange(next: string) {
    setValue(next)
    if (next.length === 4) {
      setChecking(true)
      const h = await hashPin(next)
      if (h === state.settings.pinHash) {
        onUnlock()
      } else {
        setShake(true)
        setValue('')
        window.setTimeout(() => setShake(false), 450)
      }
      setChecking(false)
    }
  }

  function wipeAndRestart() {
    try {
      localStorage.removeItem('hacktrack:v2')
      localStorage.removeItem('hacktrack:v1')
    } catch { /* modo privado */ }
    window.location.reload()
  }

  return (
    <div className="absolute inset-0 z-[95] flex flex-col items-center justify-center gap-10 bg-paper px-8 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(48px,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-hairline bg-surface text-blue shadow-[0_1px_2px_rgba(26,23,18,.05)]">
          <Lock size={24} strokeWidth={1.6} />
        </span>
        <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-3">
          Tu bitácora
        </p>
        <h1 className="font-serif text-[26px] font-medium leading-tight tracking-tight text-ink">
          Hacktrack está bloqueado
        </h1>
        <p className="text-[15px] text-ink-2">Ingresa tu PIN para continuar</p>
      </div>

      <PinPad value={value} onChange={onChange} shake={shake} disabled={checking} />

      {!forgot ? (
        <button
          type="button"
          onClick={() => setForgot(true)}
          className="min-h-[44px] text-[14px] font-medium text-blue underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          Olvidé mi PIN
        </button>
      ) : (
        <div className="flex max-w-[300px] flex-col items-center gap-3 text-center">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Aún no hay recuperación en la nube. Para entrar sin el PIN hay que <span className="font-semibold text-ink">borrar los datos de este dispositivo</span> y empezar de nuevo.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForgot(false)}
              className="h-11 rounded-[8px] border border-hairline bg-transparent px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={wipeAndRestart}
              className="h-11 rounded-[8px] bg-alert px-4 text-[14px] font-semibold text-white transition-transform active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              Borrar y empezar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
