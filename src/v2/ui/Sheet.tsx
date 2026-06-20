import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

// Bottom-sheet de vidrio. Se monta a nivel del shell (absolute inset-0 dentro de .app-frame).
// Overlay desenfoca el cockpit detrás; el sheet sube con spring. Respeta reduced-motion.
// A11y: role=dialog + aria-modal, cierra con Escape, foco inicial al abrir.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement | null>(null)
  // Offset de ocultamiento en PX FIJOS (no '100%' de la propia altura). Con porcentaje, si el contenido
  // del sheet cambia de alto a media animación —p.ej. la imagen del mapa corporal (injection-body.webp)
  // decodifica tarde en el primer abrir— el valor de '100%' se reasienta y el panel "se pasa" de su
  // reposo (= sube raro, deja hueco abajo y baja). Un px ≥ alto de pantalla es referencia estable →
  // sin reasentamiento ni sobrepaso, independiente del dispositivo. Se lee una vez al montar.
  const [hideY] = useState(() => (typeof window !== 'undefined' ? Math.ceil(Math.max(window.innerHeight, 920) * 1.12) : 1100))

  // Diferir el slide ~2 frames: el panel monta y PINTA fuera de pantalla (en hideY) y solo entonces
  // sube. Así el trabajo pesado del primer render (reconciliación + layout + 1er paint + decode de la
  // imagen del mapa) ocurre mientras está oculto, y el deslizamiento corre sobre contenido ya pintado
  // → no compite por frames → no "brinca" ni se ve mecánico en teléfonos lentos.
  const [slideIn, setSlideIn] = useState(false)
  useEffect(() => {
    if (!open) { setSlideIn(false); return }
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setSlideIn(true)) })
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2) }
  }, [open])

  // Escape para cerrar + foco inicial + focus-trap (Tab cicla dentro del panel).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !panelRef.current) return
      const f = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      if (f.length === 0) { e.preventDefault(); return }
      const first = f[0]
      const last = f[f.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => panelRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        // Contenedor full-screen como hijo motion DIRECTO de AnimatePresence → desmontaje fiable
        // (un <div> plano no lo rastrea bien y quedaba huérfano interceptando clics). pointer-events-none
        // es el cinturón de seguridad: aunque quedara montado a media salida, NO traga clics de la página;
        // solo el backdrop y el panel re-habilitan pointer-events-auto.
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 flex items-end"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            className="pointer-events-auto absolute inset-0 bg-black/55"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* will-change-transform → el panel vive en su propia capa de compositor: el slide no se frena
              por el primer pintado del contenido. ENTRADA = tween easeOut (tolera frames perdidos durante
              el montaje y aterriza a tiempo, sin el "salto" de un spring que se pone al día). SALIDA =
              spring (ya se sentía suave; el contenido ya está pintado). */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="glass pointer-events-auto relative max-h-[92%] w-full overflow-y-auto rounded-t-[24px] p-5 pb-[max(24px,env(safe-area-inset-bottom))] outline-none will-change-transform"
            // initial=false: monta directo en el valor de `animate` (slideIn=false → y:hideY, fuera de
            // pantalla) SIN animar. Tras 2 rAF, slideIn→true y sube. AnimatePresence sigue manejando la salida.
            initial={false}
            animate={reduce ? { opacity: slideIn ? 1 : 0 } : { y: slideIn ? 0 : hideY }}
            exit={reduce ? { opacity: 0 } : { y: hideY, transition: { type: 'spring', stiffness: 280, damping: 32, mass: 1 } }}
            // Entrada: spring orgánico SIN rebote (bounce:0 → no se pasa de su reposo). Salida conserva su spring.
            transition={reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.42 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-foreground">{title}</h2>
              <button
                aria-label="Cerrar"
                onClick={onClose}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/8 text-secondary-foreground"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
