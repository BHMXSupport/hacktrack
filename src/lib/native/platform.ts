// Helper mínimo de plataforma: un solo punto de verdad para "¿corro dentro de Capacitor?".
// En web/PWA devuelve false y todos los módulos nativos se vuelven no-op — el arranque
// del beta web NO cambia. Los plugins pesados se cargan con import() dinámico en cada
// módulo nativo; aquí solo vive el check barato de @capacitor/core.
import { Capacitor } from '@capacitor/core'

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  try {
    const p = Capacitor.getPlatform()
    return p === 'ios' || p === 'android' ? p : 'web'
  } catch {
    return 'web'
  }
}
