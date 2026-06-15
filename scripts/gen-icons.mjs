// Genera los iconos PWA de Hacktrack desde un SVG diseñado (marca: señal que fluye a un anillo).
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync('public', { recursive: true })

// Marca centrada en el 64% central (segura para "maskable")
function icon({ bg = true } = {}) {
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#11695e"/><stop offset="1" stop-color="#0b1220"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.4" r="0.55">
      <stop offset="0" stop-color="#5eead4" stop-opacity="0.20"/><stop offset="1" stop-color="#5eead4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${bg ? '<rect width="512" height="512" rx="112" fill="url(#bg)"/><rect width="512" height="512" rx="112" fill="url(#glow)"/>' : ''}
  <g fill="none" stroke="#5eead4" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 256 H196 L222 188 L262 324 L286 256 H318"/>
  </g>
  <circle cx="356" cy="256" r="46" fill="none" stroke="#5eead4" stroke-width="24"/>
  <circle cx="356" cy="256" r="15" fill="#b6f09c"/>
</svg>`
}

async function png(svg, size, file, density = 512) {
  await sharp(Buffer.from(svg), { density }).resize(size, size).png().toFile(`public/${file}`)
  console.log('✓', file, size)
}

await png(icon(), 512, 'pwa-512.png')
await png(icon(), 192, 'pwa-192.png')
await png(icon(), 512, 'maskable-512.png')        // mismo arte, marca dentro del área segura
await png(icon(), 180, 'apple-touch-icon-180.png')
await png(icon({ bg: false }), 64, 'favicon-64.png')
console.log('listo')
