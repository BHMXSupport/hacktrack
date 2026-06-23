# push-scheduler — Edge Function de recordatorios Web Push

Envía los recordatorios de dosis (y el resumen diario) de Hacktrack por **Web Push**.
Se invoca por **cron cada 15 minutos**. Para cada usuario con suscripción push, calcula
qué dosis caen en la ventana `[ahora, ahora+15min)` (hora **America/Mexico_City**) y le
manda un push. Usa la **SERVICE_ROLE key** (omite RLS) para leer todas las filas de
`push_subscriptions` y `user_state`.

> **SCAFFOLD:** este código está listo y bien estructurado, pero se prueba en vivo después,
> con las claves VAPID reales. Antes de su primer envío real verifica los TODO de abajo.

---

## Cómo funciona (resumen)

1. Lee **todas** las `push_subscriptions` y las agrupa por `user_id`.
2. Para cada usuario lee su `user_state.data` (blob del estado de la app).
3. Si `settings.remindersEnabled === false` → salta al siguiente.
4. Calcula la hora MX actual (minutos desde medianoche) y la ventana de 15 min.
5. Para cada protocolo **no archivado**: si `diaTocaCadence(hoyMX, cadence, startDate)` y su
   `reminderTime` cae en la ventana → arma un push de dosis.
6. **Resumen diario**: si `settings.dailySummary !== false` y `summaryTime` cae en la ventana
   → un push con la lista de productos de hoy.
7. Envía cada push a **todas** las suscripciones del usuario. Si el push service responde
   **404/410** (gone) → borra esa fila de `push_subscriptions`.
8. Devuelve `{ usersProcessed, pushesSent, removed }` con status 200 (o 500 + `error` si
   falla la config de nivel-lote).

**Robustez:** ningún fallo por usuario o por suscripción aborta el lote; se loggea y se continúa.

---

## Librería de Web Push: `@negrel/webpush` (Deno-nativa)

Se usa **[`@negrel/webpush`](https://jsr.io/@negrel/webpush)** (`jsr:@negrel/webpush`), que
implementa Web Push (RFC 8291) + VAPID (RFC 8292) sobre **Web Crypto + fetch**, sin dependencias
de Node.

### Por qué NO `web-push@3` (la lib del brief)

`web-push@3` (npm) depende de `https.Agent` y del módulo `crypto` de Node, que **no corren de
forma fiable en el isolate de Deno de Supabase Edge Functions**. Importarla con `npm:web-push@3`
suele fallar en runtime al construir el agente HTTPS. Por eso se entregó la versión con la
librería Deno-nativa, que es la práctica recomendada para Edge Functions.

**Plan B (sin librería)** — si en el futuro se quiere quitar la dependencia: firmar el JWT VAPID a
mano con Web Crypto (ES256 sobre la clave privada P-256), cifrar el payload con `aes128gcm`
(http-ece, RFC 8188) y hacer `fetch(endpoint, { method: 'POST', headers: { Authorization, 'Crypto-Key',
TTL, 'Content-Encoding': 'aes128gcm' }, body })`. Es exactamente lo que `@negrel/webpush` hace por
dentro; documentado aquí sólo como alternativa, no es necesario hoy.

---

## Claves VAPID

Necesitas un par de claves VAPID. La **pública** ya la consume el cliente
(`VITE_VAPID_PUBLIC_KEY`, ver `src/lib/backend/config.ts`); la **privada** es secreta y sólo vive
en este Edge Function.

`@negrel/webpush` importa las claves en **formato JWK** (`importVapidKeys`). Genera/convierte así:

```bash
# Genera un par nuevo en JWK con la utilidad de la propia librería:
deno run --allow-all jsr:@negrel/webpush/bin/generate-vapid-keys > vapid.json
# vapid.json = { "publicKey": { ...JWK... }, "privateKey": { ...JWK... } }
```

El cliente espera la pública en **base64url (uncompressed point)**, no JWK. Convierte el JWK
público a base64url (concatena `x` e `y` con prefijo `0x04`) o, más simple, genera el par con
`web-push generate-vapid-keys` y luego importa esos PEM/base64 a JWK una sola vez. Guarda en los
secretos del proyecto los **JWK serializados como JSON string** (es lo que lee `index.ts` con
`JSON.parse`).

---

## Deploy

```bash
# Desde la raíz del repo (con la Supabase CLI logueada y el proyecto enlazado):
supabase functions deploy push-scheduler
```

> La función NO requiere JWT de usuario (la dispara el cron, no un cliente). Si quieres impedir
> invocaciones externas, despliega con verificación de JWT y llama desde pg_cron con la
> `service_role` key, o protege con un header secreto que valides al inicio del handler.

---

## Secretos

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los **inyecta Supabase** automáticamente en el
runtime de la función. Sólo debes setear los de VAPID:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY='{"kty":"EC","crv":"P-256","x":"...","y":"..."}' \
  VAPID_PRIVATE_KEY='{"kty":"EC","crv":"P-256","x":"...","y":"...","d":"..."}' \
  VAPID_SUBJECT='mailto:soporte@biohackmx.com.mx'
```

> Las claves van como **JSON string del JWK** (el código hace `JSON.parse`). Cuida el escaping de
> comillas en tu shell; en CI usa un archivo `--env-file` o el dashboard de Supabase
> (Project Settings → Edge Functions → Secrets).

---

## Cron cada 15 minutos

### Opción A — pg_cron + `net.http_post` (recomendada)

En el SQL editor del proyecto (requiere las extensiones `pg_cron` y `pg_net`, disponibles en
Supabase):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Agenda: cada 15 minutos, invoca el Edge Function.
select cron.schedule(
  'push-scheduler-every-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-scheduler',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Guarda la `service_role` key como setting de la base (una sola vez) para no exponerla en el
job, o pégala inline si prefieres:

```sql
alter database postgres set app.service_role_key = '<SERVICE_ROLE_KEY>';
```

Para desagendar:

```sql
select cron.unschedule('push-scheduler-every-15m');
```

### Opción B — Scheduler de Supabase (dashboard)

Project → Edge Functions → tu función → **Schedules** → crea uno con cron `*/15 * * * *`. El
dashboard maneja la autenticación por ti.

---

## Verificación manual

```bash
# Invoca una vez y revisa el JSON resumen:
curl -i -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/push-scheduler' \
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' -d '{}'
# → { "usersProcessed": N, "pushesSent": M, "removed": K }

# Logs en vivo:
supabase functions logs push-scheduler
```

---

## Contrato con el Service Worker (cliente)

El payload del push lo enruta el SW del cliente por **`tag`** (`public/sw.js`):

| Tag                          | Destino (`goto`)        |
|------------------------------|-------------------------|
| `hacktrack-dose-<producto>`  | `registrar:<producto>`  |
| `hacktrack-daily-summary`    | `tab:semana`            |

El payload también incluye `data.goto` (forward-compatible). **Pendiente de cliente:** el SW de
hoy maneja `message`/`notificationclick` pero **aún no tiene un listener del evento `push`** que
lea este payload y llame a `showNotification`. Sin ese listener, la suscripción se guarda pero el
push entrante no se muestra (ver nota en `src/lib/backend/push.ts`). Promover el SW para manejar
`push` es prerequisito de la prueba en vivo.

Copys finales: los títulos van **sin la palabra "Hacktrack"** ("Hora de tu …", "Tu plan de hoy").

---

## TODOs / Limitaciones conocidas

- **Zona horaria fija (`America/Mexico_City`).** No guardamos la tz por usuario, así que la
  función interpreta `reminderTime`/`summaryTime` y "hoy" en hora MX para todos.
  **A futuro:** persistir la tz del usuario (en `user_state.data.settings` o columna propia) y
  usarla aquí en lugar de la constante `TZ`.
- **De-duplicación de "ya registrado".** Desde el servidor **no** tenemos forma fiable de saber si
  el usuario ya marcó la dosis de hoy → el push se envía igual. El cliente de-duplica visualmente
  por `tag` (un push con el mismo tag reemplaza la notificación previa, no apila). **A futuro:** si
  el estado sincronizado incluyera los registros del día, se podría omitir el push de dosis ya
  marcadas.
- **`secondReminderMin` aún no se usa.** El segundo recordatorio (re-aviso si no se marcó) vive hoy
  en el cliente; portarlo aquí requeriría saber el estado de registro (mismo bloqueo que el punto
  anterior).
- **Cadencia `'uso'`** → sin recordatorio programado (por diseño, `diaTocaCadence` devuelve false).
- **Ventana = 15 min** asume que el cron corre cada 15 min sin solaparse ni saltarse. Si cambias la
  frecuencia del cron, ajusta `WINDOW_MIN` en `index.ts` para que coincida y no dupliques/pierdas
  avisos.
