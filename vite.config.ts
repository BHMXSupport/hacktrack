import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Base de despliegue: '/' en dev/local; '/hacktrack/' para GitHub Pages (subpath).
// Se activa con BASE_PATH=/hacktrack/ npm run build (no afecta el dev server).
const BASE = process.env.BASE_PATH || '/'

// Sello de build (hash corto de git + fecha) → visible en Ajustes para DIAGNOSTICAR caché:
// si el usuario ve un hash viejo, está cargando un bundle viejo (no es bug de la app).
// HACKTRACK_SHA fuerza el sello sin commit — lo usa la suite de verificación del SW para
// producir dos builds distinguibles (test de actualización).
let GIT_SHA = process.env.HACKTRACK_SHA || 'dev'
if (!process.env.HACKTRACK_SHA) {
  try { GIT_SHA = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* sin git */ }
}
const BUILD_TIME = new Date().toISOString()

// ── Contrato de precache (SW real, strategies: 'injectManifest') ───────────────────────────────
// mp4/webp DEBEN precachearse: si no, el JS cacheado apunta a media con hash viejo que ya no
// existe tras un redeploy → 404 / "?" en heroes (causa del outage original). Versionan con el SW.
// promo/ queda fuera: assets de marketing (~34MB) ajenos al app shell.
const PRECACHE_GLOBS = ['**/*.{js,css,html,svg,png,webp,mp4,woff2}']
const PRECACHE_IGNORES = ['promo/**']
const PRECACHE_CAP_BYTES = 3 * 1024 * 1024

// Guardia anti-regresión: un asset que supere el tope saldría del precache EN SILENCIO y reviviría
// la clase de bug de media desincronizada. Preferimos que el build truene a un deploy degradado.
function precacheCapGuard(): Plugin {
  let outDir = 'dist'
  const matchesGlob = /\.(?:js|css|html|svg|png|webp|mp4|woff2)$/
  return {
    name: 'hacktrack:precache-cap-guard',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    closeBundle() {
      const offenders: string[] = []
      let entries: import('node:fs').Dirent[]
      try {
        entries = readdirSync(outDir, { recursive: true, withFileTypes: true })
      } catch { return /* sin dist (build cancelado) */ }
      for (const e of entries) {
        if (!e.isFile()) continue
        const abs = join(e.parentPath, e.name)
        const rel = relative(outDir, abs).split('\\').join('/')
        if (rel.startsWith('promo/')) continue // espejo de PRECACHE_IGNORES
        if (!matchesGlob.test(rel)) continue
        const size = statSync(abs).size
        if (size > PRECACHE_CAP_BYTES) offenders.push(`${rel} (${(size / 1024 / 1024).toFixed(2)} MB)`)
      }
      if (offenders.length) {
        throw new Error(
          `[hacktrack] Assets sobre el tope de precache (${PRECACHE_CAP_BYTES / 1024 / 1024} MB) — ` +
          `quedarían FUERA del precache y desincronizarían JS/media:\n  - ${offenders.join('\n  - ')}\n` +
          'Comprime el asset o muévelo fuera del app shell (p.ej. promo/).',
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  define: {
    __BUILD_SHA__: JSON.stringify(GIT_SHA),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: {
    // Code-splitting básico: separa los vendors pesados del chunk principal (antes monolítico ~940KB)
    // → cargan en paralelo y cachean por separado entre deploys. Sin cambio de comportamiento.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-motion': ['framer-motion'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SW real (promovido desde el stub selfDestroying): src/sw.ts compilado por el plugin.
      // Rollback probado: restaurar selfDestroying:true y redesplegar — el stub desregistra y
      // limpia caches en cada carga (mismo mecanismo que ya salvó el outage original).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: PRECACHE_GLOBS,
        globIgnores: PRECACHE_IGNORES,
        maximumFileSizeToCacheInBytes: PRECACHE_CAP_BYTES,
        // El registro en prod es type:'classic' → el bundle del SW no puede llevar `export`;
        // esto los omite del output sin perderlos en el fuente (los usa la suite de tests).
        rollupOptions: { preserveEntrySignatures: false },
      },
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
        // method GET → el navegador navega solo a ?action=microlog&text=...;
        // NO pasa por el SW (el fetch handler no participa en el share).
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
      devOptions: { enabled: false },
    }),
    precacheCapGuard(),
  ],
})
