/**
 * ScreenIntro.tsx — v2 primitiva
 *
 * Overlay de tutorial de primera vez por pantalla.
 * Marca visto en localStorage con `storageKey` para no repetir.
 * Diseño v2: Sheet + Glass, cockpit oscuro, tokens teal.
 *
 * Uso:
 *   <ScreenIntro
 *     storageKey="intro:inicio"
 *     title="Bienvenido a Inicio"
 *     tips={['Tip 1', 'Tip 2', 'Tip 3']}
 *   />
 *
 * Props:
 *   storageKey  — clave única para localStorage (ej. 'intro:inicio')
 *   title       — título del overlay (sentence case)
 *   tips        — array de cadenas con los puntos a explicar (1-5 recomendado)
 */
import { useState, useEffect } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { Sheet } from './Sheet'
import { Glass } from './Glass'
import { Button } from './Button'

const LS_PREFIX = 'ht:screen-intro:'

export function ScreenIntro({
  storageKey,
  title,
  tips,
}: {
  storageKey: string
  title: string
  tips: string[]
}) {
  const lsKey = `${LS_PREFIX}${storageKey}`

  // Inicializa abierto solo si no se ha visto antes
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(lsKey) !== '1'
    } catch {
      return false
    }
  })

  // Cuando se cierra, marca como visto
  useEffect(() => {
    if (!open) return
    // Nada en mount; el marcado ocurre al cerrar.
  }, [open])

  function dismiss() {
    try {
      localStorage.setItem(lsKey, '1')
    } catch {
      // localStorage no disponible (SSR / private mode estricto) — silencioso
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <Sheet open={open} onClose={dismiss} title={title}>
      <div className="flex flex-col gap-4">
        {/* Header de tips */}
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: 'color-mix(in srgb, #5FC9B8 14%, transparent)' }}
          >
            <Lightbulb size={16} className="text-teal" aria-hidden="true" />
          </span>
          <p className="text-[14px] font-semibold text-secondary-foreground">
            Consejos para esta pantalla
          </p>
        </div>

        {/* Lista de tips */}
        <ol className="flex flex-col gap-2" aria-label={`Consejos: ${title}`}>
          {tips.map((tip, i) => (
            <li key={i}>
              <Glass className="flex items-start gap-3 py-3 px-4">
                {/* Número */}
                <span
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-void"
                  style={{ background: '#5FC9B8' }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="text-[13px] leading-snug text-secondary-foreground">
                  {tip}
                </span>
              </Glass>
            </li>
          ))}
        </ol>

        {/* CTA entendido */}
        <div className="flex flex-col gap-2 pt-1">
          <Button size="full" onClick={dismiss}>
            Entendido
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-11 items-center justify-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring rounded"
            aria-label="No mostrar de nuevo"
          >
            <X size={14} aria-hidden="true" />
            No volver a mostrar
          </button>
        </div>
      </div>
    </Sheet>
  )
}
