-- =============================================================================
-- livreur-site — Supabase backend schema (Postgres + Storage)
-- =============================================================================
-- Run this script once in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run (all statements are idempotent).
--
-- Security model:
--   All tables contain operational data (customer phone numbers, addresses,
--   orders, rider pricing/config, Web Push endpoints).
--   RLS is enabled on every table with NO policies for `anon` or `authenticated`
--   and privileges revoked from public roles.
--   Only your backend Pages Functions (`SUPABASE_SECRET_KEY` / `service_role`)
--   can read and write these tables and the private `bons` Storage bucket.
-- =============================================================================

-- 1. Rider live settings (/api/config -> /api/etat, /api/commande, /api/colis)
create table if not exists public.livreur_configs (
  livreur_whatsapp text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint livreur_configs_whatsapp_chk check (livreur_whatsapp ~ '^[0-9]{8,15}$')
);

-- 2. Orders and parcel requests history (/api/commande, /api/colis -> /api/commandes)
create table if not exists public.commandes (
  id text not null,
  livreur_whatsapp text not null,
  type text not null,
  ref text not null,
  statut text not null default 'nouvelle',
  creee timestamptz not null default now(),
  fin timestamptz,
  titre text not null,
  lignes jsonb not null default '[]'::jsonb,
  client_nom text not null,
  client_telephone text not null,
  adresse text not null,
  note text,
  total numeric(10, 3) not null,
  html text,
  primary key (livreur_whatsapp, id),
  constraint commandes_whatsapp_chk check (livreur_whatsapp ~ '^[0-9]{8,15}$'),
  constraint commandes_id_chk check (id ~ '^[0-9]{13}-[A-Z0-9]{6}$'),
  constraint commandes_type_chk check (type in ('repas', 'colis')),
  constraint commandes_statut_chk check (statut in ('nouvelle', 'livree', 'annulee')),
  constraint commandes_total_chk check (total >= 0)
);

-- Latest orders per rider (used by /api/commandes and /api/config#commandes)
create index if not exists commandes_livreur_creee_idx
  on public.commandes (livreur_whatsapp, creee desc, id asc);

-- Active ("en cours") orders per rider
create index if not exists commandes_livreur_en_cours_idx
  on public.commandes (livreur_whatsapp, creee desc)
  where statut = 'nouvelle';

-- 3. Coupon usage tracking (enforces per-coupon usage limits)
create table if not exists public.coupon_usages (
  livreur_whatsapp text not null,
  code text not null,
  commande_ref text not null,
  used_at timestamptz not null default now(),
  primary key (livreur_whatsapp, code, commande_ref),
  constraint coupon_usages_whatsapp_chk check (livreur_whatsapp ~ '^[0-9]{8,15}$')
);

-- 4. Rider Web Push subscriptions (max 5 devices per rider, /api/push)
create table if not exists public.push_subscriptions (
  livreur_whatsapp text not null,
  endpoint text not null,
  updated_at timestamptz not null default now(),
  primary key (livreur_whatsapp, endpoint),
  constraint push_subscriptions_whatsapp_chk check (livreur_whatsapp ~ '^[0-9]{8,15}$')
);

create index if not exists push_subscriptions_livreur_updated_idx
  on public.push_subscriptions (livreur_whatsapp, updated_at desc);

-- =============================================================================
-- Row Level Security & Least-Privilege Grants
-- =============================================================================
alter table public.livreur_configs enable row level security;
alter table public.commandes enable row level security;
alter table public.coupon_usages enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on table
  public.livreur_configs,
  public.commandes,
  public.coupon_usages,
  public.push_subscriptions
from public, anon, authenticated;

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.livreur_configs,
  public.commandes,
  public.coupon_usages,
  public.push_subscriptions
to service_role;

-- =============================================================================
-- Private Storage bucket for restaurant receipt PNGs (/api/bon/<id>)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bons', 'bons', false, 1500000, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =============================================================================
-- Optional: automatic 90-day cleanup of old orders (requires pg_cron extension)
-- Uncomment if you enable pg_cron in Dashboard -> Database -> Extensions:
--
-- select cron.schedule(
--   'purge-commandes-90j',
--   '0 3 * * *',
--   $$delete from public.commandes where creee < now() - interval '90 days';$$
-- );
-- =============================================================================
