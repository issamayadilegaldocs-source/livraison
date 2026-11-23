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
  constraint commandes_statut_chk check (statut in ('nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee')),
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


-- =============================================================================
-- Accounts, Cumulative CRM, Rider Management, Live Restaurants & Campaigns
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'client',
  nom text not null default '',
  telephone text,
  adresse text,
  position jsonb,
  marketing_opt_in boolean not null default true,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_chk check (role in ('client', 'livreur', 'admin'))
);

create table if not exists public.livreurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nom text not null,
  telephone text not null unique,
  email text,
  ville text not null default 'Sfax',
  vehicule text,
  actif boolean not null default true,
  disponible boolean not null default true,
  commission_type text not null default 'fixe',
  commission_valeur numeric(10, 3) not null default 1.000,
  last_lat double precision,
  last_lng double precision,
  last_seen_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint livreurs_telephone_chk check (telephone ~ '^[0-9]{8,15}$'),
  constraint livreurs_commission_type_chk check (commission_type in ('fixe', 'pourcent')),
  constraint livreurs_commission_val_chk check (commission_valeur >= 0)
);

create table if not exists public.clients_crm (
  id uuid primary key default gen_random_uuid(),
  telephone text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  nom text not null,
  email text,
  derniere_adresse text,
  derniere_position jsonb,
  nb_commandes integer not null default 0,
  total_depense numeric(12, 3) not null default 0,
  premiere_commande_at timestamptz,
  derniere_commande_at timestamptz,
  marketing_email boolean not null default true,
  marketing_whatsapp boolean not null default true,
  notes_admin text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_crm_tel_chk check (telephone ~ '^[0-9]{8,15}$'),
  constraint clients_crm_nb_chk check (nb_commandes >= 0),
  constraint clients_crm_total_chk check (total_depense >= 0)
);

alter table public.commandes
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists client_email text,
  add column if not exists resto_slug text,
  add column if not exists livreur_id uuid references public.livreurs(id) on delete set null,
  add column if not exists livreur_nom text,
  add column if not exists statut_updated_at timestamptz not null default now(),
  add column if not exists historique_statuts jsonb not null default '[]'::jsonb,
  add column if not exists part_admin numeric(10, 3) not null default 0,
  add column if not exists regle_admin boolean not null default false,
  add column if not exists regle_admin_at timestamptz,
  add column if not exists resto_telephone text,
  add column if not exists resto_notifie_at timestamptz;

create table if not exists public.restaurants_gestion (
  slug text primary key,
  source text not null default 'override',
  actif boolean not null default true,
  nom text,
  adresse text,
  telephone text,
  email text,
  cuisines text[],
  type_commerce text,
  image text,
  delai text,
  horaires jsonb,
  position jsonb,
  plats_overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_gestion_slug_chk check (slug ~ '^[a-z0-9-]{1,120}$'),
  constraint restaurants_gestion_source_chk check (source in ('override', 'custom'))
);

create table if not exists public.campagnes_notifications (
  id uuid primary key default gen_random_uuid(),
  canal text not null,
  sujet text,
  message text not null,
  nb_destinataires integer not null default 0,
  nb_envoyes integer not null default 0,
  cree_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint campagnes_canal_chk check (canal in ('email', 'whatsapp')),
  constraint campagnes_nb_chk check (nb_destinataires >= 0 and nb_envoyes >= 0)
);

alter table public.profiles enable row level security;
alter table public.livreurs enable row level security;
alter table public.clients_crm enable row level security;
alter table public.restaurants_gestion enable row level security;
alter table public.campagnes_notifications enable row level security;

revoke all on table
  public.profiles,
  public.livreurs,
  public.clients_crm,
  public.restaurants_gestion,
  public.campagnes_notifications
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.livreurs,
  public.clients_crm,
  public.restaurants_gestion,
  public.campagnes_notifications
to service_role;

-- ============================================================================
-- Fonctionnalités Application (Avis, Chat commande, Support, Parrainage)
-- ============================================================================

alter table public.profiles
  add column if not exists code_parrainage text unique,
  add column if not exists credit_parrainage numeric(10,3) not null default 0,
  add column if not exists parraine_par uuid references public.profiles(id) on delete set null;

create table if not exists public.avis_restaurants (
  id uuid primary key default gen_random_uuid(),
  resto_slug text not null,
  resto_nom text not null,
  commande_id text,
  user_id uuid references public.profiles(id) on delete set null,
  client_nom text not null,
  note smallint not null check (note >= 1 and note <= 5),
  commentaire text,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists avis_restaurants_slug_idx on public.avis_restaurants(resto_slug, created_at desc);
alter table public.avis_restaurants enable row level security;

create table if not exists public.chat_commandes (
  id uuid primary key default gen_random_uuid(),
  commande_id text not null,
  sender_role text not null check (sender_role in ('client','livreur','admin')),
  sender_nom text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_commandes_cmd_idx on public.chat_commandes(commande_id, created_at asc);
alter table public.chat_commandes enable row level security;

create table if not exists public.tickets_support (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  client_nom text not null,
  client_email text,
  client_telephone text,
  commande_ref text,
  categorie text not null default 'order related' check (categorie in ('order related','others')),
  titre text not null,
  statut text not null default 'ouvert' check (statut in ('ouvert','en_cours','resolu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_support_user_idx on public.tickets_support(user_id, updated_at desc);
create index if not exists tickets_support_statut_idx on public.tickets_support(statut, updated_at desc);
alter table public.tickets_support enable row level security;

create table if not exists public.tickets_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets_support(id) on delete cascade,
  sender_role text not null check (sender_role in ('client','admin')),
  sender_nom text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists tickets_messages_ticket_idx on public.tickets_messages(ticket_id, created_at asc);
alter table public.tickets_messages enable row level security;

create table if not exists public.parrainages (
  id uuid primary key default gen_random_uuid(),
  parrain_user_id uuid not null references public.profiles(id) on delete cascade,
  filleul_user_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null,
  montant_parrain numeric(10,3) not null default 3,
  montant_filleul numeric(10,3) not null default 3,
  created_at timestamptz not null default now()
);
create index if not exists parrainages_parrain_idx on public.parrainages(parrain_user_id, created_at desc);
alter table public.parrainages enable row level security;
