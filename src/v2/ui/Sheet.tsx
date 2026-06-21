import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

// Bottom-sheet de vidrio. RENDERIZADO EN PORTAL a document.body con position:FIXED.
// Por qué portal+fixed (no `absolute inset-0` dentro de .app-frame): en iOS standalone, .app-frame usa
// overflow:hidden + 100vh, y un overlay absolute adentro NO cubre bien el viewport real (deja franja negra
// abajo / zona del home-indicator) y deja capas táctiles en estados raros (dead-click). Un portal fixed a
// body cubre el viewport visual de verdad y evita el clipping del frame.
//
// Anti-jank: el panel se mueve con backdrop-filter NUNCA durante el slide → durante el movimiento usa
// .sheet-solid (sin blur) y el backdrop no desenfoca; al asentarse (settled) vuelve a .glass.
// Anti dead-click: el contenedor es pointer-events-none; backdrop y panel solo reciben clics cuando
// `settled` (abierto y quieto); y el prop `exit` fija pointerEvents:'none' → aunque AnimatePresence dejara
// un nodo huérfano, queda con pointer-events:none y NO traga clics de la página.
// A11y: role=dialog + aria-modal, cierra con Escape, foco inicial al abrir, focus-trap (Tab cicla dentro).
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
  // Offset de ocultamiento en PX FIJOS (no '100%' de la propia altura, que se reasienta si el contenido
  // cambia de alto a media animación → "sube raro"). ≥ alto de pantalla → siempre fuera de vista, estable.
  const [hideY] = useState(() => (typeof window !== 'undefined' ? Math.ceil(Math.max(window.innerHeight, 920)) + 24 : 1000))

  // settled = abierto y quieto. moving = entrando/saliendo/sin asentar. En `moving`: panel .sheet-solid sin
  // blur + pointer-events-none. En la SALIDA, settled nunca vuelve a true (onAnimationComplete solo asienta
  // si sigue abierto) y el exit fija pointerEvents:none → un huérfano no bloquea.
  const [settled, setSettled] = useState(false)
  const moving = !settled
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => { if (!open) setSettled(false) }, [open])

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

  if (typeof document === 'undefined') return null

  const node = (
    <AnimatePresence>
      {open && (
        // Contenedor full-screen FIXED a viewport (portal). motion.div hijo directo de AnimatePresence →
        // desmontaje fiable. pointer-events-none → si quedara huérfano, no traga clics.
        <motion.div
          className="pointer-events-none fixed inset-0 z-[9999] flex items-end justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            // Backdrop: clics solo cuando settled (para cerrar tocando afuera). Sin blur en movimiento; menos
            // oscuro (0.34) para no verse como "tile negro" durante el slide. exit pointerEvents:none = anti-huérfano.
            className={`${settled ? 'pointer-events-auto' : 'pointer-events-none'} absolute inset-0`}
            style={{
              backgroundColor: moving ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0.55)',
              ...(moving ? {} : { backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }),
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            // pointer-events-auto SIEMPRE (también en entrada) → taps rápidos al botón cerrar funcionan;
            // el exit fija pointerEvents:'none' (anti-huérfano) y el panel no es full-screen, así que aunque
            // quedara vivo no bloquea toda la pantalla (el backdrop sí es full-screen y ese sí va a none).
            className={`${moving ? 'sheet-solid' : 'glass'} pointer-events-auto relative z-10 max-h-[92vh] max-h-[92dvh] w-full max-w-[412px] overflow-x-hidden overflow-y-auto rounded-t-[24px] p-5 pb-[max(24px,env(safe-area-inset-bottom))] outline-none will-change-transform`}
            initial={reduce ? { opacity: 0 } : { y: hideY }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0, pointerEvents: 'none' } : { y: hideY, pointerEvents: 'none', transition: { type: 'spring', stiffness: 280, damping: 32, mass: 1 } }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.45 }}
            onAnimationStart={() => setSettled(false)}
            onAnimationComplete={() => { if (openRef.current) setSettled(true) }}
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

  return createPortal(node, document.body)
}
