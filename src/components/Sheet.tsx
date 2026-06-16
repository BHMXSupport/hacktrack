// Sheet — bottom-sheet reutilizable sobre overlay oscuro.
// n=305/432: drag-to-dismiss con resistencia elástica (handle + velocidad).
// n=306: safe-area-inset-bottom para notch/Dynamic Island en PWA.
// n=307: prop size='compact'|'default'|'full' con alturas condicionales.
// n=493: role=dialog + aria-modal + aria-labelledby + retorno de foco.
// n=494: focus trap + inert en fondo (via useFocusTrap).
import { useRef, useId } from 'react'
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { IcClose } from './icons'
import { spring } from '../lib/motion'
import { useFocusTrap } from '../lib/useFocusTrap'

export type SheetSize = 'compact' | 'default' | 'full'

const SIZE_MAX_HEIGHT: Record<SheetSize, string> = {
  compact: 'min(72vh, 480px)',
  default: 'min(88vh, 720px)',
  full: '95dvh',
}

// Bottom-sheet reutilizable. Cierra con la X, el handle, drag hacia abajo o tap en overlay.
export function Sheet({
  title,
  onClose,
  children,
  size = 'default',
}: {
  title?: string
  onClose: () => void
  children: React.ReactNode
  size?: SheetSize
}) {
  const reduce = useReducedMotion()
  const dragY = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // n=494: focus trap
  useFocusTrap(sheetRef, true, onClose)

  // n=305/432: overlay se desvanece a medida que el sheet se arrastra hacia abajo
  const overlayOpacity = useTransform(dragY, [0, 300], [0.5, 0])

  function handleDragEnd(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose()
    } else {
      dragY.set(0)
    }
  }

  return (
    <div
      className="overlay"
      onClick={onClose}
      style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'stretch' }}
      // n=494: inert en capas bajo el sheet no aplica aquí porque el overlay ES el sheet;
      // el contenido de app bajo el overlay queda cubierto visualmente.
      // El verdadero inert se aplica en App.tsx al root cuando el sheet está abierto.
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

      {/* n=493: role=dialog + aria-modal */}
      <motion.div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.sheet}
        // n=305/432: drag-to-dismiss
        drag={reduce ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.22 }}
        style={{
          y: dragY,
          touchAction: 'none',
          position: 'relative',
          zIndex: 1,
          // n=307: tamaño según prop
          maxHeight: SIZE_MAX_HEIGHT[size],
          overflowY: size === 'compact' ? 'visible' : 'auto',
          // n=306: safe-area-inset-bottom para PWA en iPhone
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        onDragEnd={handleDragEnd}
      >
        {/* El handle sirve de asa visual; el drag está en todo el sheet */}
        <div className="sheet-handle" style={{ cursor: reduce ? 'default' : 'grab' }} />
        {title !== undefined && (
          <div className="sheet-head">
            <div id={titleId} className="h2">{title}</div>
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
