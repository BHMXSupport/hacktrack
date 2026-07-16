# Hacktrack — Activar el backend (auth + sync + push)

Todo el backend es **opt-in por variables de entorno**. Sin ellas, la app corre 100 % local (mocks intactos, sección de nube oculta). Plan completo: `businesses/Hacktrack/Hacktrack - Auth & Backend Handoff.md` (vault).

> **Invariante:** sin `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, `backendEnabled === false` → auth/login conservan su flujo local honesto, no se crea cliente Supabase, no se sincroniza, el toggle "Respaldo en la nube" ni aparece. No romper esto.

> **Estado (2026-07-15):** el scaffold completo está **construido, corregido y probado E2E contra un Supabase local** (auth real, sync push/pull, restauración honesta, RLS aislando usuarios, PIN fuera del blob, borrado ARCO en nube). El Service Worker ya es real (push handler incluido). Lo ÚNICO que falta para encender la nube es una cuenta de Supabase.

## Camino rápido (recomendado): `scripts/activate-cloud.sh`

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...   # de https://supabase.com/dashboard/account/tokens — ÚNICO prerequisito humano
./scripts/activate-cloud.sh
```

El script hace todo: crea (o reutiliza) el proyecto, aplica migraciones, configura `site_url` + redirect URLs de producción (sin esto los links de reseteo rebotan — probado en E2E), sube los secretos VAPID (par pre-generado en `.secrets/vapid.json`, gitignored), despliega `push-scheduler`, genera el SQL de pg_cron (vía Vault, no GUC), escribe `.env`, compila con `BASE_PATH=/hacktrack/` y se detiene imprimiendo los comandos exactos del deploy a gh-pages. Idempotente; cada paso se anuncia.

## Camino manual (referencia)

1. **Proyecto Supabase:** crear en https://supabase.com (región cercana a MX). `Project Settings → API`: copiar `Project URL` y `anon public` key.
2. **Esquema:** `supabase link --project-ref <ref> && supabase db push`. La migración `supabase/migrations/0001_init.sql` crea `user_state` y `push_subscriptions` **con RLS y con los GRANTs base** (sin los GRANTs el sync devuelve 403 — defecto encontrado y corregido en el E2E local del 2026-07-15).
3. **Auth:** habilitar Email. **`site_url` y `additional_redirect_urls` DEBEN incluir `https://bhmxsupport.github.io/hacktrack/`** — GoTrue sobreescribe cualquier `redirect_to` no-whitelisteado con `site_url`, rompiendo los enlaces de reseteo. Para producción real considerar **SMTP propio** (el mailer integrado de Supabase es solo-equipo y con rate limits).
4. **`.env`** (se hornean en el bundle; son públicas):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_VAPID_PUBLIC_KEY=<publicKey de .secrets/vapid.json>
   ```
5. **Push:** `supabase secrets set VAPID_*` (el script convierte el par a JWK y verifica firma), `supabase functions deploy push-scheduler`, y el cron cada 15 min (SQL generado en `.secrets/push-cron.sql`; el service key vive en **Vault**, no como GUC de la base). El SW ya maneja `push`/`notificationclick` (contrato `{title, body, tag, data:{goto}}`).
6. **Rebuild + deploy:** `BASE_PATH=/hacktrack/ npm run build` y publicar `dist/` a gh-pages. Verificar que `/hacktrack/sw.js` vivo ya no es el stub de 608 bytes.

## Verificación con keys (qué esperar)

- Crear cuenta → `auth.signUp` real; errores específicos (correo en uso, credenciales) se muestran (mapAuthError).
- "Respaldo en la nube" ON → sube blob debounced; **"Última copia: {fecha}"** en Ajustes; fallos de push se muestran en rojo y se reintentan con el siguiente cambio.
- "Restaurar de la nube" → restaura con sanitización (entradas inválidas se omiten con aviso); respaldo hueco → mensaje honesto sin tocar lo local; el PIN y las decisiones de consentimiento/localOnly del dispositivo **sobreviven** a la restauración.
- "Eliminar mis datos" (ARCO) → borra también la fila de `user_state` y las suscripciones push en la nube (o avisa honestamente si no pudo).
- `pinHash`/`pinEnabled` **nunca** viajan en el blob (strip en `sync.ts`).

## Gotchas operativos

- **`supabase db reset` NO re-renderiza el env de los contenedores** desde `config.toml` — los cambios de `[auth]` requieren `supabase stop && supabase start`.
- El deploy a gh-pages tiene el gotcha del `index.html` con rsync (mismo tamaño → no se copia): usar `--checksum` o `cp` explícito, y verificar `git show origin/gh-pages:index.html | grep index-….js` antes de esperar el live.

## Mapa de archivos del scaffold

| Pieza | Archivo |
|-------|---------|
| Flags de entorno | `src/lib/backend/config.ts` |
| Cliente Supabase (lazy) | `src/lib/backend/supabase.ts` |
| Auth (signUp/signIn/reset/signOut/session) | `src/lib/backend/auth.ts` |
| Sync (pull/push tipados, strip de PIN, estado de sync, deleteRemote) | `src/lib/backend/sync.ts` |
| Push (subscribe/unsubscribe) | `src/lib/backend/push.ts` |
| Wiring del provider | `src/lib/backend/useCloudSync.ts` |
| Esquema + RLS + GRANTs | `supabase/migrations/0001_init.sql` |
| Emisor de push | `supabase/functions/push-scheduler/` |
| Activación one-command | `scripts/activate-cloud.sh` |
| Par VAPID (gitignored) | `.secrets/vapid.json` |
| SW real (precache + push + rangos iOS) | `src/sw.ts` |
| PIN local | `src/lib/pin.ts`, `src/v2/ui/PinGate.tsx`, `src/v2/screens/PinSetupSheet.tsx` |
| Aviso de Privacidad (página real) | `public/aviso-privacidad.html` → `/hacktrack/aviso-privacidad.html` |

## Pagos / Hacktrack Plus

**Pospuesto** por decisión de Jan (definir modelo + precio MXN + cuenta MercadoPago). El paywall actual es honesto: "en desarrollo — todo gratis durante la beta", sin precios ni checkout. El lanzamiento es gratis (Launch Playbook §4), así que pagos NO bloquean el go-live.

## Legal

- Aviso de Privacidad vivo y enlazado (Account + Perfil), responsable = **Hacktrack** con razón social/domicilio como placeholders **para el abogado**. El banner de borrador se mantiene hasta la revisión legal.
- Consulta COFEPRIS/LFPDPPP antes del lanzamiento público: gate documentado en el vault (decisión de ritmo = Jan).
