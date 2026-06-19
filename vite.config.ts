import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base de despliegue: '/' en dev/local; '/hacktrack/' para GitHub Pages (subpath).
// Se activa con BASE_PATH=/hacktrack/ npm run build (no afecta el dev server).
const BASE = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'apple-touch-icon-180.png'],
      manifest: {
        name: 'Hacktrack',
        short_name: 'Hacktrack',
        description: 'Tu progreso, en una sola pantalla.',
        lang: 'es-MX',
        theme_color: '#0E5A52',
        background_color: '#0B1220',
        display: 'standalone',
        orientation: 'portrait',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // ── App Shortcuts (items 314 + 438) ──────────────────────────────────
        // Permiten iniciar la app directamente en Registrar o Medida rápida
        // desde el menú de larga pulsación del icono en Android / ChromeOS.
        // El query-param ?action= es capturado en App.tsx al montar.
        shortcuts: [
          {
            name: 'Registrar dosis',
            short_name: 'Registrar',
            description: 'Abre la pantalla de registro de dosis',
            url: `${BASE}?action=log`,
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Medida rápida',
            short_name: 'Medida',
            description: 'Registra peso u otra medida al instante',
            url: `${BASE}?action=medida`,
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Micro-log',
            short_name: 'Micro-log',
            description: 'Registro rápido desde la pantalla de inicio del OS',
            url: `${BASE}?action=microlog`,
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
        ],
        // ── Web Share Target (item 314) ───────────────────────────────────────
        // Permite que otras apps compartan texto/URL directamente a Hacktrack.
        // El SW captura la petición POST y la redirige a /?action=microlog&text=...
        share_target: {
          action: `${BASE}?action=microlog`,
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
      },
      workbox: {
        // Incluye mp4/webp: si no se precachean, el JS cacheado apunta a media con hash viejo
        // que ya no existe tras un redeploy → 404 / "?" en heroes. Versionados con el SW + limpieza.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,mp4,woff2}'],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'google-fonts-css' } },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
