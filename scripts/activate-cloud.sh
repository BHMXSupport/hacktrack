#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# activate-cloud.sh — activación de la nube de Hacktrack en UN comando.
#
# De cero a nube viva: crea (o enlaza) el proyecto Supabase, aplica migraciones,
# configura los redirects de Auth, sube los secretos VAPID, despliega el Edge
# Function push-scheduler, genera el SQL de pg_cron, escribe .env y compila el
# bundle de producción. El deploy a gh-pages queda MANUAL a propósito (se
# imprimen los comandos exactos al final).
#
# ── ÚNICO PREREQUISITO HUMANO ──────────────────────────────────────────────────
#   Un access token de Supabase (login en el dashboard → Account → Access Tokens
#   → "Generate new token"):
#
#     SUPABASE_ACCESS_TOKEN=sbp_xxx ./scripts/activate-cloud.sh
#
# ── Variables opcionales ───────────────────────────────────────────────────────
#   SUPABASE_PROJECT_REF   Enlazar a un proyecto EXISTENTE en vez de crear uno.
#   SUPABASE_ORG_ID        Org donde crear el proyecto (si tienes más de una).
#   SUPABASE_REGION        Región del proyecto nuevo (default: us-east-1).
#   SUPABASE_DB_PASSWORD   Password de la BD (proyectos existentes; los nuevos
#                          generan una y la guardan en .secrets/).
#   PROJECT_NAME           Nombre del proyecto nuevo (default: hacktrack).
#
# ── Nota sobre la config de Auth (verificado con CLI 2.109.1) ─────────────────
#   NO usamos `supabase config push`: empuja el config.toml COMPLETO, cuyo
#   [auth].site_url es el origen LOCAL de dev (localhost:5173) — clobbearía la
#   config de producción. En su lugar parcheamos solo lo necesario vía
#   Management API: PATCH /v1/projects/{ref}/config/auth con site_url +
#   uri_allow_list (equivalente remoto de additional_redirect_urls). La E2E
#   local probó que un redirect_to fuera de la allow-list se SUSTITUYE por el
#   site_url y rompe el link de reset — por eso este paso no es opcional.
#
# Idempotente: reejecutar es seguro (reusa el proyecto por nombre/ref, upsertea
# secretos/config/función; db push solo aplica migraciones nuevas).
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Constantes del producto ────────────────────────────────────────────────────
PROD_URL="https://bhmxsupport.github.io/hacktrack/"
VAPID_SUBJECT="mailto:soporte@biohackmx.com.mx"
PROJECT_NAME="${PROJECT_NAME:-hacktrack}"
REGION="${SUPABASE_REGION:-us-east-1}"
API="https://api.supabase.com/v1"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
VAPID_FILE="$REPO_ROOT/.secrets/vapid.json"

step() { printf '\n\033[1;36m══ %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

mapi() { # mapi METHOD PATH [JSON_BODY] — llamada a la Management API
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -f -X "$method" "$API$path" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" -d "$body"
  else
    curl -sS -f -X "$method" "$API$path" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
  fi
}

# ── 0. Preflight ───────────────────────────────────────────────────────────────
step "0/9 Preflight"
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || die "Falta SUPABASE_ACCESS_TOKEN (dashboard → Account → Access Tokens). Es el ÚNICO paso humano."
command -v node >/dev/null || die "Falta node."
command -v curl >/dev/null || die "Falta curl."
command -v jq   >/dev/null || die "Falta jq (brew install jq)."
command -v npx  >/dev/null || die "Falta npx (npm)."
[ -f "$VAPID_FILE" ] || die "Falta $VAPID_FILE ({\"publicKey\":\"base64url\",\"privateKey\":\"base64url\"})."
[ -f "$REPO_ROOT/supabase/migrations/0001_init.sql" ] || die "No encuentro las migraciones (¿repo correcto?)."
export SUPABASE_ACCESS_TOKEN
info "CLI: $(npx supabase --version 2>/dev/null || echo '?') · repo: $REPO_ROOT"

# ── 1. Proyecto: reusar por ref, reusar por nombre, o crear ───────────────────
step "1/9 Proyecto Supabase"
REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$REF" ]; then
  REF="$(mapi GET /projects | jq -r --arg n "$PROJECT_NAME" '[.[] | select(.name == $n)][0].id // empty')"
  [ -n "$REF" ] && info "Proyecto existente '$PROJECT_NAME' encontrado → ref $REF (idempotencia)."
fi
if [ -z "$REF" ]; then
  if [ -z "${SUPABASE_ORG_ID:-}" ]; then
    ORGS_JSON="$(mapi GET /organizations)"
    ORG_COUNT="$(jq 'length' <<<"$ORGS_JSON")"
    if [ "$ORG_COUNT" -eq 1 ]; then
      SUPABASE_ORG_ID="$(jq -r '.[0].id' <<<"$ORGS_JSON")"
      info "Única organización: $(jq -r '.[0].name' <<<"$ORGS_JSON") ($SUPABASE_ORG_ID)"
    else
      jq -r '.[] | "   - \(.id)  \(.name)"' <<<"$ORGS_JSON"
      die "Varias organizaciones — reejecuta con SUPABASE_ORG_ID=<id>."
    fi
  fi
  DB_PASS="${SUPABASE_DB_PASSWORD:-$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)}"
  info "Creando proyecto '$PROJECT_NAME' en $REGION…"
  REF="$(mapi POST /projects "$(jq -n --arg n "$PROJECT_NAME" --arg o "$SUPABASE_ORG_ID" --arg r "$REGION" --arg p "$DB_PASS" \
        '{name:$n, organization_id:$o, region:$r, db_pass:$p}')" | jq -r '.id')"
  [ -n "$REF" ] && [ "$REF" != "null" ] || die "La creación del proyecto no devolvió ref."
  umask 077 && printf '%s\n' "$DB_PASS" > "$REPO_ROOT/.secrets/supabase-db-password" && umask 022
  export SUPABASE_DB_PASSWORD="$DB_PASS"
  info "Creado: $REF · password de BD guardada en .secrets/supabase-db-password (gitignored)."
fi
PROJECT_URL="https://$REF.supabase.co"
info "Proyecto: $PROJECT_URL"

# ── 2. Esperar a que el proyecto esté sano ────────────────────────────────────
step "2/9 Esperando estado ACTIVE_HEALTHY"
for i in $(seq 1 60); do
  STATUS="$(mapi GET "/projects/$REF" | jq -r '.status')"
  [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
  info "($i/60) estado: $STATUS — reintento en 10s…"
  sleep 10
done
[ "$STATUS" = "ACTIVE_HEALTHY" ] || die "El proyecto no llegó a ACTIVE_HEALTHY (último: $STATUS)."
info "Proyecto sano."

# ── 3. Enlazar el repo + aplicar migraciones ──────────────────────────────────
step "3/9 supabase link + db push (migraciones)"
if [ -f "$REPO_ROOT/.secrets/supabase-db-password" ] && [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  SUPABASE_DB_PASSWORD="$(cat "$REPO_ROOT/.secrets/supabase-db-password")"
  export SUPABASE_DB_PASSWORD
fi
[ -n "${SUPABASE_DB_PASSWORD:-}" ] || info "AVISO: sin SUPABASE_DB_PASSWORD — link/db push la pedirán interactivamente."
npx supabase link --project-ref "$REF"
npx supabase db push
info "Migraciones aplicadas (user_state + push_subscriptions con RLS y GRANTs)."

# ── 4. Config de Auth: site_url + allow-list de redirects (Management API) ────
step "4/9 Auth: site_url + redirect allow-list → $PROD_URL"
mapi PATCH "/projects/$REF/config/auth" "$(jq -n --arg s "$PROD_URL" \
  '{site_url:$s, uri_allow_list:($s + "," + $s + "*")}')" >/dev/null
info "site_url=$PROD_URL · uri_allow_list=$PROD_URL,$PROD_URL*"
info "Nota: el SMTP integrado de Supabase solo manda correos al equipo del proyecto y con rate-limit"
info "bajo — para reset de contraseña a usuarios reales configura SMTP propio (Auth → SMTP) después."

# ── 5. Secretos VAPID del Edge Function ───────────────────────────────────────
step "5/9 Secretos VAPID (conversión base64url → JWK)"
# .secrets/vapid.json guarda el par en base64url (formato del cliente); el Edge Function
# los espera como JWK JSON (webpush.importVapidKeys). Convertimos aquí: el punto público
# sin comprimir (0x04‖X‖Y) se parte en x/y, la privada es el escalar d.
VAPID_JWKS="$(node -e '
  const fs = require("fs");
  const v = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const pub = Buffer.from(v.publicKey, "base64url");
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("publicKey no es un punto P-256 sin comprimir");
  const b64u = (b) => Buffer.from(b).toString("base64url");
  const x = b64u(pub.subarray(1, 33)), y = b64u(pub.subarray(33, 65));
  const out = {
    pub:  { kty: "EC", crv: "P-256", x, y },
    priv: { kty: "EC", crv: "P-256", x, y, d: v.privateKey },
  };
  // Round-trip de firma: prueba que la privada corresponde al punto público antes de subir nada.
  const crypto = require("crypto");
  const priv = crypto.createPrivateKey({ key: out.priv, format: "jwk" });
  const pubk = crypto.createPublicKey({ key: out.pub, format: "jwk" });
  const sig = crypto.sign("sha256", Buffer.from("probe"), { key: priv, dsaEncoding: "ieee-p1363" });
  if (!crypto.verify("sha256", Buffer.from("probe"), { key: pubk, dsaEncoding: "ieee-p1363" }, sig))
    throw new Error("el par VAPID no es consistente (privada ≠ pública)");
  console.log(JSON.stringify(out));
' "$VAPID_FILE")"
VAPID_PUB_JWK="$(jq -c '.pub' <<<"$VAPID_JWKS")"
VAPID_PRIV_JWK="$(jq -c '.priv' <<<"$VAPID_JWKS")"
npx supabase secrets set --project-ref "$REF" \
  "VAPID_PUBLIC_KEY=$VAPID_PUB_JWK" \
  "VAPID_PRIVATE_KEY=$VAPID_PRIV_JWK" \
  "VAPID_SUBJECT=$VAPID_SUBJECT"
info "Secretos VAPID subidos (par verificado con firma de prueba)."

# ── 6. Desplegar el Edge Function ─────────────────────────────────────────────
step "6/9 Deploy de functions/push-scheduler"
npx supabase functions deploy push-scheduler --project-ref "$REF"
info "Función desplegada: $PROJECT_URL/functions/v1/push-scheduler"

# ── 7. pg_cron: generar el SQL (aplicación manual en el SQL editor) ───────────
step "7/9 SQL de pg_cron (cada 15 min)"
KEYS_JSON="$(npx supabase projects api-keys --project-ref "$REF" --reveal -o json 2>/dev/null || npx supabase projects api-keys --project-ref "$REF" -o json)"
ANON_KEY="$(jq -r '([.[] | select(.name == "anon")][0].api_key) // ([.[] | select(.type == "publishable")][0].api_key) // empty' <<<"$KEYS_JSON")"
SERVICE_KEY="$(jq -r '([.[] | select(.name == "service_role")][0].api_key) // empty' <<<"$KEYS_JSON")"
[ -n "$ANON_KEY" ] || die "No pude extraer la anon/publishable key de 'projects api-keys'."
CRON_SQL="$REPO_ROOT/.secrets/push-cron.sql"
umask 077
cat > "$CRON_SQL" <<SQL
-- pg_cron para push-scheduler (generado por activate-cloud.sh — contiene la service key, NO commitear).
-- Pegar en el SQL editor: https://supabase.com/dashboard/project/$REF/sql/new
create extension if not exists pg_cron;
create extension if not exists pg_net;

alter database postgres set app.service_role_key = '${SERVICE_KEY:-<PEGA_AQUI_LA_SERVICE_ROLE_KEY>}';

select cron.schedule(
  'push-scheduler-every-15m',
  '*/15 * * * *',
  \$\$
  select net.http_post(
    url     := '$PROJECT_URL/functions/v1/push-scheduler',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  \$\$
);
SQL
umask 022
info "SQL generado en .secrets/push-cron.sql (gitignored)."
info "La CLI 2.109.1 no expone la conexión pooleada para psql directo → aplícalo a mano:"
info "  → abre https://supabase.com/dashboard/project/$REF/sql/new y pega el contenido del archivo."
[ -n "$SERVICE_KEY" ] || info "  AVISO: no encontré service_role key (proyecto solo con sb_secret) — edita el placeholder del SQL."

# ── 8. Escribir .env del cliente ──────────────────────────────────────────────
step "8/9 .env del cliente"
VAPID_PUBLIC_B64="$(jq -r '.publicKey' "$VAPID_FILE")"
if [ -f "$REPO_ROOT/.env" ]; then
  cp "$REPO_ROOT/.env" "$REPO_ROOT/.env.backup-$(date +%Y%m%d%H%M%S)"
  info "Respaldé el .env anterior."
fi
cat > "$REPO_ROOT/.env" <<ENV
# Generado por scripts/activate-cloud.sh — $(date '+%Y-%m-%d %H:%M')
# Claves PÚBLICAS (van horneadas en el bundle), pero NO commitear este archivo.
VITE_SUPABASE_URL=$PROJECT_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC_B64
ENV
info ".env escrito (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_VAPID_PUBLIC_KEY)."
grep -qxF '.env' "$REPO_ROOT/.gitignore" 2>/dev/null || \
  info "AVISO: .env NO está en .gitignore (solo *.local) — no lo agregues a git."

# ── 9. Build de producción ────────────────────────────────────────────────────
step "9/9 Build de producción (BASE_PATH=/hacktrack/)"
BASE_PATH=/hacktrack/ npm run build
info "dist/ listo con el backend activado."

# ── STOP: el deploy queda manual ──────────────────────────────────────────────
cat <<FIN

════════════════════════════════════════════════════════════════════════════════
NUBE ACTIVADA — el deploy a gh-pages es MANUAL (último control humano):

  1) Publicar dist/ en gh-pages:
       git worktree add ../hacktrack-ghpages gh-pages
       find ../hacktrack-ghpages -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
       cp -R dist/. ../hacktrack-ghpages/
       (cd ../hacktrack-ghpages && git add -A && git commit -m 'Deploy: activación de nube' && git push origin gh-pages)
       git worktree remove ../hacktrack-ghpages

  2) Agendar el cron (una vez):
       pega .secrets/push-cron.sql en https://supabase.com/dashboard/project/$REF/sql/new

  3) Smoke test del Edge Function:
       curl -i -X POST '$PROJECT_URL/functions/v1/push-scheduler' \\
         -H "Authorization: Bearer \$(jq -r '.[]|select(.name==\"service_role\").api_key' <<<'<projects api-keys -o json>')" \\
         -H 'Content-Type: application/json' -d '{}'
       → espera {"usersProcessed":N,"pushesSent":M,"removed":K}

  4) Prueba en vivo: $PROD_URL → crear cuenta → Ajustes → Nube → activar respaldo →
     "Última copia" debe aparecer; luego "Restaurar de la nube" en otro navegador.

  Pendientes conocidos: SMTP propio para correos de reset a usuarios reales;
  revisión del Aviso de Privacidad para la era nube (ver eval).
════════════════════════════════════════════════════════════════════════════════
FIN
