// Pila global de modales (Sheets y diálogos de confirmación portaleados).
// Antes cada Sheet registraba su propio keydown de documento que cerraba en Escape
// SIN condición → con hojas apiladas (AliasSheet sobre Ajustes) un solo Escape
// cerraba TODAS, y los diálogos z-[10000] ni escuchaban Escape (Escape cerraba la
// hoja de abajo). Aquí vive UN solo listener de Escape a nivel documento: cierra
// únicamente el modal en el tope de la pila (el último en abrirse).
// El pop es por estado (open→false vía cleanup del efecto), no por el propio evento:
// un doble-Escape rapidísimo no atraviesa dos capas antes de que React re-renderice.
import { useEffect, useRef } from 'react'

type CloseFn = () => void

const stack: CloseFn[] = []

function onDocKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = stack[stack.length - 1]
  if (top) top()
}

export function pushModal(close: CloseFn): void {
  if (typeof document === 'undefined') return
  // El listener existe solo mientras haya modales abiertos.
  if (stack.length === 0) document.addEventListener('keydown', onDocKeyDown)
  stack.push(close)
}

export function popModal(close: CloseFn): void {
  if (typeof document === 'undefined') return
  const i = stack.lastIndexOf(close)
  if (i !== -1) stack.splice(i, 1)
  if (stack.length === 0) document.removeEventListener('keydown', onDocKeyDown)
}

// Hook: mantiene el modal en la pila mientras `open` sea true. Se cierre como se
// cierre (Escape, backdrop, botón), open→false hace pop en el cleanup. `onClose`
// se lee vía ref → siempre la versión fresca sin re-registrar por identidad
// inestable (los onClose inline cambian en cada render).
export function useModalStack(open: boolean, onClose: CloseFn): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const entry = () => closeRef.current()
    pushModal(entry)
    return () => popModal(entry)
  }, [open])
}
