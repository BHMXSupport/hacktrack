// Hacktrack — configuración Capacitor (builds de TIENDA).
// webDir apunta a dist-store-cap: el build de tienda se genera con `npm run build:store`
// (VITE_STORE_BUILD=1) en un outDir SEPARADO de dist/ (web) y dist-store/ (gate del sibling)
// para no pisar builds concurrentes. REGLA DURA: cero referencias a dominios de vendors en el
// binario de tienda — no hay server.allowNavigation ni URLs remotas aquí (compliance 1.4.3).
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Reverse-DNS del producto (dominio propio del proyecto, separado de cualquier vendor).
  appId: 'mx.hacktrack.app',
  appName: 'Hacktrack',
  webDir: 'dist-store-cap',
  // Fondo del WebView antes de pintar la app — mismo tono que background_color del manifest PWA.
  backgroundColor: '#0B1220',
  ios: {
    // El layout ya maneja safe-areas con env(safe-area-inset-*) — inset automático.
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#0B1220',
      launchAutoHide: true,
      launchShowDuration: 500,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      // style DARK = fondo oscuro con iconos claros; color = theme_color del manifest (#0E5A52).
      style: 'DARK',
      backgroundColor: '#0E5A52',
      overlaysWebView: false,
    },
  },
}

export default config
