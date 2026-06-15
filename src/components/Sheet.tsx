import { motion } from 'framer-motion'
import { IcClose } from './icons'

// Bottom-sheet reutilizable sobre overlay oscuro. Cierra con la X, el handle o tap en overlay.
export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <motion.div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="sheet-handle" />
        {title !== undefined && (
          <div className="sheet-head">
            <div className="h2">{title}</div>
            <button className="iconbtn" aria-label="Cerrar" onClick={onClose}>
              <IcClose size={18} />
            </button>
          </div>
        )}
        {children}
      </motion.div>
    </div>
  )
}
