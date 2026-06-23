import { useState, useEffect } from 'react'
import { useApp } from '../../lib/store'
import { hashPin } from '../../lib/pin'
import { Sheet } from '../ui/Sheet'
import { PinPad } from '../ui/PinPad'

// Crear/cambiar el PIN de bloqueo. Paso 1: elegir 4 dígitos. Paso 2: confirmarlos. Si coinciden → guarda
// SHA-256 en settings.pinHash + pinEnabled:true. Abierto desde Ajustes → Seguridad (sheet 'pin-setup').
export function PinSetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useApp()
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const [first, setFirst] = useState('')
  const [value, setValue] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (open) { setStep('enter'); setFirst(''); setValue(''); setShake(false) }
  }, [open])

  async function onChange(next: string) {
    setValue(next)
    if (next.length < 4) return
    if (step === 'enter') {
      setFirst(next)
      setStep('confirm')
      setValue('')
    } else {
      if (next === first) {
        const h = await hashPin(next)
        dispatch({ t: 'setSetting', key: 'pinHash', value: h })
        dispatch({ t: 'setSetting', key: 'pinEnabled', value: true })
        dispatch({ t: 'toast', msg: 'PIN activado' })
        onClose()
      } else {
        // no coincide → volver al paso 1
        setShake(true)
        setStep('enter')
        setFirst('')
        setValue('')
        window.setTimeout(() => setShake(false), 450)
      }
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="PIN de bloqueo">
      <div className="flex flex-col items-center gap-7 pb-2 pt-1">
        <p className="text-center text-[13px] text-muted-foreground">
          {step === 'enter' ? 'Elige un PIN de 4 dígitos' : 'Confírmalo'}
        </p>
        <PinPad value={value} onChange={onChange} shake={shake} />
        <p className="max-w-[280px] text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Bloquea la app al abrirla. Es privacidad casual, no cifrado: tus datos siguen en este dispositivo. Si lo olvidas, tendrás que borrar los datos para entrar.
        </p>
      </div>
    </Sheet>
  )
}
