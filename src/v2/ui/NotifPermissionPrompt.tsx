import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Sheet } from './Sheet'
import { Button } from './Button'
import { notifSupported, notifPermission } from '../../lib/notifications'

// Prompt de permiso de notificaciones — aparece al ENTRAR a la app si el permiso NO está concedido.
// Repite en cada apertura mientras esté en "no"; desaparece en cuanto se concede ("sí").
//
// iOS PWA — dos sutilezas que rompían el aviso del sistema:
//  1) requestPermission() DEBE llamarse SÍNCRONAMENTE dentro del gesto (sin await previo) o WebKit lo
//     ignora en silencio. Por eso aquí es el PRIMER statement del onClick (no pasa por un helper async).
//  2) Si el usuario ya NEGÓ el permiso, iOS NO vuelve a mostrar el aviso del sistema nunca más → solo se
//     activa desde Ajustes del teléfono. En ese estado mostramos instrucciones en vez de un botón inútil.
export function NotifPermissionPrompt() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const askedThisMount = useRef(false)

  useEffect(() => {
    if (askedThisMount.current) return
    if (state.justOnboarded) return            // no encimar sobre la bienvenida
    if (!notifSupported()) return               // navegador sin Notification API
    if (notifPermission() === 'granted') return // ya está en "sí" → nunca pedir
    askedThisMount.current = true
    setDenied(notifPermission() === 'denied')   // si ya está bloqueado, mostramos instrucciones de Ajustes
    const t = window.setTimeout(() => setOpen(true), 900) // deja respirar al primer render
    return () => window.clearTimeout(t)
  }, [state.justOnboarded])

  function apply(result: NotificationPermission) {
    setBusy(false)
    if (result === 'granted') {
      // Al conceder, deja TODOS los recordatorios activos.
      dispatch({ t: 'setSetting', key: 'remindersEnabled', value: true })
      dispatch({ t: 'setSetting', key: 'dailySummary', value: true })
      dispatch({ t: 'setSetting', key: 'weeklySummary', value: true })
      dispatch({ t: 'toast', msg: 'Recordatorios activados' })
      setOpen(false)
    } else {
      // 'denied' o 'default' que NO mostró aviso: iOS solo pide UNA vez por instalación; si ya se cerró
      // antes, queda en 'default' pero ya no re-aparece. En ambos casos → instrucciones de Ajustes.
      setDenied(true)
    }
  }

  function activar() {
    if (busy) return
    if (!notifSupported()) {
      dispatch({ t: 'toast', msg: 'Tu navegador no admite notificaciones.' })
      setOpen(false)
      return
    }
    if (notifPermission() === 'denied') { setDenied(true); return }
    let p: Promise<NotificationPermission>
    try {
      // Forma PURA de promesa, SIN argumento callback: el callback (deprecado) hace que iOS WebKit no
      // muestre el aviso del sistema. Síncrono dentro del gesto (sin await previo) — requisito de iOS.
      p = Notification.requestPermission()
    } catch {
      apply('denied')
      return
    }
    setBusy(true)
    Promise.resolve(p).then(apply).catch(() => apply('denied'))
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Activa tus recordatorios">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal/15 text-teal">
            <Bell size={20} />
          </div>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {denied
              ? 'Las notificaciones están bloqueadas para Hacktrack. Tu teléfono ya no muestra el aviso automático, así que actívalas a mano en los ajustes.'
              : 'Te avisamos a la hora de cada toma, con un resumen de tu día y de tu semana, para que no se te pase ninguna y conserves tu racha. Puedes ajustarlos o apagarlos cuando quieras en Ajustes.'}
          </p>
        </div>

        {denied ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-[13px] leading-relaxed text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Cómo activarlas en iPhone</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Abre <span className="text-foreground">Ajustes</span> del teléfono.</li>
              <li>Baja y toca <span className="text-foreground">Hacktrack</span>.</li>
              <li>Entra en <span className="text-foreground">Notificaciones</span> y activa <span className="text-foreground">Permitir notificaciones</span>.</li>
            </ol>
            <p className="mt-2">En Android: Ajustes → Apps → Hacktrack → Notificaciones.</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          {!denied && (
            <Button size="full" onClick={activar} disabled={busy}>
              {busy ? 'Activando…' : 'Activar recordatorios'}
            </Button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="py-2 text-[13px] font-medium text-muted-foreground active:opacity-70"
          >
            {denied ? 'Entendido' : 'Ahora no'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
