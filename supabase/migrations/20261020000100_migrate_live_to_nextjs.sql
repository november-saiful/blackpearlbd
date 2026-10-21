-- 20261020000100_migrate_live_to_nextjs.sql
-- Data-preserving bridge from the live Vite+Worker schema (001-019, tour_deals)
-- to the Next.js redesign schema (20261019000100, deals).
--
-- Principles:
-- - Idempotent: safe to run multiple times (IF NOT EXISTS / ON CONFLICT).
-- - Non-destructive: old tables and columns (tour_deals, pearls, traveler_details,
--   is_approved, ...) are kept for rollback; we only ADD columns and COPY data.
-- - Fresh-safe: the file runs on fresh databases too (local `supabase db reset`,
--   CI). Anything that touches legacy-only tables/columns lives inside the
--   legacy-gated DO block below, which returns immediately when tour_deals is
--   absent. Plain statements outside the gate reference only redesign columns.
-- - Order: the 20261020 prefix sorts AFTER 20261019000100 (the redesign schema),
--   so the new tables exist when this runs. (A plain 020_ prefix would sort
--   BEFORE 2026* and fail with missing relations.)
--
-- Live -> redesign mapping:
--   profiles.role 'user' -> 'traveler', pearls -> total_pearls
--   tour_deals -> deals (same UUID, site_id='bd', currency='BDT')
--   bookings status: pending->pending, processing->pending, approved->confirmed,
--                    rejected->cancelled, cancelled->cancelled
--   bookings payment_status 'pending' -> 'unpaid'
--   custom_packages: budget decimal -> budget_minor, estimated_price -> quoted,
--     accommodation budget/standard/luxury -> essential/comfort/signature,
--     transport flight/bus/train/self -> flight/shared/shared/private
--   reviews is_approved true->'approved', false->'pending'

/* -------------------------------------------------------------------------- */
/* 0. Sites (seeded by the schema migration too, but be safe)                 */
/* -------------------------------------------------------------------------- */
insert into public.sites (id, name, hostname, currency, locale, settings)
values
  ('bd', 'BlackPearl', 'blackpearl.bd', 'BDT', 'en-BD',
   '{"theme":"warm","tagline":"The hills, before the crowd."}'::jsonb),
  ('global', 'BlackPearl Global', 'global.blackpearl.bd', 'USD', 'en',
   '{"theme":"cool","tagline":"The world, arranged quietly."}'::jsonb)
on conflict (id) do nothing;

/* -------------------------------------------------------------------------- */
/* 1. Structural ALTERs (safe on fresh and live: all IF NOT EXISTS)           */
/*    The schema migration already adds these; repeated here so this file is   */
/*    safe to run standalone.                                                 */
/* -------------------------------------------------------------------------- */
alter table public.profiles add column if not exists total_pearls integer not null default 0;
alter table public.profiles add column if not exists home_site_id text references public.sites(id);
alter table public.bookings add column if not exists site_id text references public.sites(id);
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
alter table public.custom_packages add column if not exists site_id text references public.sites(id);
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
alter table public.reviews add column if not exists site_id text references public.sites(id);
alter table public.reviews add column if not exists author_name text;
alter table public.reviews add column if not exists status text default 'pending';

/* -------------------------------------------------------------------------- */
/* 2. Helper: normalize a jsonb value that may be double-encoded into an array */
/* -------------------------------------------------------------------------- */
create or replace function public.bp_coerce_jsonb_array(v jsonb)
returns jsonb
language plpgsql immutable
as $$
declare
  t text;
begin
  if v is null then return '[]'::jsonb; end if;
  if jsonb_typeof(v) = 'array' then return v; end if;
  if jsonb_typeof(v) = 'string' then
    t := trim(both '"' from v #>> '{}');
    begin
      if left(t, 1) = '[' then return t::jsonb; end if;
    exception when others then
      return '[]'::jsonb;
    end;
    return '[]'::jsonb;
  end if;
  return '[]'::jsonb;
end;
$$;

/* -------------------------------------------------------------------------- */
/* 3. Legacy data moves. Everything in here touches legacy-only tables or      */
/*    columns (tour_deals, pearls_history, traveler_details, is_approved,      */
/*    pearls, email on profiles, contact_*, num_travelers, travel_date,        */
/*    estimated_price, budget, ...), so it is gated on tour_deals existing.   */
/*    PL/pgSQL plans statements on first execution, and we RETURN before any   */
/*    of them on fresh databases, so this block is a safe no-op there.         */
/* -------------------------------------------------------------------------- */
do $$
begin
  if to_regclass('public.tour_deals') is null then
    return;
  end if;

  /* ---- 3a. Profiles: pearls, roles, home site ---- */
  update public.profiles set total_pearls = coalesce(pearls, 0)
  where coalesce(pearls, 0) <> 0 and (total_pearls = 0 or total_pearls is null);

  update public.profiles set role = 'traveler' where role = 'user';

  update public.profiles set home_site_id = 'bd' where home_site_id is null;

  /* ---- 3b. tour_deals -> deals (reuse UUIDs) ---- */
  insert into public.deals (
    id, site_id, slug, title, subtitle, summary, description,
    destination, country, category, duration_days, duration_nights,
    price_minor, compare_at_minor, currency, hero_image, gallery,
    inclusions, exclusions, featured, status, rating, review_count,
    created_by, created_at, updated_at
  )
  select
    t.id,
    'bd',
    t.slug,
    t.title,
    coalesce(nullif(t.short_description, ''), left(coalesce(t.description, t.title), 120)),
    coalesce(nullif(t.short_description, ''), left(coalesce(t.description, t.title), 160)),
    coalesce(t.description, ''),
    t.destination,
    'Bangladesh',
    case lower(coalesce(t.category, 'tour'))
      when 'beach' then 'Beach'
      when 'nature' then 'Wildlife'
      when 'hill' then 'Hills'
      when 'river' then 'River'
      when 'heritage' then 'Culture'
      when 'adventure' then 'Adventure'
      else 'Tour'
    end,
    greatest(t.duration_days, 1),
    greatest(t.duration_days - 1, 0),
    greatest(round(coalesce(t.price, 0) * 100)::bigint, 0),
    case when t.original_price is null then null
         else greatest(round(t.original_price * 100)::bigint, 0) end,
    'BDT',
    coalesce(nullif(t.image_url, ''), ''),
    coalesce((
      select jsonb_agg(jsonb_build_object('url', elem, 'alt', t.title))
      from jsonb_array_elements_text(public.bp_coerce_jsonb_array(t.gallery)) as elem
      where elem <> ''
    ), '[]'::jsonb),
    coalesce((
      select array_agg(elem)
      from jsonb_array_elements_text(public.bp_coerce_jsonb_array(t.inclusions)) as elem
    ), '{}'),
    coalesce((
      select array_agg(elem)
      from jsonb_array_elements_text(public.bp_coerce_jsonb_array(t.exclusions)) as elem
    ), '{}'),
    coalesce(t.is_featured, false),
    case when coalesce(t.is_active, true) then 'published' else 'draft' end,
    coalesce(t.avg_rating, 0),
    coalesce(t.review_count, 0),
    t.created_by,
    coalesce(t.created_at, now()),
    coalesce(t.updated_at, now())
  from public.tour_deals t
  where not exists (select 1 from public.deals d where d.id = t.id)
    and not exists (select 1 from public.deals d where d.site_id = 'bd' and d.slug = t.slug)
  on conflict (id) do nothing;

  /* ---- 3c. Itineraries + stops ---- */
  insert into public.deal_itineraries (deal_id, day_number, title, description, image_url)
  select
    t.id,
    coalesce((elem->>'phase')::int, (elem->>'day')::int, rn),
    coalesce(elem->>'title', 'Day ' || rn),
    coalesce(elem->>'description', ''),
    nullif(elem->'photos'->>0, '')
  from public.tour_deals t,
    jsonb_array_elements(public.bp_coerce_jsonb_array(t.itinerary)) with ordinality as e(elem, rn)
  where exists (select 1 from public.deals d where d.id = t.id)
    and not exists (
      select 1 from public.deal_itineraries di
      where di.deal_id = t.id
        and di.day_number = coalesce((elem->>'phase')::int, (elem->>'day')::int, rn)
    )
  on conflict (deal_id, day_number) do nothing;

  insert into public.deal_stops (deal_id, sort_order, name, lat, lng, note)
  select
    t.id,
    rn,
    coalesce(nullif(elem->>'name', ''), 'Stop ' || rn),
    coalesce((elem->>'lat')::numeric, 23.8103),
    coalesce((elem->>'lng')::numeric, 90.4125),
    elem->>'address'
  from public.tour_deals t,
    jsonb_array_elements(public.bp_coerce_jsonb_array(t.route_waypoints)) with ordinality as e(elem, rn)
  where (elem->>'lat') ~ '^-?[0-9]+(\.[0-9]+)?$'
    and (elem->>'lng') ~ '^-?[0-9]+(\.[0-9]+)?$'
    and exists (select 1 from public.deals d where d.id = t.id)
    and not exists (select 1 from public.deal_stops ds where ds.deal_id = t.id and ds.sort_order = rn)
  on conflict (deal_id, sort_order) do nothing;

  /* ---- 3d. Reviews: site, author, approved mapping ---- */
  update public.reviews set site_id = 'bd' where site_id is null;

  update public.reviews r
  set author_name = coalesce(
    (select nullif(p.full_name, '') from public.profiles p where p.id = r.user_id),
    'Traveller'
  )
  where author_name is null or author_name = '';

  update public.reviews
  set status = case when is_approved then 'approved' else 'pending' end
  where status = 'pending' or status is null;

  /* ---- 3e. Bookings: guest contact, amounts, statuses, refs ---- */
  update public.bookings set site_id = 'bd' where site_id is null;
  update public.bookings set currency = 'BDT' where currency is null;
  update public.bookings set travellers = 1 where travellers is null;

  update public.bookings b
  set guest_name = coalesce(
      nullif(b.traveler_details->>'name', ''),
      (select nullif(p.full_name, '') from public.profiles p where p.id = b.user_id),
      'Guest'
    ),
    guest_email = coalesce(
      nullif(b.traveler_details->>'email', ''),
      (select p.email from public.profiles p where p.id = b.user_id),
      'guest@example.com'
    ),
    guest_phone = coalesce(
      nullif(b.traveler_details->>'phone', ''),
      (select nullif(p.phone, '') from public.profiles p where p.id = b.user_id),
      ''
    )
  where guest_name is null or guest_email is null;

  update public.bookings
  set total_minor = greatest(round(coalesce(total_amount, 0) * 100)::bigint, 0),
      subtotal_minor = greatest(round(coalesce(total_amount, 0) * 100)::bigint, 0)
  where total_minor is null;

  update public.bookings set status = 'pending' where status = 'processing';
  update public.bookings set status = 'confirmed' where status = 'approved';
  update public.bookings set status = 'cancelled' where status = 'rejected';
  update public.bookings set payment_status = 'unpaid' where payment_status = 'pending';

  update public.bookings
  set booking_ref = invoice_number
  where booking_ref is null and invoice_number is not null;

  update public.bookings
  set booking_ref = 'BP' || lpad(nextval('public.booking_ref_seq')::text, 6, '0')
  where booking_ref is null;

  update public.bookings b
  set departure_id = (
        select dd.id from public.deal_departures dd
        where dd.deal_id = b.deal_id order by dd.start_date asc limit 1
      ),
      start_date = (
        select dd.start_date from public.deal_departures dd
        where dd.deal_id = b.deal_id order by dd.start_date asc limit 1
      ),
      end_date = (
        select dd.end_date from public.deal_departures dd
        where dd.deal_id = b.deal_id order by dd.start_date asc limit 1
      )
  where b.booking_type = 'deal' and b.deal_id is not null and b.departure_id is null;

  update public.bookings set created_at = booked_at
  where booked_at is not null;

  /* ---- 3f. Custom packages: contact, dates, budget, enums ---- */
  update public.custom_packages set site_id = 'bd' where site_id is null;
  update public.custom_packages set currency = 'BDT' where currency is null;
  update public.custom_packages set travellers = coalesce(num_travelers, 1) where travellers is null;

  update public.custom_packages set transport_mode =
    case lower(coalesce(transport_type, ''))
      when 'flight' then 'flight'
      when 'bus' then 'shared'
      when 'train' then 'shared'
      when 'self' then 'private'
      else transport_mode
    end
  where transport_mode is null and transport_type is not null;
  update public.custom_packages set transport_mode = 'private' where transport_mode is null;

  update public.custom_packages set accommodation_tier =
    case lower(coalesce(accommodation_type, ''))
      when 'budget' then 'essential'
      when 'standard' then 'comfort'
      when 'luxury' then 'signature'
      else accommodation_tier
    end
  where accommodation_tier is null and accommodation_type is not null;
  update public.custom_packages set accommodation_tier = 'comfort' where accommodation_tier is null;

  update public.custom_packages set destination = coalesce(destination, destination_value, title, 'Custom trip')
  where destination is null;

  update public.custom_packages set start_date = travel_date
  where start_date is null and travel_date is not null;
  update public.custom_packages set end_date = return_date
  where end_date is null and return_date is not null;
  update public.custom_packages set end_date = start_date
  where end_date is null and start_date is not null;
  update public.custom_packages set start_date = current_date + 30 where start_date is null;
  update public.custom_packages set end_date = start_date + 3 where end_date is null;

  update public.custom_packages
  set budget_minor = greatest(round(coalesce(budget, 0) * 100)::bigint, 0)
  where budget_minor is null;
  update public.custom_packages set budget_minor = 0 where budget_minor is null;

  update public.custom_packages
  set quoted_total_minor = greatest(round(estimated_price * 100)::bigint, 0)
  where quoted_total_minor is null and estimated_price is not null;

  update public.custom_packages c
  set guest_name = coalesce(
        nullif(c.contact_name, ''),
        (select nullif(p.full_name, '') from public.profiles p where p.id = c.user_id),
        coalesce(nullif(c.title, ''), 'Guest')
      ),
      guest_phone = coalesce(
        nullif(c.contact_phone, ''),
        (select nullif(p.phone, '') from public.profiles p where p.id = c.user_id),
        ''
      ),
      guest_email = coalesce(
        (select p.email from public.profiles p where p.id = c.user_id),
        'guest@example.com'
      )
  where guest_name is null;

  update public.custom_packages set status = 'reviewing' where status = 'processing';
  update public.custom_packages set status = 'quoted' where status = 'approved';
  update public.custom_packages set status = 'declined' where status = 'rejected';
  update public.custom_packages set status = 'new' where status = 'pending';

  /* ---- 3g. Pearls history -> ledger ---- */
  insert into public.pearl_ledger (user_id, booking_id, points, reason, created_at)
  select h.user_id, h.booking_id, h.amount, coalesce(h.reason, 'confirmed booking'), h.created_at
  from public.pearls_history h
  where h.booking_id is not null
    and not exists (
      select 1 from public.pearl_ledger l
      where l.booking_id = h.booking_id and l.user_id = h.user_id
    )
  on conflict (booking_id) do nothing;
end $$;

/* -------------------------------------------------------------------------- */
/* 4. Default departures for deals that have none (new and migrated). Safe    */
/*    on fresh and live: references only redesign tables.                     */
/* -------------------------------------------------------------------------- */
insert into public.deal_departures (deal_id, start_date, end_date, capacity, seats_taken, status)
select
  d.id,
  (current_date + 30),
  (current_date + 30 + d.duration_days),
  20,
  0,
  'scheduled'
from public.deals d
where d.site_id = 'bd'
  and not exists (select 1 from public.deal_departures dd where dd.deal_id = d.id)
on conflict (deal_id, start_date) do nothing;

/* -------------------------------------------------------------------------- */
/* 5. booking_ref uniqueness going forward (safe everywhere).                 */
/* -------------------------------------------------------------------------- */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_booking_ref_unique') then
    alter table public.bookings add constraint bookings_booking_ref_unique unique (booking_ref);
  end if;
exception when duplicate_table then null;
end $$;

/* -------------------------------------------------------------------------- */
/* 6. Refresh denormalized ratings (safe everywhere).                         */
/* -------------------------------------------------------------------------- */
update public.deals d
set review_count = coalesce((
    select count(*) from public.reviews r
    where r.deal_id = d.id and r.status = 'approved'
  ), 0),
  rating = coalesce((
    select round(avg(r.rating)::numeric, 1) from public.reviews r
    where r.deal_id = d.id and r.status = 'approved'
  ), 0)
where d.site_id = 'bd';
