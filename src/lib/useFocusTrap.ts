// useFocusTrap — n=494: contención de foco en modales/sheets abiertas.
// WCAG 2.1.2: cicla Tab/Shift+Tab dentro del ref; Escape llama onClose.
import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose?: () => void,
) {
  // onClose suele ser una arrow inline (identidad nueva cada render). Si va en las deps, el efecto se
  // RE-EJECUTA en cada tecla → su timer de 50ms roba el foco al input y baja el teclado. Lo guardamos en
  // un ref para usar siempre el último onClose SIN re-correr el efecto.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    // Guardar foco anterior para restaurarlo al cerrar
    const prev = document.activeElement as HTMLElement | null

    const getFocusable = (): HTMLElement[] =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => !n.closest('[inert]'),
      )

    // Mover foco al primer elemento enfocable (diferido para no bloquear animación de entrada)
    const initTimer = setTimeout(() => {
      const nodes = getFocusable()
      if (nodes[0]) nodes[0].focus()
    }, 50)

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = getFocusable()
      if (nodes.length === 0) { e.preventDefault(); return }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      clearTimeout(initTimer)
      document.removeEventListener('keydown', handler)
      prev?.focus()
    }
    // Solo [active]: NO onClose (va por ref) → el efecto no se re-ejecuta al escribir. ref es estable.
  }, [active])
}
