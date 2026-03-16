-- ================================================================
-- AURELYS — Schéma de base de données Supabase
-- Exécuter dans : Supabase Dashboard > SQL Editor
-- ================================================================

-- Extension UUID (si non activée)
create extension if not exists "uuid-ossp";


-- ================================================================
-- TABLE : properties
-- ================================================================

create table if not exists public.properties (
  id                text         primary key,
  slug              text         unique not null,
  title             text         not null,
  subtitle          text,
  description       text,
  short_description text,

  -- Localisation
  city              text,
  country           text,
  address           text,
  area              text,
  lat               double precision,
  lng               double precision,

  -- Tarification
  price_per_night   integer      default 0,
  cleaning_fee      integer      default 0,
  currency          text         default 'EUR',
  minimum_stay      integer      default 1,

  -- Capacité
  guests            integer      default 2,
  bedrooms          integer      default 1,
  beds              integer      default 1,
  bathrooms         integer      default 1,

  -- Médias
  cover_image       text,
  gallery           jsonb        default '[]'::jsonb,

  -- Contenu
  amenities         jsonb        default '[]'::jsonb,
  rules             jsonb        default '[]'::jsonb,
  check_in          text         default '15h00',
  check_out         text         default '11h00',
  badges            jsonb        default '[]'::jsonb,

  -- Statut
  featured          boolean      default false,
  available         boolean      default true,

  -- Contact / Paiement
  payment_link      text,
  contact_email     text,
  formspree_id      text,

  -- SEO
  seo_title         text,
  seo_description   text,

  -- Ordre d'affichage
  sort_order        integer      default 0,

  created_at        timestamptz  default now(),
  updated_at        timestamptz  default now()
);


-- ================================================================
-- TABLE : upcoming_properties
-- ================================================================

create table if not exists public.upcoming_properties (
  id            text         primary key,
  slug          text,
  title         text         not null,
  subtitle      text,
  description   text,
  city          text,
  country       text,
  lat           double precision,
  lng           double precision,
  expected_date text,
  cover_image   text,
  sort_order    integer      default 0,
  created_at    timestamptz  default now()
);


-- ================================================================
-- TABLE : site_settings (ligne unique id='global')
-- Stocke l'intégralité du contenu éditorial en JSONB
-- ================================================================

create table if not exists public.site_settings (
  id          text         primary key default 'global',
  settings    jsonb        default '{}'::jsonb,
  updated_at  timestamptz  default now()
);


-- ================================================================
-- TABLE : reservations
-- ================================================================

create table if not exists public.reservations (
  id              text         primary key default replace(gen_random_uuid()::text, '-', ''),
  property_id     text         references public.properties(id) on delete set null,
  property_title  text,        -- dénormalisé pour affichage
  guest_name      text,
  guest_email     text         not null,
  guest_phone     text,
  check_in        date         not null,
  check_out       date         not null,
  guests          integer      default 1,
  nights          integer      default 1,
  total_price     integer      default 0,
  cleaning_fee    integer      default 0,
  currency        text         default 'EUR',
  status          text         default 'pending',    -- pending | confirmed | cancelled
  payment_status  text         default 'unpaid',     -- unpaid | paid | refunded
  payment_link    text,
  message         text,
  created_at      timestamptz  default now()
);


-- ================================================================
-- TABLE : availability_blocks
-- ================================================================

create table if not exists public.availability_blocks (
  id            text         primary key default replace(gen_random_uuid()::text, '-', ''),
  property_id   text         not null references public.properties(id) on delete cascade,
  date          date         not null,
  type          text         default 'blocked',     -- blocked | reservation
  reservation_id text,
  note          text,
  unique (property_id, date)
);


-- ================================================================
-- TABLE : newsletter_subscribers
-- ================================================================

create table if not exists public.newsletter_subscribers (
  id            text         primary key default replace(gen_random_uuid()::text, '-', ''),
  email         text         unique not null,
  subscribed_at timestamptz  default now(),
  active        boolean      default true
);


-- ================================================================
-- TABLE : legal_pages
-- ================================================================

create table if not exists public.legal_pages (
  slug        text         primary key,   -- cgv | privacy | mentions | cancellation
  title       text,
  content     text,
  updated_at  timestamptz  default now()
);


-- ================================================================
-- TABLE : faq_items
-- ================================================================

create table if not exists public.faq_items (
  id          text         primary key,
  question    text         not null,
  answer      text         not null,
  sort_order  integer      default 0
);


-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

alter table public.properties            enable row level security;
alter table public.upcoming_properties   enable row level security;
alter table public.site_settings         enable row level security;
alter table public.reservations          enable row level security;
alter table public.availability_blocks   enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.legal_pages           enable row level security;
alter table public.faq_items             enable row level security;


-- ── Lecture publique (site public) ─────────────────────────────

create policy "Public: select properties"
  on public.properties for select using (true);

create policy "Public: select upcoming"
  on public.upcoming_properties for select using (true);

create policy "Public: select settings"
  on public.site_settings for select using (true);

create policy "Public: select availability"
  on public.availability_blocks for select using (true);

create policy "Public: select legal"
  on public.legal_pages for select using (true);

create policy "Public: select faq"
  on public.faq_items for select using (true);

create policy "Public: select reservations count"
  on public.reservations for select using (auth.uid() is not null);


-- ── Écriture authentifiée (admin uniquement) ───────────────────

create policy "Auth: all on properties"
  on public.properties for all using (auth.uid() is not null);

create policy "Auth: all on upcoming"
  on public.upcoming_properties for all using (auth.uid() is not null);

create policy "Auth: all on settings"
  on public.site_settings for all using (auth.uid() is not null);

create policy "Auth: all on reservations"
  on public.reservations for all using (auth.uid() is not null);

create policy "Auth: all on availability"
  on public.availability_blocks for all using (auth.uid() is not null);

create policy "Auth: all on subscribers"
  on public.newsletter_subscribers for all using (auth.uid() is not null);

create policy "Auth: all on legal"
  on public.legal_pages for all using (auth.uid() is not null);

create policy "Auth: all on faq"
  on public.faq_items for all using (auth.uid() is not null);


-- ── Insertions publiques (formulaires visitors) ────────────────

-- Les visiteurs peuvent s'inscrire à la newsletter
create policy "Public: insert subscribers"
  on public.newsletter_subscribers for insert with check (true);

-- Les visiteurs peuvent créer une pré-réservation
create policy "Public: insert reservations"
  on public.reservations for insert with check (true);


-- ================================================================
-- TRIGGER : updated_at automatique sur properties
-- ================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create trigger trg_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

create trigger trg_legal_updated_at
  before update on public.legal_pages
  for each row execute function public.set_updated_at();
