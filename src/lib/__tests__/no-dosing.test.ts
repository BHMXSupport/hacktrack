// Ata `npm test` a la PUERTA DE DOSIFICACIÓN (scripts/no-dosing-gate.mjs): así el gate
// legal corre en CADA corrida de tests, no solo en `npm run gate:dosing`. Es un control
// LGS art. 262 (bitácora vs dispositivo médico/SaMD): la app NO puede emitir una dosis
// recomendada. Corre el MISMO gate como subproceso (no lo re-implementa) para que fuente
// y prueba no puedan divergir. Además: (a) control positivo — una inyección en scratch
// (fuera del repo) DEBE fallar; (b) la copia legítima NO debe marcarse; (c) la salida
// visible de la calculadora no es una recomendación.
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calcRecon, copyToRegisterToast } from '../calc'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..') // src/lib/__tests__ → raíz del repo
const GATE = join(REPO, 'scripts', 'no-dosing-gate.mjs')

/** Corre el gate real; devuelve {code, out}. code 0 = OK, code 1 = halló recomendación. */
function runGate(roots: string[] = []): { code: number; out: string } {
  try {
    const out = execFileSync('node', [GATE, ...roots], { cwd: REPO, encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

/** Escribe `body` en un .tsx dentro de un dir temporal y corre el gate SOLO ahí. */
function gateOnScratch(body: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'no-dosing-'))
  try {
    writeFileSync(join(dir, 'Scratch.tsx'), body)
    return runGate([dir])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('gate:dosing — la fuente actual es una bitácora (no SaMD)', () => {
  it('la fuente viva PASA el gate (ninguna cadena visible recomienda una dosis)', () => {
    const r = runGate()
    expect(r.code, `El gate falló:\n${r.out}`).toBe(0)
    expect(r.out).toMatch(/gate:dosing OK/)
  })
})

// Control positivo: cada patrón prohibido DEBE tumbar el gate. La inyección vive en un
// dir temporal (scratch), NUNCA en el repo — se borra al terminar cada caso.
const FORBIDDEN: Array<[string, RegExp]> = [
  ['Tu dosis recomendada es 5 mg al día.', /dosis recomendada/i],
  ['Dosis sugerida para esta semana: 0.25 mg.', /dosis sugerida/i],
  ['La dosis ideal para ti es 10 UI.', /dosis ideal/i],
  ['Te recomendamos 2.5 mg esta semana.', /te recomendamos/i],
  ['Deberías aplicar 250 mcg hoy.', /deber[íi]as/i],
  ['Aumenta a 5 mg la próxima semana.', /aumenta a/i],
  ['Sube a 3 clics por la mañana.', /sube a/i],
  ['Titula a 10 UI en la fase 2.', /titula a/i],
  ['Próxima dosis sugerida: 0.5 mg mañana.', /próxima dosis sugerida|dosis sugerida/i],
  ['Tu dosis es de 5 mg diarios.', /tu dosis es/i],
]

describe('gate:dosing — control positivo (inyección en scratch, no en el repo)', () => {
  it.each(FORBIDDEN)('rechaza %j', (phrase, marker) => {
    const r = gateOnScratch(`export const X = () => <p>${phrase}</p>\n`)
    expect(r.code, `Debió FALLAR pero pasó:\n${r.out}`).toBe(1)
    expect(r.out).toMatch(marker)
    expect(r.out).toMatch(/Scratch\.tsx/)
  })
})

// Guardia anti-falsos-positivos: la copia legítima (la dosis PROPIA del usuario, o el
// CALENDARIO) NO debe marcarse — si el gate se volviera demasiado agresivo, esto rompe.
const ALLOWED: string[] = [
  'Registra tu dosis de hoy.',
  '¿Cuál fue tu dosis?',
  'Editar dosis',
  'La dosis que YA usas.',
  'Próxima dosis en 2 h.',
  'Esto no es recomendación de dosis.',
  'No es recomendación médica ni de dosificación.',
]

describe('gate:dosing — la copia legítima NO se marca', () => {
  it.each(ALLOWED)('permite %j', (phrase) => {
    const r = gateOnScratch(`export const X = () => <p>${phrase}</p>\n`)
    expect(r.code, `Falso positivo:\n${r.out}`).toBe(0)
  })
})

// Pin de calc a nivel de STRING: lo que el usuario VE de la calculadora es una
// conversión ("… 5 UI … verifica con tu jeringa"), nunca una recomendación.
describe('calc — su salida visible no es una recomendación de dosis', () => {
  it('copyToRegisterToast reporta la conversión y no aconseja una dosis', () => {
    const r = calcRecon({ vial: 10, agua: 2, dosis: 250, unit: 'mcg', scale: 100 })!
    const toast = copyToRegisterToast(r)
    expect(toast).toMatch(/verifica con tu jeringa/)
    expect(toast).not.toMatch(/dosis (recomendad|sugerid|ideal)|deber[íi]as|tu dosis es/i)
  })
})
