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
    <div className="absolute inset-0 z-[95] flex flex-col items-center justify-center gap-10 bg-void px-8 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(48px,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-teal/15 text-teal">
          <Lock size={24} />
        </span>
        <h1 className="text-[20px] font-bold text-foreground">Hacktrack está bloqueado</h1>
        <p className="text-[13px] text-muted-foreground">Ingresa tu PIN para continuar</p>
      </div>

      <PinPad value={value} onChange={onChange} shake={shake} disabled={checking} />

      {!forgot ? (
        <button
          type="button"
          onClick={() => setForgot(true)}
          className="text-[13px] font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Olvidé mi PIN
        </button>
      ) : (
        <div className="flex max-w-[300px] flex-col items-center gap-3 text-center">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Aún no hay recuperación en la nube. Para entrar sin el PIN hay que <span className="font-semibold text-foreground">borrar los datos de este dispositivo</span> y empezar de nuevo.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForgot(false)}
              className="rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={wipeAndRestart}
              className="rounded-lg bg-alert/90 px-4 py-2 text-[13px] font-semibold text-white"
            >
              Borrar y empezar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
