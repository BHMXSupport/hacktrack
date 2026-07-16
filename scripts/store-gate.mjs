#!/usr/bin/env node
// Puerta de cumplimiento de TIENDA (npm run gate:store).
//
// Compila la variante de tienda (VITE_STORE_BUILD=1, BASE '/', outDir dist-store) y una
// línea-base PWA normal, y escanea CADA asset de texto emitido en dist-store buscando
// patrones prohibidos en binarios de tienda:
//   - Apple 1.4.3 / Google "Unapproved Substances": verbos de compra, dominio del vendedor,
//     marca del partner, y adjetivos de beneficio cerca de nombres de compuestos.
//   - Prueba de eliminación REAL de código muerto: los textos únicos de ImportSheet y de
//     InstallGate deben estar AUSENTES en dist-store y PRESENTES en la línea-base
//     (si faltaran también en la base, la ausencia en tienda sería suerte, no DCE).
//   - Los textos que SOLO existen en tienda (aviso de calculadora, "racha de registro")
//     deben estar PRESENTES en dist-store.
// Falla ruidosamente listando archivo + patrón + contexto. Lista blanca documentada abajo.

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const STORE_DIR = join(ROOT, 'dist-store')
// Línea-base en node_modules/.cache (efímero, fuera de git) — NO pisa dist/ del deploy.
const BASELINE_REL = 'node_modules/.cache/store-gate-baseline'
const BASELINE_DIR = join(ROOT, BASELINE_REL)

// ── Compilaciones ──────────────────────────────────────────────────────────────
function build(label, outDir, extraEnv) {
  console.log(`\n[gate:store] Compilando ${label} → ${outDir} …`)
  const env = { ...process.env, BASE_PATH: '/', ...extraEnv }
  // La línea-base debe compilarse SIN la bandera aunque el shell la traiga puesta.
  if (!('VITE_STORE_BUILD' in extraEnv)) delete env.VITE_STORE_BUILD
  const r = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: ROOT, env, stdio: 'inherit',
  })
  if (r.status !== 0) {
    console.error(`\n[gate:store] FALLO: la compilación de ${label} terminó con código ${r.status}`)
    process.exit(1)
  }
}

// ── Utilidades de escaneo ──────────────────────────────────────────────────────
const TEXT_EXT = /\.(js|mjs|css|html|webmanifest|json|svg|txt)$/i

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue
    out.push(join(e.parentPath, e.name))
  }
  return out
}

function textAssets(dir) {
  return walk(dir).filter((f) => TEXT_EXT.test(f))
}

function totalBytes(dir) {
  return walk(dir).reduce((n, f) => n + statSync(f).size, 0)
}

function context(text, index, span = 70) {
  return text.slice(Math.max(0, index - span), index + span).replace(/\s+/g, ' ')
}

// ── Patrones prohibidos en el binario de tienda ────────────────────────────────
// (regex de la política; sin flag g — se itera con matchAll sobre copias con g)
const FORBIDDEN = [
  { name: 'verbo/sustantivo de compra', re: /compra|comprar|compraste/i },
  { name: 'tienda',                     re: /tienda/i },
  { name: 'checkout',                   re: /checkout/i },
  { name: 'carrito',                    re: /carrito/i },
  { name: 'dominio del vendedor',       re: /biohackmx\.com/i },
  // Más estricto que la política mínima: la MARCA del partner tampoco debe existir
  // en el binario (toda su superficie vive en ImportSheet, que está excluido).
  { name: 'marca del partner',          re: /biohackmx/i },
]

// Afirmaciones duras de marketing: prohibidas en CUALQUIER posición del binario.
const HARD_CLAIMS = [
  { name: 'adelgaza(r/nte)',        re: /adelgaz/i },
  { name: 'resultados garantizados', re: /resultados\s+garantizados/i },
  { name: 'quema grasa',             re: /quema(r|ndo)?\s+grasa/i },
]

// Beneficios "de contexto": prohibidos solo CERCA (±160 chars) de un nombre de compuesto —
// "pérdida de peso" como dato clínico genérico lejos de un compuesto no es una oferta,
// pegado a "Semaglutida" sí parece claim de marketing.
const NEAR_CLAIMS = [
  { name: 'pérdida de peso',   re: /p[eé]rdida\s+de\s+peso/i },
  { name: 'pierde/baja peso',  re: /pierde\s+peso|baja\s+de\s+peso\s+garantiz/i },
]
const COMPOUNDS = [
  'Retatrutide', 'Tirzepatida', 'Semaglutida', 'Tesamorelin', 'MOTS-c', '5-Amino-1MQ',
  'SLU-PP-332', 'BPC-157', 'BPC 157', 'TB-500', 'GHK-Cu', 'ARA 290', 'GLOW 70', 'KLOW 80',
  'NAD+', 'SS-31', 'L-Glutathione', 'Semax', 'Selank', 'DSIP', 'Oxytocin', 'CJC 1295',
  'CJC-1295', 'Ipamorelin', 'Kisspeptin-10', 'PT-141', 'péptido', 'peptido',
]
const NEAR_SPAN = 160

// ── Lista blanca (cada entrada DOCUMENTADA) ────────────────────────────────────
// Un hit se permite si su contexto (±70 chars) matchea alguna de estas razones.
const WHITELIST = [
  // (Las 3 entradas de ProtocoloEditSheet fueron retiradas: el copy de gasto/lote ahora está
  //  gateado por STORE_BUILD en el componente — el bundle de tienda ya no contiene "compra".)
  {
    // Aviso de privacidad (public/aviso-privacidad.html): correo de contacto del RESPONSABLE
    // de datos para derechos ARCO — obligación de la LFPDPPP. Es un mailto de soporte legal,
    // no una redirección de compra ni un enlace al catálogo. Ámbito: SOLO ese archivo.
    // (Paso humano sugerido: correo neutro p.ej. soporte@hacktrack.* para el binario de tienda.)
    file: /aviso-privacidad\.html$/,
    ctx: /soporte@biohackmx\.com\.mx/,
    reason: 'Aviso de privacidad: contacto del responsable de datos (LFPDPPP/ARCO), sin CTA de compra',
  },
]

function whitelisted(rel, ctx) {
  return WHITELIST.find((w) => (!w.file || w.file.test(rel)) && w.ctx.test(ctx)) ?? null
}

// ── Marcadores de DCE (deben existir en la base y NO en tienda) ────────────────
const DCE_MARKERS = [
  { label: 'ImportSheet: encabezado de compras', text: 'Tus compras en BiohackMX' },
  { label: 'ImportSheet: CTA de conexión',        text: 'Conectar con BiohackMX' },
  { label: 'InstallGate: copy "sin tienda"',      text: 'sin tienda y siempre a la mano' },
]
// Textos/patrones que SOLO el binario de tienda debe contener (`re` o `text`).
// rachaLabel se pliega en compilación: en tienda queda `(a="racha"){return`${a} de registro`}`
// (la frase se arma en runtime, no existe "racha de registro" contigua) — se detecta el
// default "racha" seguido a ≤24 chars del literal " de registro".
const STORE_ONLY_MARKERS = [
  { label: 'Aviso de calculadora (interstitial)', text: 'solo hace aritmética (reconstitución/conversión)' },
  { label: 'Botón del interstitial',              text: 'Entendido' },
  { label: 'rachaLabel plegado a "… de registro"', re: /"racha"[^]{0,24} de registro/ },
]
const markerHit = (m, text) => (m.re ? m.re.test(text) : text.includes(m.text))
const markerShow = (m) => m.text ?? String(m.re)

// ── Ejecución ──────────────────────────────────────────────────────────────────
build('variante de TIENDA', 'dist-store', { VITE_STORE_BUILD: '1' })
build('línea-base PWA', BASELINE_REL, {})

if (!existsSync(STORE_DIR) || !existsSync(BASELINE_DIR)) {
  console.error('[gate:store] FALLO: falta un directorio de salida tras compilar.')
  process.exit(1)
}

const failures = []
const allowed = []

// 1) Escaneo de patrones prohibidos en dist-store
for (const file of textAssets(STORE_DIR)) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf8')

  for (const { name, re } of [...FORBIDDEN, ...HARD_CLAIMS]) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags + 'g'))) {
      const ctx = context(text, m.index)
      const w = whitelisted(rel, ctx)
      if (w) allowed.push({ rel, name, ctx, reason: w.reason })
      else failures.push({ rel, name, ctx })
    }
  }

  // Beneficios cerca de compuestos
  for (const { name, re } of NEAR_CLAIMS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags + 'g'))) {
      const lo = Math.max(0, m.index - NEAR_SPAN)
      const windowTxt = text.slice(lo, m.index + m[0].length + NEAR_SPAN)
      const near = COMPOUNDS.find((c) => windowTxt.toLowerCase().includes(c.toLowerCase()))
      if (near) failures.push({ rel, name: `${name} cerca de "${near}"`, ctx: context(text, m.index) })
    }
  }
}

// 2) Ningún chunk con nombre de ImportSheet en dist-store
for (const file of walk(STORE_DIR)) {
  if (/ImportSheet/i.test(relative(STORE_DIR, file))) {
    failures.push({ rel: relative(ROOT, file), name: 'chunk de ImportSheet emitido', ctx: '(nombre de archivo)' })
  }
}

// 3) DCE real: marcadores ausentes en tienda Y presentes en la base
const storeText = textAssets(STORE_DIR).map((f) => readFileSync(f, 'utf8')).join('\n')
const baseText = textAssets(BASELINE_DIR).map((f) => readFileSync(f, 'utf8')).join('\n')
for (const { label, text } of DCE_MARKERS) {
  if (storeText.includes(text)) failures.push({ rel: 'dist-store/*', name: `marcador presente en tienda: ${label}`, ctx: text })
  if (!baseText.includes(text)) failures.push({ rel: BASELINE_REL, name: `marcador AUSENTE en la línea-base (la ausencia en tienda no probaría DCE): ${label}`, ctx: text })
}
for (const m of STORE_ONLY_MARKERS) {
  if (!markerHit(m, storeText)) failures.push({ rel: 'dist-store/*', name: `marcador de tienda AUSENTE: ${m.label}`, ctx: markerShow(m) })
}

// 4) Reporte
console.log('\n──────────────────────────── gate:store ────────────────────────────')
if (allowed.length) {
  console.log(`Hits permitidos por lista blanca (${allowed.length}):`)
  for (const a of allowed) console.log(`  · [${a.name}] ${a.rel}\n      contexto: …${a.ctx}…\n      razón:    ${a.reason}`)
}

const storeBytes = totalBytes(STORE_DIR)
const baseBytes = totalBytes(BASELINE_DIR)
const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`\nTamaño total emitido — tienda: ${kb(storeBytes)} · base PWA: ${kb(baseBytes)} · delta: ${kb(storeBytes - baseBytes)}`)

const informativeBaseline = STORE_ONLY_MARKERS.filter((m) => markerHit(m, baseText))
if (informativeBaseline.length) {
  console.log(`(info) Textos solo-tienda que TAMBIÉN están en la base PWA: ${informativeBaseline.map((m) => m.label).join(', ')}`)
}

if (failures.length) {
  console.error(`\n✗ FALLÓ gate:store — ${failures.length} hallazgo(s):`)
  for (const f of failures) console.error(`  ✗ [${f.name}] ${f.rel}\n      contexto: …${f.ctx}…`)
  process.exit(1)
}
console.log('\n✓ gate:store OK — dist-store no contiene patrones prohibidos y la DCE quedó demostrada.')
