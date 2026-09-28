-- ============================================================
-- PACKAGE BUILDER: store everything the 3-step builder collects
-- ============================================================
-- The builder identifies a destination with the admin-managed slug from
-- package_destinations.value ('thailand', 'bangladesh-customized',
-- 'dhaka-division', ...). That value is text, so it cannot live in the older
-- `destination_id` uuid, which points at the separate geo `destinations` tree.
-- Without somewhere to put it, a submitted package could not say where the
-- traveller wanted to go at all.
--
-- The builder also asks for a return date (the trip is a range, while
-- travel_date only holds the start) and, for Bangladeshi custom tours, the
-- division / districts / tour spots the traveller picked. Those are stored in
-- their own columns rather than folded into `special_requests`, so the admin
-- queue can show them as the structured choices they are.

alter table custom_packages
  add column if not exists destination_value text,
  add column if not exists return_date date,
  add column if not exists division text,
  add column if not exists districts jsonb not null default '[]'::jsonb,
  add column if not exists tour_spots jsonb not null default '[]'::jsonb;

-- The admin queue filters by destination slug; the geosearch/backfill scripts
-- read it back to match a package with the deals that share a destination.
create index if not exists idx_custom_packages_destination_value
  on custom_packages (destination_value);
