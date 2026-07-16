// Hacktrack — botón "atrás" físico de Android (@capacitor/app).
// Reusa el comportamiento de cierre que la app YA tiene: la pila global de modales
// (src/v2/ui/modalStack) cierra el modal del TOPE con un keydown de Escape a nivel
// documento. Con modales abiertos, back = ese mismo Escape sintético; sin modales,
// back = minimizar la app (convención Android — nunca matar el proceso con estado vivo).
// iOS no tiene botón back físico → este módulo solo se activa en Android.
import { nativePlatform } from './platform'
import { modalStackDepth } from '../../v2/ui/modalStack'

export type BackAction = 'close-modal' | 'minimize'

/** Decisión PURA (testeable): con modales abiertos se cierra el tope; si no, minimizar. */
export function decideBackAction(openModalCount: number): BackAction {
  return openModalCount > 0 ? 'close-modal' : 'minimize'
}

/** Registra el listener del botón back. Llamar UNA vez en el arranque (main.tsx). */
export async function initBackButton(): Promise<void> {
  if (nativePlatform() !== 'android') return
  try {
    const { App } = await import('@capacitor/app')
    await App.addListener('backButton', () => {
      if (decideBackAction(modalStackDepth()) === 'close-modal') {
        // Mismo evento que ya escucha modalStack: cierra SOLO el modal del tope.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      } else {
        void App.minimizeApp()
      }
    })
  } catch {
    /* plugin ausente — Android usará el default (cerrar actividad) */
  }
}
