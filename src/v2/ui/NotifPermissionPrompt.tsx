import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Sheet } from './Sheet'
import { Button } from './Button'
import { notifSupported, notifPermission } from '../../lib/notifications'
import { rachaLabel } from '../../lib/buildFlags'

// Prompt de permiso de notificaciones — aparece al ENTRAR a la app si el permiso NO está concedido.
// Vestido "Bitácora" (papel cálido, azul = confianza/interactivo); la LÓGICA de descarte queda intacta.
// Acelerador conservador: máximo UNA vez por sesión (sessionStorage) y con descarte PERSISTENTE
// ("No volver a preguntar", localStorage) — antes re-aparecía como modal bloqueante en CADA apertura
// hasta conceder, para siempre. Desaparece en cuanto se concede ("sí").
//
// iOS PWA — dos sutilezas que rompían el aviso del sistema:
//  1) requestPermission() DEBE llamarse SÍNCRONAMENTE dentro del gesto (sin await previo) o WebKit lo
//     ignora en silencio. Por eso aquí es el PRIMER statement del onClick (no pasa por un helper async).
//  2) Si el usuario ya NEGÓ el permiso, iOS NO vuelve a mostrar el aviso del sistema nunca más → solo se
//     activa desde Ajustes del teléfono. En ese estado mostramos instrucciones en vez de un botón inútil.

// localStorage y no UserSettings: sobrevive a "borrar datos de la app" solo si borran el sitio entero,
// y no arrastra una migración de esquema. Para reactivarlo desde Ajustes: remover esta clave.
export const NOTIF_PROMPT_DISMISSED_KEY = 'hacktrack:notifPromptDismissed'
const SESSION_SHOWN_KEY = 'hacktrack:notifPromptShownSession'

function safeGet(store: 'local' | 'session', key: string): string | null {
  try { return (store === 'local' ? localStorage : sessionStorage).getItem(key) } catch { return null }
}
function safeSet(store: 'local' | 'session', key: string, value: string): void {
  try { (store === 'local' ? localStorage : sessionStorage).setItem(key, value) } catch { /* modo privado */ }
}

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
    if (safeGet('local', NOTIF_PROMPT_DISMISSED_KEY) === '1') return // "No volver a preguntar"
    if (safeGet('session', SESSION_SHOWN_KEY) === '1') return        // ya se mostró en esta sesión
    askedThisMount.current = true
    setDenied(notifPermission() === 'denied')   // si ya está bloqueado, mostramos instrucciones de Ajustes
    const t = window.setTimeout(() => {
      safeSet('session', SESSION_SHOWN_KEY, '1')
      setOpen(true)
    }, 900) // deja respirar al primer render
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
          {/* Campana en azul (confianza/interactivo); tinte con color-mix porque el alfa sobre
              var(--x) (bg-blue/10) no se emite en este setup. */}
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue">
            <Bell size={20} />
          </div>
          <p className="text-[15px] leading-relaxed text-ink-2">
            {denied
              ? 'Las notificaciones están bloqueadas para Hacktrack. Tu teléfono ya no muestra el aviso automático, así que actívalas a mano en los ajustes.'
              // rachaLabel: en tienda dice "racha de registro" (Apple 1.4.3); PWA sin cambio
              : `Te avisamos a la hora de cada toma, con un resumen de tu día y de tu semana, para que no se te pase ninguna y conserves tu ${rachaLabel()}. Puedes ajustarlos o apagarlos cuando quieras en Ajustes.`}
          </p>
        </div>

        {denied ? (
          <div className="rounded-sm border border-hairline bg-raised p-4 text-[14px] leading-relaxed text-ink-2">
            <p className="mb-2 font-semibold text-ink">Cómo activarlas en iPhone</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Abre <span className="font-medium text-ink">Ajustes</span> del teléfono.</li>
              <li>Baja y toca <span className="font-medium text-ink">Hacktrack</span>.</li>
              <li>Entra en <span className="font-medium text-ink">Notificaciones</span> y activa <span className="font-medium text-ink">Permitir notificaciones</span>.</li>
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
            onClick={() => {
              // Bloqueado: las instrucciones ya se mostraron una vez; repetirlas en cada apertura
              // era el modal bloqueante eterno. Si activa el permiso en el teléfono, este prompt
              // deja de aplicar solo (granted); si no, se reactiva desde Ajustes.
              if (denied) safeSet('local', NOTIF_PROMPT_DISMISSED_KEY, '1')
              setOpen(false)
            }}
            className="min-h-[44px] py-2 text-[14px] font-medium text-ink-2 transition-opacity active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {denied ? 'Entendido' : 'Ahora no'}
          </button>
          {!denied && (
            <button
              onClick={() => {
                safeSet('local', NOTIF_PROMPT_DISMISSED_KEY, '1')
                setOpen(false)
              }}
              className="min-h-[44px] py-1 text-[12px] font-medium text-ink-3 transition-opacity active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              No volver a preguntar
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
