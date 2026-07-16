#!/usr/bin/env node
// Hacktrack — métricas de retención (read-only, LFPDPPP-limpio).
//
// Restricción: cero tracking nuevo — solo AGREGA lo que ya existe del lado del servidor
// (auth.users + user_state + push_subscriptions) de usuarios que activaron respaldo.
// Restricción: jamás lee el blob `data` de nadie — solo user_id, timestamps y conteos.
// Restricción: solo GETs de lectura contra producción; nunca escribe nada.
// Restricción: sin dependencias — Node ≥18 con fetch global.
// La service-role key vive en .secrets/ (gitignored) — nunca se hornea en código ni páginas.
//
// Uso:  node scripts/metrics.mjs [--json]

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const KEY_PATH = join(ROOT, '.secrets', 'service-role-key')
const ENV_PATH = join(ROOT, '.env')
const JSON_MODE = process.argv.includes('--json')

// La nota de privacidad es parte del contrato del reporte — va SIEMPRE al final.
const PRIVACY_NOTE =
  'Sin analytics en la app — solo metadatos de sincronización de usuarios que activaron respaldo.'

function fail(msg) {
  console.error(`\n⚠️  ${msg}\n`)
  process.exit(1)
}

// ── Credenciales: siempre en tiempo de ejecución, nunca hardcodeadas ──
let SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SERVICE_KEY) {
  if (!existsSync(KEY_PATH)) {
    fail(
      `No encontré la llave de servicio en ${KEY_PATH}.\n` +
        '   Cópiala desde el panel de Supabase (Settings → API → service_role) a ese archivo y vuelve a intentar.'
    )
  }
  SERVICE_KEY = readFileSync(KEY_PATH, 'utf8').trim()
  if (!SERVICE_KEY) fail(`El archivo ${KEY_PATH} está vacío — pega ahí la llave service_role.`)
}

let BASE_URL = process.env.SUPABASE_URL ?? ''
if (!BASE_URL) {
  if (!existsSync(ENV_PATH)) {
    fail(`No encontré el archivo ${ENV_PATH} — ahí debe vivir VITE_SUPABASE_URL.`)
  }
  const m = readFileSync(ENV_PATH, 'utf8').match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?\s*$/m)
  if (!m) {
    fail('No encontré VITE_SUPABASE_URL en .env — agrega la URL del proyecto Supabase y vuelve a intentar.')
  }
  BASE_URL = m[1]
}
BASE_URL = BASE_URL.replace(/\/+$/, '')

// ── HTTP: la service key omite RLS, por eso este script jamás debe salir del repo ──
async function api(pathname, extraHeaders = {}, method = 'GET') {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extraHeaders },
    signal: AbortSignal.timeout(30_000),
  }).catch((err) => {
    fail(
      `No pude conectar con Supabase (${BASE_URL}).\n` +
        `   Detalle: ${err.cause?.code ?? err.message}. Revisa tu conexión a internet o la URL del proyecto.`
    )
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200)
    fail(`Supabase respondió ${res.status} en ${pathname}.\n   ${body}`)
  }
  return res
}

// ── Cuentas: Admin API paginada (per_page tiene tope del lado del servidor) ──
async function fetchAllUsers() {
  const users = []
  const perPage = 1000
  // Tope de 200 páginas: corta un bucle infinito si la API repitiera resultados.
  for (let page = 1; page <= 200; page++) {
    const res = await api(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`)
    const body = await res.json()
    const batch = Array.isArray(body) ? body : (body.users ?? [])
    users.push(...batch)
    if (batch.length < perPage) break
  }
  return users
}

// ── user_state: solo columnas de metadatos (user_id, updated_at) — nunca `data` ──
async function fetchUserState() {
  const rows = []
  const chunk = 1000
  for (let from = 0; ; from += chunk) {
    const res = await api('/rest/v1/user_state?select=user_id,updated_at', {
      Range: `${from}-${from + chunk - 1}`,
      'Range-Unit': 'items',
    })
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < chunk) break
  }
  return rows
}

// ── push: solo el conteo exacto — una fila de payload como máximo ──
async function fetchPushCount() {
  const res = await api('/rest/v1/push_subscriptions?select=endpoint', {
    Range: '0-0',
    Prefer: 'count=exact',
  })
  const range = res.headers.get('content-range')
  if (range?.includes('/')) return parseInt(range.split('/')[1], 10) || 0
  // Respaldo si el header no llega: contar filas directamente (proyecto chico, aceptable).
  return (await (await api('/rest/v1/push_subscriptions?select=endpoint')).json()).length
}

// ── Cálculo ──
const [users, stateRows, pushCount] = await Promise.all([
  fetchAllUsers(),
  fetchUserState(),
  fetchPushCount(),
])

const now = new Date()
const DAY = 86_400_000
const startToday = new Date(now)
startToday.setHours(0, 0, 0, 0)
const ago7 = now.getTime() - 7 * DAY
const ago30 = now.getTime() - 30 * DAY

// Altas por día — llaves en fecha LOCAL para que el reporte coincida con el día del operador.
const localDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const signupsByDay = new Map()
for (let i = 13; i >= 0; i--) {
  signupsByDay.set(localDayKey(new Date(startToday.getTime() - i * DAY)), 0)
}
for (const u of users) {
  if (!u.created_at) continue
  const key = localDayKey(new Date(u.created_at))
  if (signupsByDay.has(key)) signupsByDay.set(key, signupsByDay.get(key) + 1)
}

// Actividad: ventanas acumulativas (7 d incluye hoy; 30 d incluye 7 d) — proxy DAU/WAU/MAU
// SOLO de usuarios con respaldo; los usuarios solo-locales son invisibles a propósito.
let activeToday = 0
let active7 = 0
let active30 = 0
const lastSyncByUser = new Map()
for (const row of stateRows) {
  const t = new Date(row.updated_at).getTime()
  lastSyncByUser.set(row.user_id, t)
  if (t >= startToday.getTime()) activeToday++
  if (t >= ago7) active7++
  if (t >= ago30) active30++
}
const dormant = stateRows.length - active30

// Retención 7 d: cohorte = cuentas con ≥7 días de vida; retenida = sincronizó en los últimos 7 días.
const cohort = users.filter((u) => u.created_at && new Date(u.created_at).getTime() <= ago7)
const retained = cohort.filter((u) => (lastSyncByUser.get(u.id) ?? 0) >= ago7)

const totalUsers = users.length
const backupUsers = stateRows.length
const activationRate = totalUsers > 0 ? backupUsers / totalUsers : null
const retentionRate = cohort.length > 0 ? retained.length / cohort.length : null

// ── Salida ──
const nf = new Intl.NumberFormat('es-MX')
const pct = (x) => `${(x * 100).toFixed(1)} %`

if (JSON_MODE) {
  console.log(
    JSON.stringify(
      {
        generado: now.toISOString(),
        proyecto: BASE_URL,
        cuentas_totales: totalUsers,
        altas_ultimos_14_dias: [...signupsByDay].map(([fecha, altas]) => ({ fecha, altas })),
        respaldo: { usuarios: backupUsers, tasa_activacion: activationRate },
        actividad: {
          nota: 'solo usuarios con respaldo',
          hoy: activeToday,
          ultimos_7_dias: active7,
          ultimos_30_dias: active30,
          dormidos: dormant,
        },
        retencion_7d: { cohorte: cohort.length, retenidos: retained.length, tasa: retentionRate },
        push_suscripciones_activas: pushCount,
        privacidad: PRIVACY_NOTE,
      },
      null,
      2
    )
  )
  process.exit(0)
}

// Reporte en caja: filas de texto + separadores; el ancho se ajusta a la fila más larga.
const rows = []
const txt = (s = '') => rows.push({ sep: false, s })
const sep = () => rows.push({ sep: true })
// Los puntos guía alinean valores en una columna fija; 46 cubre la etiqueta más larga.
const kv = (label, value) => txt(`${label} ${'.'.repeat(Math.max(2, 46 - label.length))} ${value}`)

const fechaLarga = now.toLocaleDateString('es-MX', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

txt('HACKTRACK · MÉTRICAS DE RETENCIÓN')
txt(`${fechaLarga}, ${hora} · ${BASE_URL.replace('https://', '')}`)
sep()
txt('CUENTAS')
kv('Cuentas totales', nf.format(totalUsers))
kv(
  'Usuarios con respaldo activo',
  `${nf.format(backupUsers)}${activationRate !== null ? `  (${pct(activationRate)} de activación)` : ''}`
)
kv('Suscripciones push activas', nf.format(pushCount))
sep()
txt('ACTIVIDAD POR ÚLTIMA SINCRONIZACIÓN')
txt('(proxy DAU/WAU/MAU — solo usuarios con respaldo)')
kv('Activos hoy', nf.format(activeToday))
kv('Activos últimos 7 días', nf.format(active7))
kv('Activos últimos 30 días', nf.format(active30))
kv('Dormidos (>30 días sin sincronizar)', nf.format(dormant))
sep()
txt('RETENCIÓN SIMPLE A 7 DÍAS')
if (retentionRate === null) {
  txt('Sin cohorte aún (ninguna cuenta tiene ≥7 días de vida).')
} else {
  kv('Cohorte (cuentas con ≥7 días)', nf.format(cohort.length))
  kv('Sincronizaron en los últimos 7 días', `${nf.format(retained.length)}  (${pct(retentionRate)})`)
}
sep()
txt('ALTAS POR DÍA (ÚLTIMOS 14 DÍAS)')
const maxSignups = Math.max(...signupsByDay.values(), 1)
for (const [key, count] of signupsByDay) {
  const [y, m, d] = key.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
  // Barra escalada a 24 columnas para que la caja no se desborde con picos grandes.
  const bar = '█'.repeat(Math.round((count / maxSignups) * 24))
  txt(`  ${label.padEnd(14)} ${String(count).padStart(4)}  ${bar}`)
}

const inner = Math.max(...rows.filter((r) => !r.sep).map((r) => r.s.length))
const H = '─'.repeat(inner + 2)
console.log(`┌${H}┐`)
for (const r of rows) {
  console.log(r.sep ? `├${H}┤` : `│ ${r.s.padEnd(inner)} │`)
}
console.log(`└${H}┘`)
console.log(PRIVACY_NOTE)
