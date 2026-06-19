import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

// Bottom-sheet de vidrio. Se monta a nivel del shell (absolute inset-0 dentro de .app-frame).
// Overlay desenfoca el cockpit detrás; el sheet sube con spring. Respeta reduced-motion.
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
  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-50 flex items-end">
          <motion.div
            className="absolute inset-0 bg-black/55"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={title}
            className="glass relative max-h-[92%] w-full overflow-y-auto rounded-t-[24px] p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 280, damping: 32, mass: 1 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-foreground">{title}</h2>
              <button
                aria-label="Cerrar"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-secondary-foreground"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
