# Hacktrack — Activar el backend (auth + sync + push)

Todo el backend es **opt-in por variables de entorno**. Sin ellas, la app corre 100 % local (el beta de hoy, mocks intactos). Este doc es la checklist para encenderlo. Plan completo: `businesses/Hacktrack/Hacktrack - Auth & Backend Handoff.md`.

> **Invariante:** sin `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, `backendEnabled === false` → auth/login/forgot conservan su flujo mock, no se crea cliente Supabase, no se sincroniza, el toggle "Respaldo en la nube" ni aparece. No romper esto.

## 1. Crear el proyecto Supabase
1. Crea un proyecto en https://supabase.com (región cercana a MX).
2. **Project Settings → API:** copia `Project URL` y la `anon public` key.
3. Aplica el esquema: pega `supabase/migrations/0001_init.sql` en el **SQL Editor**, o con CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   Crea `user_state` y `push_subscriptions`, ambas con **RLS** (cada usuario solo ve su fila).
4. **Authentication → Providers:** habilita Email. Configura el correo de reseteo y el **Redirect URL** = `https://bhmxsupport.github.io/hacktrack/`.

## 2. Variables de entorno del cliente
Copia `.env.example` → `.env` y llena:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=        # opcional, solo si activas push (paso 4)
```
Estas se hornean en el bundle (son públicas). Rebuild + deploy con `BASE_PATH=/hacktrack/ npm run build` (ver el deploy de los lotes anteriores). Al desplegar con estas variables, auth/login/forgot pasan a ser **reales** automáticamente.

## 3. Verificar auth (con keys)
- Crear cuenta: correo + contraseña (mín. 6) → `auth.signUp`; errores reales (correo en uso) se muestran.
- Login: credenciales reales; la rama de error ya corre.
- Recuperar: envía enlace real de reseteo (mensaje neutro, no revela qué correos existen).

## 4. Push web (opcional)
1. Genera el par VAPID: `npx web-push generate-vapid-keys`.
2. `VITE_VAPID_PUBLIC_KEY` = la pública (en `.env`). La privada va como **secreto del Edge Function**:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=<pub> VAPID_PRIVATE_KEY=<priv> VAPID_SUBJECT=mailto:soporte@biohackmx.com.mx
   ```
3. Despliega el emisor: `supabase functions deploy push-scheduler` (ver `supabase/functions/push-scheduler/README.md`).
4. Agenda el cron cada 15 min (pg_cron + `net.http_post`, detalle en ese README).
5. **PENDIENTE de SW (bloqueador de entrega real):** el Service Worker actual es el stub `selfDestroying` de `vite-plugin-pwa` (no maneja el evento `push`). Para que el push entrante se muestre con la app cerrada hay que **promover el SW** a `injectManifest` con un listener `push`/`notificationclick`. El cliente ya se suscribe y guarda la `PushSubscription`; falta el handler del SW. (Es el mismo trabajo descrito en el handoff §7.)

## 5. Sync / Respaldo en la nube
- **Listo (seguro):** con sesión + toggle "Respaldo en la nube" ON, el cliente **sube** (debounced) el blob de estado a `user_state` (`useCloudSync` + `pushRemote`).
- **PENDIENTE (hacer con keys):** el **PULL/restore/merge** — traer `user_state` al iniciar sesión y fusionarlo con lo local (LWW por `updated_at`; resolver `id`s). Se dejó fuera para no meter una reescritura de estado no probada en el provider. Primitiva lista: `pullRemote(userId)` en `src/lib/backend/sync.ts`; falta la acción de reducer que aplique el remoto (idealmente antes de que la app sea interactiva, o un botón "Restaurar de la nube").

## 6. Pagos / Hacktrack Plus
**Pospuesto** por decisión de Jan (definir modelo + precio MXN + cuenta MercadoPago). No construido en este scaffold.

## 7. Mapa de archivos del scaffold
| Pieza | Archivo |
|-------|---------|
| Flags de entorno | `src/lib/backend/config.ts` |
| Cliente Supabase (lazy) | `src/lib/backend/supabase.ts` |
| Auth (signUp/signIn/reset/session) | `src/lib/backend/auth.ts` |
| Sync (pull/push blob) | `src/lib/backend/sync.ts` |
| Push (subscribe/unsubscribe) | `src/lib/backend/push.ts` |
| Wiring del provider | `src/lib/backend/useCloudSync.ts` |
| Esquema + RLS | `supabase/migrations/0001_init.sql` |
| Emisor de push | `supabase/functions/push-scheduler/` |
| PIN local (no necesita backend) | `src/lib/pin.ts`, `src/v2/ui/PinGate.tsx`, `src/v2/ui/PinPad.tsx`, `src/v2/screens/PinSetupSheet.tsx` |
| Aviso de Privacidad (página real) | `public/aviso-privacidad.html` → `/hacktrack/aviso-privacidad.html` |

## 8. Legal
- El Aviso de Privacidad ya está como **página servida por la PWA** (URL real) y enlazado desde "Crear cuenta". **Debe revisarlo un abogado** antes de producción (lo dice el propio documento). Falta enlazarlo también desde Welcome y Perfil si se desea (Epic E).
