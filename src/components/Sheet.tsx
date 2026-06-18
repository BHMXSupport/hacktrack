// Sheet — bottom-sheet reutilizable sobre overlay oscuro.
// n=305/432: drag-to-dismiss con resistencia elástica — AHORA solo desde el handle (useDragControls +
//   dragListener=false). Antes el drag iba en TODO el sheet con touch-action:none → bloqueaba el scroll
//   nativo del contenido (no se podía desplazar la grid de KPIs del "+"). Con el drag confinado al handle,
//   el cuerpo es un scroller nativo (touch-action:pan-y) y a la vez se mantiene el swipe-to-dismiss.
// n=306: safe-area-inset-bottom para notch/Dynamic Island en PWA.
// n=307: prop size='compact'|'default'|'full' con alturas condicionales.
// n=493: role=dialog + aria-modal + aria-labelledby + retorno de foco.
// n=494: focus trap + inert en fondo (via useFocusTrap).
import { useRef, useId } from 'react'
import { motion, useMotionValue, useTransform, useReducedMotion, useDragControls } from 'framer-motion'
import { IcClose } from './icons'
import { spring } from '../lib/motion'
import { useFocusTrap } from '../lib/useFocusTrap'

export type SheetSize = 'compact' | 'default' | 'full'

const SIZE_MAX_HEIGHT: Record<SheetSize, string> = {
  compact: 'min(72vh, 480px)',
  default: 'min(88vh, 720px)',
  full: '95dvh',
}

// Bottom-sheet reutilizable. Cierra con la X, el handle (arrastrar), drag hacia abajo o tap en overlay.
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
  const dragControls = useDragControls()
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
        // n=305/432: drag-to-dismiss SOLO desde el handle (dragListener=false → no escucha en todo el sheet,
        // así el cuerpo conserva touch-action:pan-y y hace scroll nativo). El handle llama dragControls.start.
        drag={reduce ? false : 'y'}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.22 }}
        onDragEnd={handleDragEnd}
        style={{
          y: dragY,
          position: 'relative',
          zIndex: 1,
          // n=307: tamaño según prop; flex column → handle/head fijos, cuerpo scrollable
          maxHeight: SIZE_MAX_HEIGHT[size],
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // permite scroll vertical en el subárbol (el cuerpo); el drag arranca en el handle (touch-action:none)
          touchAction: 'pan-y',
        }}
      >
        {/* Zona de agarre = handle + barra de título: inicia el drag-to-dismiss (touch-action:none).
            Grande y fácil de tomar; la X detiene la propagación para que tocarla NO arranque un drag.
            El cuerpo (abajo) queda con touch-action:pan-y → hace scroll nativo. */}
        <div
          onPointerDown={(e) => { if (!reduce) dragControls.start(e) }}
          style={{ flex: 'none', touchAction: 'none', cursor: reduce ? 'default' : 'grab' }}
        >
          <div className="sheet-handle" />
          {title !== undefined && (
            <div className="sheet-head">
              <div id={titleId} className="h2">{title}</div>
              <button
                className="iconbtn"
                aria-label="Cerrar"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onClose}
              >
                <IcClose size={18} />
              </button>
            </div>
          )}
        </div>
        {/* Cuerpo: scroller nativo. minHeight:0 para que el flex-child pueda encogerse y desplazar. */}
        <div style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
        }}>
          {children}
        </div>
      </motion.div>
    </div>
  )
}
