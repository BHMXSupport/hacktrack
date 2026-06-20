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
  // = alto de pantalla + un pequeño margen. Suficiente para esconder el panel por debajo (su reposo deja
  // un gap arriba) PERO sin inflar: así casi todo el recorrido es VISIBLE (no se queda fuera de pantalla).
  const [hideY] = useState(() => (typeof window !== 'undefined' ? Math.ceil(Math.max(window.innerHeight, 920)) + 24 : 1000))

  // `moving` = true mientras el panel se desliza (entrada/salida). CAUSA RAÍZ del "sube raro"
  // (confirmada por red-team): animar el transform de un elemento con backdrop-filter: blur(20px)
  // ENCIMA del video ambiental obliga a iOS a re-rasterizar el blur en cada frame → stutter que ningún
  // cambio de curva arregla. Solución: durante el movimiento, el panel usa una variante SÓLIDA sin blur
  // (.sheet-solid) y el overlay tampoco desenfoca; al asentarse vuelve a .glass. GPU barata en el slide.
  const [moving, setMoving] = useState(false)

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
            // Sin blur mientras el panel se mueve (mismo motivo que el panel); el blur entra al asentarse.
            style={moving ? undefined : { backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Panel: SÓLIDO (.sheet-solid, sin backdrop-filter) mientras se mueve; .glass al asentarse.
              will-change-transform lo promueve a su propia capa. Entrada spring bounce:0 (sin sobrepaso);
              salida conserva el spring físico. onAnimationStart/Complete alternan `moving`. */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={`${moving ? 'sheet-solid' : 'glass'} pointer-events-auto relative max-h-[92%] w-full overflow-y-auto rounded-t-[24px] p-5 pb-[max(24px,env(safe-area-inset-bottom))] outline-none will-change-transform`}
            initial={reduce ? { opacity: 0 } : { y: hideY }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: hideY, transition: { type: 'spring', stiffness: 280, damping: 32, mass: 1 } }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.45 }}
            onAnimationStart={() => setMoving(true)}
            onAnimationComplete={() => setMoving(false)}
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
