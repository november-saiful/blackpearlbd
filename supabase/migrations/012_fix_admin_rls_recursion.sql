-- ============================================================
-- FIX: infinite recursion (42P17) in admin RLS policies
-- ============================================================
-- Every admin policy was written as:
--
--   using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
--
-- Including the one ON profiles itself. Evaluating a policy on `profiles`
-- re-evaluates the policies on `profiles`, which Postgres detects as
-- "infinite recursion detected in policy for relation \"profiles\"".
--
-- Any query that touched a table whose policy subqueried `profiles` therefore
-- failed outright -- including anon reads of `destinations` (its admin SELECT
-- policy references profiles), which is why the public destinations API
-- returned a 42P17 error.
--
-- The fix is a SECURITY DEFINER helper. It runs as the function owner, so the
-- inner read of `profiles` bypasses RLS entirely and the recursion cannot form.
-- `set search_path = ''` plus fully-qualified names prevents search-path
-- hijacking of a SECURITY DEFINER function.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the caller has an admin profile. SECURITY DEFINER so RLS policies can check role without recursing into the profiles policies.';

-- Policies are evaluated as the calling role, so anon and authenticated must be
-- able to execute it. No table access is granted beyond the boolean answer.
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Rebuild every policy that used the recursive profiles subquery.
-- The expressions are logically identical to before; only the source of the
-- admin check changed. `(select public.is_admin())` wraps the call in an
-- InitPlan so it is evaluated once per statement instead of once per row.
-- ------------------------------------------------------------

-- Profiles: this is the policy that actually recursed.
drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles"
  on profiles for select
  using ((select public.is_admin()));

-- Tour deals
drop policy if exists "Admins can manage tour deals" on tour_deals;
create policy "Admins can manage tour deals"
  on tour_deals for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Custom packages
drop policy if exists "Admins can view all custom packages" on custom_packages;
create policy "Admins can view all custom packages"
  on custom_packages for select
  using ((select public.is_admin()));

-- Bookings
drop policy if exists "Admins can manage all bookings" on bookings;
create policy "Admins can manage all bookings"
  on bookings for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Destinations (the table whose anon reads were erroring)
drop policy if exists "Admins can view all destinations" on destinations;
create policy "Admins can view all destinations"
  on destinations for select
  using ((select public.is_admin()));

drop policy if exists "Admins can manage destinations" on destinations;
create policy "Admins can manage destinations"
  on destinations for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Package destinations
drop policy if exists "Admins can view all package destinations" on package_destinations;
create policy "Admins can view all package destinations"
  on package_destinations for select
  using ((select public.is_admin()));

drop policy if exists "Admins can manage package destinations" on package_destinations;
create policy "Admins can manage package destinations"
  on package_destinations for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Package districts
drop policy if exists "Admins can view all package districts" on package_districts;
create policy "Admins can view all package districts"
  on package_districts for select
  using ((select public.is_admin()));

drop policy if exists "Admins can manage package districts" on package_districts;
create policy "Admins can manage package districts"
  on package_districts for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Package tour spots
drop policy if exists "Admins can view all package tour spots" on package_tour_spots;
create policy "Admins can view all package tour spots"
  on package_tour_spots for select
  using ((select public.is_admin()));

drop policy if exists "Admins can manage package tour spots" on package_tour_spots;
create policy "Admins can manage package tour spots"
  on package_tour_spots for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ------------------------------------------------------------
-- Note on WITH CHECK: previously the FOR ALL policies had no explicit WITH
-- CHECK, so Postgres reused USING for both read and write. Writing it out
-- explicitly keeps identical behaviour.
--
-- Note on FORCE ROW LEVEL SECURITY: none of these tables use it, so the table
-- owner (and therefore is_admin()) continues to bypass RLS. If that ever
-- changes, this helper needs to be rethought.
-- ------------------------------------------------------------
