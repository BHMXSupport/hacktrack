// Hacktrack — Edge Function: push-scheduler
// ──────────────────────────────────────────────────────────────────────────────
// Se invoca por cron cada 15 min. Para cada usuario con suscripción Web Push,
// calcula qué recordatorios de dosis caen en la ventana actual [ahora, ahora+15min)
// y le manda un Web Push. Usa la SERVICE_ROLE key (omite RLS) para leer TODAS las
// filas de `push_subscriptions` y `user_state`.
//
// Librería de envío: @negrel/webpush (Deno-nativa, RFC 8291/8292 sobre Web Crypto + fetch).
//   ↳ Se eligió sobre `web-push@3` (npm) porque esa depende de `https.Agent`/crypto de
//     Node y NO corre de forma fiable en el isolate de Deno de Supabase Edge. Detalle y
//     plan B (firmar el JWT VAPID a mano) en el README.
//
// Estilo: comentarios en es-MX, código en inglés. Robustez: ningún error por usuario o
// por suscripción aborta el lote — se loggea y se continúa.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.3'

// ── Tipos del dominio (portados del cliente) ──────────────────────────────────
type CadenceMode = 'dia' | 'sem' | 'mes' | 'cadaN' | 'ciclo' | 'uso'

interface UserCadence {
  mode: CadenceMode
  days: boolean[]
  every: number
  semDays: boolean[]
  n?: number
  on?: number
  off?: number
}

interface UserProtocol {
  product: string
  cadence: UserCadence
  startDate: number
  endDate?: number | null
  reminderTime: string // 'HH:MM'
  archived?: boolean
}

interface UserSettings {
  remindersEnabled?: boolean
  summaryTime?: string // 'HH:MM'
  dailySummary?: boolean
  secondReminderMin?: number
}

interface UserStateData {
  settings?: UserSettings
  protocols?: Record<string, UserProtocol>
}

interface SubscriptionRow {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
}

// Forma JSON estándar de PushSubscription que espera @negrel/webpush.
interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

interface PushPayload {
  title: string
  body: string
  tag: string
  data: { goto: string }
}

// ── Helpers de fechas/cadencia (PORTADOS TAL CUAL del cliente, ya validados) ──
const DAY = 86400000
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const dayDiff = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY)
// índice de día semana en orden L,Ma,Mi,J,V,S,D (Lunes=0):
const wdsIndex = (d: Date) => (d.getDay() + 6) % 7

function diaTocaCadence(d: Date, cad: UserCadence, start: Date): boolean {
  const day = dayDiff(d, start); if (day < 0) return false
  const i = wdsIndex(d)
  switch (cad.mode) {
    case 'dia': return !!cad.days[i]
    case 'sem': {
      const weeks = Math.floor(day / 7)
      return weeks % Math.max(1, cad.every) === 0 && !!cad.semDays[i]
    }
    case 'mes': {
      const months = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth())
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const targetDay = Math.min(start.getDate(), dim)
      return months >= 0 && months % Math.max(1, cad.every) === 0 && d.getDate() === targetDay
    }
    case 'cadaN': return day % Math.max(1, cad.n ?? 1) === 0
    case 'ciclo': {
      const m = (cad.on ?? 1) + (cad.off ?? 0)
      const pos = day % m
      return pos < (cad.on ?? 1)
    }
    default: return false // 'uso' → sin recordatorio programado
  }
}

// ── Zona horaria ───────────────────────────────────────────────────────────────
// No guardamos la tz del usuario → asumimos America/Mexico_City para interpretar
// `reminderTime`/`summaryTime` y el "día de hoy". TODO (README): tz por usuario.
const TZ = 'America/Mexico_City'

/** Devuelve la hora MX actual como minutos desde medianoche (0–1439). */
function mxNowMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  // 'en-CA' puede emitir '24' a medianoche; normalizamos a 0.
  return ((hh % 24) * 60) + mm
}

/**
 * Construye un Date que, interpretado en LOCAL, representa el inicio del día MX de "now".
 * Lo usamos sólo como argumento de diaTocaCadence/startOfDay, donde únicamente importan
 * año/mes/día (las funciones portadas normalizan a medianoche local).
 */
function mxToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** 'HH:MM' → minutos desde medianoche, o null si está mal formado. */
function hhmmToMinutes(s: string | undefined): number | null {
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const hh = Number(m[1]); const mm = Number(m[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

/**
 * ¿`target` (minutos) cae en la ventana [start, start+WINDOW)?
 * Maneja el wrap de medianoche (p.ej. ventana 23:55 → 00:10).
 */
const WINDOW_MIN = 15
function inWindow(target: number, startMin: number): boolean {
  const end = startMin + WINDOW_MIN
  if (end <= 24 * 60) return target >= startMin && target < end
  // wrap: [startMin, 1440) ∪ [0, end-1440)
  return target >= startMin || target < (end - 24 * 60)
}

// ── Payloads de push ─────────────────────────────────────────────────────────
// El SW del cliente enruta por `tag` (y de forma forward-compatible por data.goto):
//   hacktrack-dose-<producto>     → registrar:<producto>
//   hacktrack-daily-summary       → tab:semana
// Copys finales: títulos SIN la palabra "Hacktrack".
function dosePayload(product: string): PushPayload {
  return {
    title: `Hora de tu ${product}`,
    body: 'Márcalo en un toque y conserva tu racha.',
    tag: `hacktrack-dose-${product}`,
    data: { goto: `registrar:${product}` },
  }
}

function summaryPayload(products: string[]): PushPayload {
  const list = products.join(', ')
  return {
    title: 'Tu plan de hoy',
    body: list ? `Te toca: ${list}.` : 'Revisa tus dosis de hoy.',
    tag: 'hacktrack-daily-summary',
    data: { goto: 'tab:semana' },
  }
}

// ── Envío Web Push ─────────────────────────────────────────────────────────────
// HTTP de "gone" (suscripción muerta): borrar la fila. 404 (Not Found) / 410 (Gone).
const GONE_STATUSES = new Set([404, 410])

interface SendOutcome { sent: boolean; gone: boolean }

async function sendOne(
  app: webpush.ApplicationServer,
  sub: SubscriptionRow,
  payload: PushPayload,
): Promise<SendOutcome> {
  const subscription: PushSubscriptionJSON = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }
  try {
    const subscriber = app.subscribe(subscription)
    await subscriber.pushTextMessage(JSON.stringify(payload), {})
    return { sent: true, gone: false }
  } catch (err) {
    // @negrel/webpush lanza PushMessageError con .response cuando el push service responde con error.
    const status = (err as { response?: Response })?.response?.status
    if (typeof status === 'number' && GONE_STATUSES.has(status)) {
      console.warn(`[push] suscripción gone (${status}) endpoint=${sub.endpoint.slice(0, 48)}…`)
      return { sent: false, gone: true }
    }
    console.error(`[push] fallo al enviar a ${sub.endpoint.slice(0, 48)}…:`, err)
    return { sent: false, gone: false }
  }
}

// ── Núcleo: procesa un usuario ──────────────────────────────────────────────────
interface UserResult { pushesSent: number; goneEndpoints: string[] }

async function processUser(
  app: webpush.ApplicationServer,
  subs: SubscriptionRow[],
  state: UserStateData | null,
  now: Date,
  nowMin: number,
): Promise<UserResult> {
  const result: UserResult = { pushesSent: 0, goneEndpoints: [] }
  if (!state) return result

  const settings = state.settings ?? {}
  // remindersEnabled === false → saltar por completo (default: habilitado).
  if (settings.remindersEnabled === false) return result

  const today = mxToday(now)
  const protocols = state.protocols ?? {}

  // 1) Recordatorios de dosis: protocolos NO archivados que tocan hoy y cuya hora cae en la ventana.
  const payloads: PushPayload[] = []
  const todaysProducts: string[] = [] // para el resumen diario

  for (const proto of Object.values(protocols)) {
    if (!proto || proto.archived) continue
    const start = new Date(proto.startDate)
    if (Number.isNaN(start.getTime())) continue
    // endDate (si existe) acota la vigencia del protocolo.
    if (proto.endDate != null && now.getTime() > proto.endDate) continue
    if (!diaTocaCadence(today, proto.cadence, start)) continue

    todaysProducts.push(proto.product)

    const reminderMin = hhmmToMinutes(proto.reminderTime)
    if (reminderMin != null && inWindow(reminderMin, nowMin)) {
      payloads.push(dosePayload(proto.product))
    }
  }

  // 2) Resumen diario: si dailySummary !== false y summaryTime cae en la ventana.
  if (settings.dailySummary !== false) {
    const summaryMin = hhmmToMinutes(settings.summaryTime)
    if (summaryMin != null && inWindow(summaryMin, nowMin) && todaysProducts.length > 0) {
      payloads.push(summaryPayload(todaysProducts))
    }
  }

  if (payloads.length === 0) return result

  // 3) Enviar cada payload a TODAS las suscripciones del usuario. No tenemos forma fiable de saber,
  //    desde aquí, si ya registró la dosis → enviamos igual; el cliente de-duplica visualmente por `tag`.
  for (const payload of payloads) {
    for (const sub of subs) {
      const outcome = await sendOne(app, sub, payload)
      if (outcome.sent) result.pushesSent++
      if (outcome.gone) result.goneEndpoints.push(sub.endpoint)
    }
  }
  return result
}

// ── Carga de estado por usuario ─────────────────────────────────────────────────
async function loadUserStates(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserStateData | null>> {
  const map = new Map<string, UserStateData | null>()
  if (userIds.length === 0) return map
  const { data, error } = await supabase
    .from('user_state')
    .select('user_id, data')
    .in('user_id', userIds)
  if (error) {
    console.error('[push] error leyendo user_state:', error.message)
    return map
  }
  for (const row of data ?? []) {
    map.set(row.user_id as string, (row.data ?? null) as UserStateData | null)
  }
  return map
}

// ── Construye el ApplicationServer (VAPID) desde los secretos ────────────────────
async function buildAppServer(): Promise<webpush.ApplicationServer> {
  const subject = Deno.env.get('VAPID_SUBJECT') // p.ej. mailto:soporte@biohackmx.com.mx
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!subject || !publicKey || !privateKey) {
    throw new Error('Faltan secretos VAPID: VAPID_SUBJECT / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY')
  }
  // Las claves VAPID se importan en formato JWK (ver README para generarlas/convertirlas).
  const vapidKeys = await webpush.importVapidKeys(
    { publicKey: JSON.parse(publicKey), privateKey: JSON.parse(privateKey) },
    { extractable: false },
  )
  return await webpush.ApplicationServer.new({ contactInformation: subject, vapidKeys })
}

// ── Entry point ─────────────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  const summary = { usersProcessed: 0, pushesSent: 0, removed: 0 }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    }

    // Cliente con SERVICE_ROLE → omite RLS para leer todas las filas.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const app = await buildAppServer()

    const now = new Date()
    const nowMin = mxNowMinutes(now)

    // 1) Lee todas las suscripciones.
    const { data: subRows, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, user_id, p256dh, auth')
    if (subErr) throw new Error(`leyendo push_subscriptions: ${subErr.message}`)

    const subscriptions = (subRows ?? []) as SubscriptionRow[]

    // 2) Agrupa por user_id.
    const byUser = new Map<string, SubscriptionRow[]>()
    for (const s of subscriptions) {
      const arr = byUser.get(s.user_id) ?? []
      arr.push(s)
      byUser.set(s.user_id, arr)
    }

    // 3) Carga el estado de cada usuario en un solo query.
    const states = await loadUserStates(supabase, [...byUser.keys()])

    // 4) Procesa usuario por usuario; un fallo no tumba el lote.
    const goneEndpoints: string[] = []
    for (const [userId, subs] of byUser) {
      summary.usersProcessed++
      try {
        const res = await processUser(app, subs, states.get(userId) ?? null, now, nowMin)
        summary.pushesSent += res.pushesSent
        goneEndpoints.push(...res.goneEndpoints)
      } catch (err) {
        console.error(`[push] usuario ${userId} falló (continuando):`, err)
      }
    }

    // 5) Limpia suscripciones muertas (404/410). De-dup por endpoint.
    const uniqueGone = [...new Set(goneEndpoints)]
    if (uniqueGone.length > 0) {
      const { error: delErr } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', uniqueGone)
      if (delErr) console.error('[push] error borrando suscripciones gone:', delErr.message)
      else summary.removed = uniqueGone.length
    }
  } catch (err) {
    // Error de nivel-lote (config/secretos/conexión): log + 500, pero nunca un throw sin capturar.
    console.error('[push] error fatal del lote:', err)
    return new Response(
      JSON.stringify({ ...summary, error: String((err as Error)?.message ?? err) }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  console.log('[push] resumen:', JSON.stringify(summary))
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})
