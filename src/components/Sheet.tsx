import { useRef } from 'react'
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { IcClose } from './icons'
import { spring } from '../lib/motion'

// Bottom-sheet reutilizable sobre overlay oscuro. Cierra con la X, el handle, drag hacia abajo o tap en overlay.
export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const dragY = useMotionValue(0)

  // El overlay se desvanece a medida que el sheet se arrastra hacia abajo
  const overlayOpacity = useTransform(dragY, [0, 300], [0.5, 0])

  function handleDragEnd(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose()
    } else {
      // Volver al reposo: framer-motion lo hace automáticamente con dragConstraints
      dragY.set(0)
    }
  }

  return (
    <div
      className="overlay"
      onClick={onClose}
      style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'stretch' }}
    >
      {/* Overlay con opacidad reactiva al drag */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,1)',
          opacity: reduce ? 0.5 : overlayOpacity,
          pointerEvents: 'none',
        }}
        aria-hidden
      />

      <motion.div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.sheet}
        // Drag
        drag={reduce ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        style={{ y: dragY, touchAction: 'none', position: 'relative', zIndex: 1 }}
        onDragEnd={handleDragEnd}
      >
        {/* El handle sirve de asa visual; el drag está en todo el sheet */}
        <div className="sheet-handle" style={{ cursor: reduce ? 'default' : 'grab' }} />
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
