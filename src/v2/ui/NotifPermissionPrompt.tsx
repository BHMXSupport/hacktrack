import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Sheet } from './Sheet'
import { Button } from './Button'
import { notifSupported, notifPermission, requestNotif } from '../../lib/notifications'

// Prompt de permiso de notificaciones — aparece al ENTRAR a la app si el permiso NO está concedido.
// Repite en cada apertura mientras esté en "no"; desaparece en cuanto se concede ("sí"). El botón dispara
// el prompt nativo del SO: requestPermission() requiere un gesto del usuario en iOS PWA, por eso es un
// botón (una auto-llamada al cargar no mostraría nada en iOS). Al conceder, enciende todos los recordatorios.
export function NotifPermissionPrompt() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const askedThisMount = useRef(false)

  useEffect(() => {
    if (askedThisMount.current) return
    if (state.justOnboarded) return        // no encimar sobre el overlay de bienvenida
    if (!notifSupported()) return           // navegador sin Notification API
    if (notifPermission() === 'granted') return // ya está en "sí" → nunca pedir
    askedThisMount.current = true
    const t = window.setTimeout(() => setOpen(true), 900) // deja respirar al primer render
    return () => window.clearTimeout(t)
  }, [state.justOnboarded])

  async function activar() {
    if (busy) return
    setBusy(true)
    const r = await requestNotif()
    setBusy(false)
    setOpen(false)
    if (r === 'granted') {
      // Al conceder, deja TODOS los recordatorios activos.
      dispatch({ t: 'setSetting', key: 'remindersEnabled', value: true })
      dispatch({ t: 'setSetting', key: 'dailySummary', value: true })
      dispatch({ t: 'setSetting', key: 'weeklySummary', value: true })
      dispatch({ t: 'toast', msg: 'Recordatorios activados' })
    } else if (r === 'denied') {
      dispatch({ t: 'toast', msg: 'Actívalos en los ajustes de notificaciones de tu teléfono.' })
    }
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Activa tus recordatorios">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal/15 text-teal">
            <Bell size={20} />
          </div>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Te avisamos a la hora de cada toma, con un resumen de tu día y de tu semana, para que no se te pase ninguna y conserves tu racha. Puedes ajustarlos o apagarlos cuando quieras en Ajustes.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button size="full" onClick={activar} disabled={busy}>
            {busy ? 'Activando…' : 'Activar recordatorios'}
          </Button>
          <button
            onClick={() => setOpen(false)}
            className="py-2 text-[13px] font-medium text-muted-foreground active:opacity-70"
          >
            Ahora no
          </button>
        </div>
      </div>
    </Sheet>
  )
}
