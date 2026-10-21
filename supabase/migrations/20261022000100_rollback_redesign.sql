-- Rollback: remove the Next.js redesign schema (20261019000100) and the
-- live-data bridge (20261020000100), restoring the 001-019 shape used by
-- web/ + worker/ at 350fb0a.
--
-- What this does:
--  1. Reverses bridge data mutations that are incompatible with the old code:
--     bookings.status confirmed->approved, payment_status unpaid->pending;
--     custom_packages.status reviewing->processing, quoted->approved,
--     declined->rejected, new->pending; profiles.role traveler->user.
--  2. Reverts custom_packages.activities text[] back to jsonb.
--  3. Drops redesign triggers/policies on the old tables.
--  4. Restores the original handle_new_user() signup trigger (001 version).
--  5. Drops redesign-added columns from the old tables.
--  6. Drops redesign-only tables + booking_ref_seq + redesign functions.
--
-- LOSSY on purpose (redesign never went live, so impact is bridge-only rows):
--  - bookings processing->pending is NOT reversible (pending is also a
--    pre-existing value); left as pending, which the old code accepts.
--  - bookings rejected->cancelled is NOT reversible (cancelled is also
--    pre-existing); left as cancelled, which the old code accepts.
--  - Bridge-copied rows (deals, departures, itineraries, pearl_ledger, ...)
--    are destroyed with their tables; originals in tour_deals,
--    pearls_history, profiles.pearls stay intact and were never modified.
-- Untouched on purpose (pre-existing 001-019 objects): tour_deals,
-- pearls_history, saved_deals (001 shape kept via IF NOT EXISTS),
-- reviews.is_approved, custom_packages.num_travelers/traveler_details,
-- profiles.pearls/email, public.is_admin(), and all 001 policies.
--
-- Fresh-DB safe: every statement is IF EXISTS-guarded or a no-op without
-- the redesign objects.

/* ------------------------------------------------------------------ */
/* 1. Reverse bridge data mutations                                   */
/* ------------------------------------------------------------------ */

update public.bookings set status = 'approved' where status = 'confirmed';
update public.bookings set payment_status = 'pending' where payment_status = 'unpaid';

update public.custom_packages set status = 'processing' where status = 'reviewing';
update public.custom_packages set status = 'approved' where status = 'quoted';
update public.custom_packages set status = 'rejected' where status = 'declined';
update public.custom_packages set status = 'pending' where status = 'new';

update public.profiles set role = 'user' where role = 'traveler';

/* activities text[] -> jsonb (only when the redesign converted it) */
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'custom_packages'
      and column_name = 'activities' and data_type = 'ARRAY'
  ) then
    alter table public.custom_packages alter column activities drop default;
    alter table public.custom_packages
      alter column activities type jsonb using to_jsonb(activities);
    alter table public.custom_packages
      alter column activities set default '[]'::jsonb;
    alter table public.custom_packages alter column activities drop not null;
  end if;
end
$$;

/* ------------------------------------------------------------------ */
/* 2. Drop redesign triggers on old + new tables                      */
/* ------------------------------------------------------------------ */

drop trigger if exists bookings_updated_at on public.bookings;
drop trigger if exists bookings_pearls on public.bookings;
drop trigger if exists bookings_release_seats on public.bookings;
drop trigger if exists bookings_audit on public.bookings;
drop trigger if exists custom_packages_updated_at on public.custom_packages;
drop trigger if exists custom_packages_audit on public.custom_packages;
drop trigger if exists profiles_updated_at on public.profiles;
drop trigger if exists reviews_rating_sync on public.reviews;
drop trigger if exists reviews_audit on public.reviews;
drop trigger if exists deals_updated_at on public.deals;
drop trigger if exists deals_audit on public.deals;
drop trigger if exists pearl_ledger_sync on public.pearl_ledger;

/* ------------------------------------------------------------------ */
/* 3. Drop redesign RLS policies (names are redesign-only; 001's      */
/*    differently-named policies on the same tables are left alone)   */
/* ------------------------------------------------------------------ */

drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles admin all" on public.profiles;
drop policy if exists "requests read own" on public.custom_packages;
drop policy if exists "requests admin update" on public.custom_packages;
drop policy if exists "bookings read own" on public.bookings;
drop policy if exists "bookings admin update" on public.bookings;
drop policy if exists "reviews public read approved" on public.reviews;
drop policy if exists "reviews read own" on public.reviews;
drop policy if exists "reviews admin update" on public.reviews;

drop policy if exists "bp media read" on storage.objects;
drop policy if exists "bp media admin write" on storage.objects;
drop policy if exists "bp media admin update" on storage.objects;
-- NOTE: storage.objects cannot be deleted via SQL (guard trigger); the
-- redesign never went live so the 'media' bucket is empty.
delete from storage.buckets where id = 'media';

/* ------------------------------------------------------------------ */
/* 4. Restore the original signup trigger (001 version)               */
/* ------------------------------------------------------------------ */

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

/* ------------------------------------------------------------------ */
/* 5. Drop redesign-added columns from old tables                     */
/* ------------------------------------------------------------------ */

alter table public.profiles
  drop column if exists total_pearls,
  drop column if exists home_site_id;

alter table public.custom_packages
  drop column if exists site_id,
  drop column if exists guest_name,
  drop column if exists guest_email,
  drop column if exists guest_phone,
  drop column if exists destination,
  drop column if exists start_date,
  drop column if exists end_date,
  drop column if exists travellers,
  drop column if exists accommodation_tier,
  drop column if exists transport_mode,
  drop column if exists budget_minor,
  drop column if exists currency,
  drop column if exists quoted_total_minor,
  drop column if exists replied_at;

alter table public.bookings
  drop column if exists site_id,
  drop column if exists booking_ref,
  drop column if exists access_token,
  drop column if exists guest_name,
  drop column if exists guest_email,
  drop column if exists guest_phone,
  drop column if exists departure_id,
  drop column if exists travellers,
  drop column if exists start_date,
  drop column if exists end_date,
  drop column if exists subtotal_minor,
  drop column if exists total_minor,
  drop column if exists currency,
  drop column if exists notes,
  drop column if exists invoice_path,
  drop column if exists created_at;

alter table public.reviews
  drop column if exists site_id,
  drop column if exists author_name,
  drop column if exists status;

/* ------------------------------------------------------------------ */
/* 6. Drop redesign-only tables, sequence, functions                  */
/* ------------------------------------------------------------------ */

drop table if exists public.pearl_ledger cascade;
drop table if exists public.payments cascade;
drop table if exists public.deal_stops cascade;
drop table if exists public.deal_itineraries cascade;
drop table if exists public.deal_departures cascade;
drop table if exists public.media cascade;
drop table if exists public.subscribers cascade;
drop table if exists public.contact_messages cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.loyalty_tiers cascade;
drop table if exists public.deals cascade;
drop table if exists public.sites cascade;

drop sequence if exists public.booking_ref_seq;

do $$
declare
  r record;
begin
  for r in
    select oid::regprocedure as sig from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'set_updated_at',
        'sync_deal_rating',
        'sync_profile_pearls',
        'handle_booking_pearls',
        'release_booking_seats',
        'log_audit',
        'create_booking',
        'bp_coerce_jsonb_array'
      )
  loop
    execute 'drop function if exists ' || r.sig;
  end loop;
end
$$;
