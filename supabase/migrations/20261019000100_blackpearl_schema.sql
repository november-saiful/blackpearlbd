-- BlackPearl core schema
-- One Postgres database, two sites, shared auth, catalog rows scoped by site_id.

create extension if not exists pg_trgm;

/* -------------------------------------------------------------------------- */
/* Sites and profiles                                                         */
/* -------------------------------------------------------------------------- */

create table if not exists public.sites (
  id text primary key,
  name text not null,
  hostname text not null unique,
  currency text not null check (currency in ('BDT', 'USD')),
  locale text not null default 'en',
  timezone text not null default 'Asia/Dhaka',
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'traveler' check (role in ('traveler', 'admin')),
  total_pearls integer not null default 0 check (total_pearls >= 0),
  home_site_id text references public.sites(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Live databases (migrations 001-019) already have a profiles table without
-- these redesign columns. Add them when missing so the grants below work on
-- both fresh and live databases.
alter table public.profiles add column if not exists total_pearls integer not null default 0 check (total_pearls >= 0);
alter table public.profiles add column if not exists home_site_id text references public.sites(id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Live databases keep a NOT NULL email column on profiles; fresh databases
  -- follow the redesign without it. Branch so signups keep working on both.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) then
    insert into public.profiles (id, full_name, email, avatar_url)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email, new.raw_user_meta_data ->> 'avatar_url')
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(id) on delete cascade,
  slug text not null,
  title text not null,
  subtitle text not null default '',
  summary text not null default '',
  description text not null default '',
  destination text not null,
  country text not null,
  category text not null,
  duration_days integer not null check (duration_days > 0),
  duration_nights integer not null default 0 check (duration_nights >= 0),
  price_minor bigint not null check (price_minor >= 0),
  compare_at_minor bigint check (compare_at_minor is null or compare_at_minor >= 0),
  currency text not null check (currency in ('BDT', 'USD')),
  hero_image text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  rating numeric(2,1) not null default 0,
  review_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create index if not exists deals_site_status_idx
  on public.deals (site_id, status, featured desc, created_at desc);

create index if not exists deals_search_idx
  on public.deals using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(destination, '') || ' ' || coalesce(summary, ''))
  );

create index if not exists deals_title_trgm_idx
  on public.deals using gin (title gin_trgm_ops);

create table if not exists public.deal_departures (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  capacity integer not null check (capacity > 0),
  seats_taken integer not null default 0 check (seats_taken >= 0),
  price_minor bigint check (price_minor is null or price_minor >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'sold_out', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (deal_id, start_date),
  check (end_date >= start_date),
  check (seats_taken <= capacity)
);

create index if not exists deal_departures_deal_idx on public.deal_departures (deal_id, start_date);

create table if not exists public.deal_itineraries (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text not null,
  description text not null default '',
  image_url text,
  unique (deal_id, day_number)
);

create table if not exists public.deal_stops (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  sort_order integer not null check (sort_order > 0),
  name text not null,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  note text,
  unique (deal_id, sort_order)
);

/* -------------------------------------------------------------------------- */
/* Requests, bookings, money                                                  */
/* -------------------------------------------------------------------------- */

create table if not exists public.custom_packages (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  destination text not null,
  start_date date not null,
  end_date date not null,
  travellers integer not null check (travellers between 1 and 20),
  accommodation_tier text not null default 'comfort'
    check (accommodation_tier in ('essential', 'comfort', 'signature')),
  transport_mode text not null default 'private'
    check (transport_mode in ('shared', 'private', 'flight')),
  activities text[] not null default '{}',
  budget_minor bigint not null default 0 check (budget_minor >= 0),
  currency text not null check (currency in ('BDT', 'USD')),
  special_requests text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'quoted', 'booked', 'declined')),
  admin_notes text,
  quoted_total_minor bigint check (quoted_total_minor is null or quoted_total_minor >= 0),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- Live databases already have custom_packages without the redesign columns.
-- Add them when missing so the index below and the RLS policies work on both
-- fresh and live databases.
alter table public.custom_packages add column if not exists site_id text references public.sites(id) on delete cascade;
alter table public.custom_packages add column if not exists guest_name text;
alter table public.custom_packages add column if not exists guest_email text;
alter table public.custom_packages add column if not exists guest_phone text;
alter table public.custom_packages add column if not exists destination text;
alter table public.custom_packages add column if not exists start_date date;
alter table public.custom_packages add column if not exists end_date date;
alter table public.custom_packages add column if not exists travellers integer;
alter table public.custom_packages add column if not exists accommodation_tier text;
alter table public.custom_packages add column if not exists transport_mode text;
alter table public.custom_packages add column if not exists budget_minor bigint;
alter table public.custom_packages add column if not exists currency text;
alter table public.custom_packages add column if not exists quoted_total_minor bigint;
alter table public.custom_packages add column if not exists replied_at timestamptz;

-- Live databases store activities as jsonb; the redesign uses text[].
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'custom_packages'
      and column_name = 'activities' and data_type = 'jsonb'
  ) then
    -- USING transforms forbid subqueries, so migrate via a temp column.
    alter table public.custom_packages add column activities_new text[] not null default '{}';
    update public.custom_packages set activities_new = (
      case when jsonb_typeof(activities) = 'array'
           then array(select jsonb_array_elements_text(activities))
           else '{}'
      end
    );
    alter table public.custom_packages drop column activities;
    alter table public.custom_packages rename column activities_new to activities;
  else
    alter table public.custom_packages add column if not exists activities text[] not null default '{}';
  end if;
end $$;

create index if not exists custom_packages_site_idx
  on public.custom_packages (site_id, status, created_at desc);

create sequence if not exists public.booking_ref_seq start with 1000;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(id) on delete cascade,
  booking_ref text not null unique
    default ('BP' || lpad(nextval('public.booking_ref_seq')::text, 6, '0')),
  access_token uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  booking_type text not null check (booking_type in ('deal', 'custom')),
  deal_id uuid references public.deals(id) on delete set null,
  departure_id uuid references public.deal_departures(id) on delete set null,
  custom_package_id uuid references public.custom_packages(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'deposit_paid', 'paid', 'refunded')),
  payment_method text,
  travellers integer not null check (travellers between 1 and 20),
  start_date date,
  end_date date,
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  currency text not null check (currency in ('BDT', 'USD')),
  notes text,
  invoice_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (booking_type = 'deal' and deal_id is not null)
    or (booking_type = 'custom' and custom_package_id is not null)
  )
);

-- Live databases already have bookings without the redesign columns.
alter table public.bookings add column if not exists site_id text references public.sites(id) on delete cascade;
alter table public.bookings add column if not exists booking_ref text;
alter table public.bookings add column if not exists access_token uuid not null default gen_random_uuid();
alter table public.bookings add column if not exists guest_name text;
alter table public.bookings add column if not exists guest_email text;
alter table public.bookings add column if not exists guest_phone text;
alter table public.bookings add column if not exists departure_id uuid references public.deal_departures(id) on delete set null;
alter table public.bookings add column if not exists travellers integer;
alter table public.bookings add column if not exists start_date date;
alter table public.bookings add column if not exists end_date date;
alter table public.bookings add column if not exists subtotal_minor bigint;
alter table public.bookings add column if not exists total_minor bigint;
alter table public.bookings add column if not exists currency text;
alter table public.bookings add column if not exists notes text;
alter table public.bookings add column if not exists invoice_path text;
alter table public.bookings add column if not exists created_at timestamptz not null default now();

create index if not exists bookings_site_idx on public.bookings (site_id, status, created_at desc);
create index if not exists bookings_user_idx on public.bookings (user_id, created_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual', 'sslcommerz')),
  provider_txn_id text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency in ('BDT', 'USD')),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments (booking_id, created_at desc);

/* -------------------------------------------------------------------------- */
/* Loyalty                                                                    */
/* -------------------------------------------------------------------------- */

create table if not exists public.loyalty_tiers (
  min_pearls integer primary key,
  name text not null unique
);

insert into public.loyalty_tiers (min_pearls, name) values
  (0, 'New'),
  (10, 'Bronze'),
  (50, 'Gold'),
  (100, 'Platinum'),
  (200, 'Diamond')
on conflict (min_pearls) do update set name = excluded.name;

create table if not exists public.pearl_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid unique references public.bookings(id) on delete cascade,
  points integer not null,
  reason text not null default 'confirmed booking',
  created_at timestamptz not null default now()
);

create index if not exists pearl_ledger_user_idx on public.pearl_ledger (user_id, created_at desc);

/* -------------------------------------------------------------------------- */
/* Reviews, saves, media, marketing, audit                                    */
/* -------------------------------------------------------------------------- */

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now()
);

-- Live databases already have reviews without the redesign columns.
alter table public.reviews add column if not exists site_id text references public.sites(id) on delete cascade;
alter table public.reviews add column if not exists author_name text;
alter table public.reviews add column if not exists status text default 'pending';

create unique index if not exists reviews_one_per_booking
  on public.reviews (booking_id) where booking_id is not null;

create index if not exists reviews_deal_idx on public.reviews (deal_id, status, created_at desc);

create table if not exists public.saved_deals (
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deal_id)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(id) on delete cascade,
  bucket text not null default 'media',
  path text not null,
  alt text not null default '',
  width integer,
  height integer,
  mime text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(id) on delete cascade,
  email text not null,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now(),
  unique (site_id, email)
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigserial primary key,
  site_id text,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);

/* -------------------------------------------------------------------------- */
/* Functions and triggers                                                     */
/* -------------------------------------------------------------------------- */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists deals_updated_at on public.deals;
create trigger deals_updated_at before update on public.deals
for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists custom_packages_updated_at on public.custom_packages;
create trigger custom_packages_updated_at before update on public.custom_packages
for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.sync_deal_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_deal uuid;
begin
  target_deal := coalesce(new.deal_id, old.deal_id);
  update public.deals d
  set rating = coalesce(
        (select round(avg(r.rating)::numeric, 1) from public.reviews r
          where r.deal_id = target_deal and r.status = 'approved'),
        0
      ),
      review_count = (
        select count(*) from public.reviews r
        where r.deal_id = target_deal and r.status = 'approved'
      )
  where d.id = target_deal;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_rating_sync on public.reviews;
create trigger reviews_rating_sync
after insert or update or delete on public.reviews
for each row execute function public.sync_deal_rating();

create or replace function public.sync_profile_pearls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
begin
  target_user := coalesce(new.user_id, old.user_id);
  update public.profiles p
  set total_pearls = coalesce(
    (select sum(l.points) from public.pearl_ledger l where l.user_id = target_user),
    0
  )
  where p.id = target_user;
  return coalesce(new, old);
end;
$$;

drop trigger if exists pearl_ledger_sync on public.pearl_ledger;
create trigger pearl_ledger_sync
after insert or update or delete on public.pearl_ledger
for each row execute function public.sync_profile_pearls();

create or replace function public.handle_booking_pearls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed'
     and (old.status is distinct from 'confirmed')
     and new.user_id is not null then
    insert into public.pearl_ledger (user_id, booking_id, points, reason)
    values (new.user_id, new.id, 10, 'confirmed booking')
    on conflict (booking_id) do nothing;
  elsif new.status = 'cancelled' and old.status = 'confirmed' then
    delete from public.pearl_ledger where booking_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_pearls on public.bookings;
create trigger bookings_pearls
after update of status on public.bookings
for each row execute function public.handle_booking_pearls();

create or replace function public.release_booking_seats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled'
     and old.status <> 'cancelled'
     and new.departure_id is not null then
    update public.deal_departures
    set seats_taken = greatest(0, seats_taken - new.travellers)
    where id = new.departure_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_release_seats on public.bookings;
create trigger bookings_release_seats
after update of status on public.bookings
for each row execute function public.release_booking_seats();

create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (site_id, actor_id, action, entity, entity_id, diff)
  values (
    coalesce(
      (to_jsonb(new) ->> 'site_id'),
      (to_jsonb(old) ->> 'site_id')
    ),
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists deals_audit on public.deals;
create trigger deals_audit after insert or update or delete on public.deals
for each row execute function public.log_audit();

drop trigger if exists bookings_audit on public.bookings;
create trigger bookings_audit after insert or update or delete on public.bookings
for each row execute function public.log_audit();

drop trigger if exists custom_packages_audit on public.custom_packages;
create trigger custom_packages_audit after insert or update or delete on public.custom_packages
for each row execute function public.log_audit();

drop trigger if exists reviews_audit on public.reviews;
create trigger reviews_audit after insert or update or delete on public.reviews
for each row execute function public.log_audit();

/**
 * Atomic booking creation: validates the deal and departure, locks the
 * departure row, checks capacity, computes the price from the database and
 * inserts the booking. Callable by service_role only.
 */
create or replace function public.create_booking(
  p_site_id text,
  p_deal_slug text,
  p_departure_id uuid,
  p_travellers integer,
  p_user_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_notes text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_deal public.deals;
  target_departure public.deal_departures;
  unit_price bigint;
  created public.bookings;
begin
  if p_travellers < 1 or p_travellers > 12 then
    raise exception 'INVALID_TRAVELLERS';
  end if;

  select * into target_deal
  from public.deals
  where site_id = p_site_id and slug = p_deal_slug and status = 'published';

  if not found then
    raise exception 'DEAL_NOT_FOUND';
  end if;

  select * into target_departure
  from public.deal_departures
  where id = p_departure_id and deal_id = target_deal.id
  for update;

  if not found then
    raise exception 'DEPARTURE_NOT_FOUND';
  end if;

  if target_departure.status <> 'scheduled'
     or target_departure.seats_taken + p_travellers > target_departure.capacity then
    raise exception 'SOLD_OUT';
  end if;

  unit_price := coalesce(target_departure.price_minor, target_deal.price_minor);

  update public.deal_departures
  set seats_taken = seats_taken + p_travellers
  where id = target_departure.id;

  insert into public.bookings (
    site_id, user_id, guest_name, guest_email, guest_phone,
    booking_type, deal_id, departure_id, travellers,
    start_date, end_date, subtotal_minor, total_minor, currency, notes
  )
  values (
    p_site_id, p_user_id, p_guest_name, lower(p_guest_email), p_guest_phone,
    'deal', target_deal.id, target_departure.id, p_travellers,
    target_departure.start_date, target_departure.end_date,
    unit_price * p_travellers, unit_price * p_travellers,
    target_deal.currency, p_notes
  )
  returning * into created;

  return created;
end;
$$;

revoke all on function public.create_booking(text, text, uuid, integer, uuid, text, text, text, text) from public;
revoke all on function public.create_booking(text, text, uuid, integer, uuid, text, text, text, text) from anon;
revoke all on function public.create_booking(text, text, uuid, integer, uuid, text, text, text, text) from authenticated;
grant execute on function public.create_booking(text, text, uuid, integer, uuid, text, text, text, text) to service_role;

/* -------------------------------------------------------------------------- */
/* RLS                                                                        */
/* -------------------------------------------------------------------------- */

alter table public.sites enable row level security;
alter table public.profiles enable row level security;
alter table public.deals enable row level security;
alter table public.deal_departures enable row level security;
alter table public.deal_itineraries enable row level security;
alter table public.deal_stops enable row level security;
alter table public.custom_packages enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.loyalty_tiers enable row level security;
alter table public.pearl_ledger enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_deals enable row level security;
alter table public.media enable row level security;
alter table public.subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Sites
create policy "sites public read" on public.sites
  for select to anon, authenticated using (is_active);
create policy "sites admin write" on public.sites
  for all to authenticated using (is_admin()) with check (is_admin());

-- Profiles
create policy "profiles read own" on public.profiles
  for select to authenticated using (auth.uid() = id or is_admin());
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles admin all" on public.profiles
  for all to authenticated using (is_admin()) with check (is_admin());

-- Catalogue
create policy "deals public read" on public.deals
  for select to anon, authenticated using (status = 'published');
create policy "deals admin all" on public.deals
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "departures public read" on public.deal_departures
  for select to anon, authenticated using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id and d.status = 'published'
    )
  );
create policy "departures admin all" on public.deal_departures
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "itineraries public read" on public.deal_itineraries
  for select to anon, authenticated using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id and d.status = 'published'
    )
  );
create policy "itineraries admin all" on public.deal_itineraries
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "stops public read" on public.deal_stops
  for select to anon, authenticated using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id and d.status = 'published'
    )
  );
create policy "stops admin all" on public.deal_stops
  for all to authenticated using (is_admin()) with check (is_admin());

-- Requests
create policy "requests read own" on public.custom_packages
  for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "requests admin update" on public.custom_packages
  for update to authenticated using (is_admin()) with check (is_admin());

-- Bookings: user reads own, admin reads/writes. Guest creation goes through service_role.
create policy "bookings read own" on public.bookings
  for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "bookings admin update" on public.bookings
  for update to authenticated using (is_admin()) with check (is_admin());

-- Payments
create policy "payments read own" on public.payments
  for select to authenticated using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and (b.user_id = auth.uid() or is_admin())
    )
  );
create policy "payments admin all" on public.payments
  for all to authenticated using (is_admin()) with check (is_admin());

-- Loyalty
create policy "tiers public read" on public.loyalty_tiers
  for select to anon, authenticated using (true);
create policy "pearls read own" on public.pearl_ledger
  for select to authenticated using (user_id = auth.uid() or is_admin());

-- Reviews
create policy "reviews public read approved" on public.reviews
  for select to anon, authenticated using (status = 'approved');
create policy "reviews read own" on public.reviews
  for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "reviews admin update" on public.reviews
  for update to authenticated using (is_admin()) with check (is_admin());

-- Saves
create policy "saves read own" on public.saved_deals
  for select to authenticated using (auth.uid() = user_id);
create policy "saves insert own" on public.saved_deals
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saves delete own" on public.saved_deals
  for delete to authenticated using (auth.uid() = user_id);

-- Media and audit
create policy "media public read" on public.media for select to anon, authenticated using (true);
create policy "media admin all" on public.media for all to authenticated using (is_admin()) with check (is_admin());
create policy "audit admin read" on public.audit_log for select to authenticated using (is_admin());

/* -------------------------------------------------------------------------- */
/* Grants                                                                     */
/* -------------------------------------------------------------------------- */

grant usage on schema public to anon, authenticated;
grant select on public.sites to anon, authenticated;
grant select on public.deals, public.deal_departures, public.deal_itineraries, public.deal_stops to anon, authenticated;
grant insert, update, delete on public.deals, public.deal_departures, public.deal_itineraries, public.deal_stops to authenticated;
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, home_site_id) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
grant select on public.bookings to authenticated;
grant update on public.bookings to authenticated;
revoke insert, delete on public.bookings from anon, authenticated;
grant select on public.custom_packages to authenticated;
grant update on public.custom_packages to authenticated;
revoke insert, delete on public.custom_packages from anon, authenticated;
grant select on public.payments to authenticated;
grant select on public.pearl_ledger to authenticated;
grant select on public.loyalty_tiers to anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant update on public.reviews to authenticated;
revoke insert, delete on public.reviews from anon, authenticated;
grant select, insert, delete on public.saved_deals to authenticated;
grant select on public.media to anon, authenticated;
grant select on public.audit_log to authenticated;
grant all on public.sites, public.profiles, public.deals, public.deal_departures,
  public.deal_itineraries, public.deal_stops, public.custom_packages, public.bookings,
  public.payments, public.pearl_ledger, public.reviews, public.saved_deals, public.media,
  public.subscribers, public.contact_messages, public.audit_log to service_role;
grant all on sequence public.booking_ref_seq to service_role;

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

insert into storage.buckets (id, name, public)
values
  ('media', 'media', true),
  ('avatars', 'avatars', false),
  ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "bp media read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');
create policy "bp media admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "bp media admin update" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "bp media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

create policy "bp avatars own read" on storage.objects
  for select to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "bp avatars own write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "bp avatars own update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bp invoices admin read" on storage.objects
  for select to authenticated using (bucket_id = 'invoices' and public.is_admin());
create policy "bp invoices admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'invoices' and public.is_admin());

/* -------------------------------------------------------------------------- */
/* Seed sites                                                                 */
/* -------------------------------------------------------------------------- */

insert into public.sites (id, name, hostname, currency, locale, settings)
values
  (
    'bd',
    'BlackPearl',
    'blackpearl.bd',
    'BDT',
    'en-BD',
    '{"theme":"warm","tagline":"The hills, before the crowd."}'::jsonb
  ),
  (
    'global',
    'BlackPearl Global',
    'global.blackpearl.bd',
    'USD',
    'en',
    '{"theme":"cool","tagline":"The world, arranged quietly."}'::jsonb
  )
on conflict (id) do update
set name = excluded.name,
    hostname = excluded.hostname,
    currency = excluded.currency,
    locale = excluded.locale,
    settings = excluded.settings;
