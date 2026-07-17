#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// PUERTA DE CUMPLIMIENTO DE DOSIFICACIÓN — no-dosing-gate  (npm run gate:dosing)
//
// POR QUÉ EXISTE (control legal, NO estilo):
//   Hacktrack es una BITÁCORA: el usuario teclea/elige lo que registra y la
//   calculadora SOLO hace aritmética (reconstitución/conversión U-100). En cuanto
//   la app EMITE una RECOMENDACIÓN DE DOSIS o una interpretación clínica ("tu
//   dosis recomendada es X mg", "aumenta a 5", "deberías aplicar…"), cruza el
//   límite de la Ley General de Salud (LGS art. 262) y pasa a ser un DISPOSITIVO
//   MÉDICO / software como dispositivo médico (SaMD) que exige REGISTRO SANITARIO
//   ante COFEPRIS. Ese es el límite que este gate escribe en CI: hace
//   MECÁNICAMENTE IMPOSIBLE mergear/compilar una cadena visible que recomiende una
//   dosis sin romper el build (`npm run gate:dosing`) y la prueba (`npm test`).
//
//   Permitido (la dosis PROPIA del usuario): "registra tu dosis", "¿cuál fue tu
//   dosis?", "editar dosis", "la dosis que YA usas", "Próxima dosis en 2 h"
//   (eso es CALENDARIO, no una cantidad recomendada).
//   Prohibido (la app decide/aconseja la cantidad): las cadenas de PATRONES abajo.
//
// QUÉ ESCANEA:
//   El CÓDIGO FUENTE bajo src/v2/** y src/lib/** (.ts/.tsx), excluyendo __tests__
//   y *.d.ts. Escanear la fuente (no el bundle) es más simple y robusto y no
//   depende de compilar; el sesgo es FALLAR RUIDOSAMENTE (mejor un falso positivo
//   revisado por humano que un falso negativo que se publica en silencio). Los
//   comentarios internos NO llegan al usuario: los pocos que rocen un patrón se
//   documentan en ALLOWLIST, cada uno justificado.
//
// USO:
//   node scripts/no-dosing-gate.mjs            → escanea las raíces por defecto
//   node scripts/no-dosing-gate.mjs <dir…>     → escanea esos dir (usado por el
//                                                 test para probar una inyección
//                                                 en scratch, fuera del repo)
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DEFAULT_ROOTS = ['src/v2', 'src/lib']

// ── Patrones prohibidos: cadenas que CONSTITUYEN una recomendación de dosis ─────
// Sin flag `g` (se itera con matchAll sobre una copia con `g`). Conservadores a
// propósito: exigen el sustantivo "dosis" pegado al adjetivo de recomendación, o
// un verbo imperativo de titulación seguido de un número. La copia legítima
// (dosis PROPIA del usuario) nunca tiene esa forma. `\s+` tolera espacios/saltos
// pero NO cruza texto no-blanco, así que no une frases separadas por markup.
export const PATTERNS = [
  { name: 'dosis recomendada',                    re: /dosis\s+recomendad[ao]s?/i },
  { name: 'dosis sugerida',                       re: /dosis\s+sugerid[ao]s?/i },
  { name: 'dosis ideal',                          re: /dosis\s+ideal(?:es)?/i },
  // "te recomendamos …<cantidad>" en la MISMA línea (≤120 chars; evita ReDoS del `.*`)
  { name: 'te recomendamos <cantidad>',           re: /te\s+recomendamos[^\n]{0,120}\b(?:mg|mcg|ui|unidades)\b/i },
  { name: 'deberías tomar/aplicar/inyectar/usar', re: /deber[íi]as\s+(?:tomar|aplicar|inyectar|usar)/i },
  { name: 'aumenta a <n>',                        re: /aumenta\s+a\s+\d/i },
  { name: 'sube a <n>',                           re: /sube\s+a\s+\d/i },
  { name: 'titula a <n>',                         re: /titula\s+a\s+\d/i },
  { name: 'próxima dosis sugerida',               re: /pr[óo]xima\s+dosis\s+sugerid[ao]/i },
  { name: 'tu dosis es',                          re: /tu\s+dosis\s+es\b/i },
]

// ── Lista blanca (cada entrada DOCUMENTADA y justificada) ───────────────────────
// Un hit se permite SOLO si su archivo (rel) y su línea (ctx) matchean una entrada.
// El doble filtro (archivo + contexto específico) impide que una entrada tape una
// violación real en otro lugar. Mantener esta lista corta: es la excepción, no la
// regla — cada entrada es texto NO visible al usuario (comentario interno).
// Vacía a propósito: el único hit previo (un comentario en provider.tsx) se reformuló.
// Si en el futuro un comentario interno inequívoco dispara un patrón, documentarlo aquí
// con { file, ctx, reason } y justificación (nunca para copy visible al usuario).
export const ALLOWLIST = []

// ── Descubrimiento de archivos ──────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-store', 'dist-store-cap', 'dist-e2e', 'dist-e2e2', 'android', 'ios'])
const SOURCE_EXT = /\.(?:ts|tsx)$/i

function walk(dir) {
  const out = []
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name === '__tests__') continue
      out.push(...walk(full))
    } else if (e.isFile()) {
      out.push(full)
    }
  }
  return out
}

function sourceFiles(roots) {
  const files = []
  for (const r of roots) {
    const abs = isAbsolute(r) ? r : join(ROOT, r)
    for (const f of walk(abs)) {
      if (!SOURCE_EXT.test(f)) continue
      if (/\.d\.ts$/i.test(f)) continue
      files.push(f)
    }
  }
  return files
}

// ── Escaneo ─────────────────────────────────────────────────────────────────────
function lineAt(text, index) {
  const before = text.slice(0, index)
  const line = before.split('\n').length
  const start = before.lastIndexOf('\n') + 1
  const end = text.indexOf('\n', index)
  const lineText = text.slice(start, end === -1 ? text.length : end).trim()
  return { line, lineText }
}

function allowedBy(rel, lineText) {
  return ALLOWLIST.find((w) => w.file.test(rel) && w.ctx.test(lineText)) ?? null
}

/** Escanea un solo texto y devuelve todos los hits {name, matched, index}. */
export function scanText(text) {
  const hits = []
  for (const { name, re } of PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags.replace('g', '') + 'g'))) {
      hits.push({ name, matched: m[0], index: m.index })
    }
  }
  return hits
}

/** Escanea las raíces dadas. Devuelve {findings, allowed, filesScanned}. */
export function scanSource(roots = DEFAULT_ROOTS) {
  const findings = []
  const allowed = []
  const files = sourceFiles(roots)
  for (const file of files) {
    const rel = relative(ROOT, file) || file
    const text = readFileSync(file, 'utf8')
    for (const { name, matched, index } of scanText(text)) {
      const { line, lineText } = lineAt(text, index)
      const w = allowedBy(rel, lineText)
      if (w) allowed.push({ rel, line, name, matched, lineText, reason: w.reason })
      else findings.push({ rel, line, name, matched, lineText })
    }
  }
  return { findings, allowed, filesScanned: files.length }
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
function runCli() {
  const args = process.argv.slice(2)
  const roots = args.length ? args : DEFAULT_ROOTS
  const { findings, allowed, filesScanned } = scanSource(roots)

  console.log('──────────────────────────── gate:dosing ────────────────────────────')
  console.log(`Raíces: ${roots.join(', ')}  ·  archivos escaneados: ${filesScanned}`)

  if (allowed.length) {
    console.log(`\nHits permitidos por lista blanca (${allowed.length}) — comentario interno, no visible al usuario:`)
    for (const a of allowed) {
      console.log(`  · [${a.name}] ${a.rel}:${a.line}  →  "${a.matched}"`)
      console.log(`      razón: ${a.reason}`)
    }
  }

  if (findings.length) {
    console.error(`\n✗ FALLÓ gate:dosing — ${findings.length} recomendación(es) de dosis en cadena visible:`)
    for (const f of findings) {
      console.error(`  ✗ [${f.name}] ${f.rel}:${f.line}  →  "${f.matched}"`)
      console.error(`      línea: ${f.lineText}`)
    }
    console.error(
      '\nHacktrack es una BITÁCORA, no un dispositivo médico. Una dosis recomendada la\n' +
      'convertiría en SaMD (LGS art. 262) con obligación de registro sanitario. Elimina la\n' +
      'recomendación (el usuario teclea SU dosis; la calculadora solo convierte) o, si el hit\n' +
      'es un comentario interno inequívoco, documéntalo en ALLOWLIST con justificación.',
    )
    process.exit(1)
  }

  console.log('\n✓ gate:dosing OK — ninguna cadena visible recomienda una dosis (bitácora, no SaMD).')
}

// Solo corre el CLI cuando se ejecuta directamente (no al importarse desde un test).
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  runCli()
}
