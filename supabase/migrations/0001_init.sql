-- Hacktrack — esquema inicial del backend (auth + sync + push).
-- Aplicar con: supabase db push   (o pegar en el SQL editor del proyecto Supabase).
-- Auth lo provee Supabase Auth (tabla auth.users). Aquí van solo los datos de la app, todo con RLS:
-- cada usuario SOLO puede ver/escribir sus propias filas.

-- ── user_state: respaldo/sincronización del estado local (blob JSONB, last-write-wins por updated_at) ──
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "user_state self-access" on public.user_state;
create policy "user_state self-access" on public.user_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── push_subscriptions: suscripciones Web Push (una por endpoint) ──
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push self-access" on public.push_subscriptions;
create policy "push self-access" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- Nota: el Edge Function emisor de push (supabase/functions/push-scheduler) usa la SERVICE_ROLE key,
-- que omite RLS, para leer las suscripciones de todos los usuarios y enviar los avisos programados.
