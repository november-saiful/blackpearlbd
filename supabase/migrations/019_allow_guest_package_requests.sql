-- ============================================================
-- PACKAGE BUILDER: let travellers submit without an account
-- ============================================================
-- Requiring sign-in just to ask for a quote loses the request at the last
-- step of the builder. A request may now belong to nobody and instead carry
-- the contact details the traveller typed, which is what the admin needs to
-- send a quote back.
--
-- `user_id` stays the owner for signed-in travellers (and still drives the
-- "my packages" list and the per-user RLS policies); it is simply null for a
-- guest. The admin queue reads through the service role, so guest rows are
-- visible to admins and to nobody else.

alter table custom_packages
  alter column user_id drop not null,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_location text;

-- Either the request belongs to a user, or it carries a way to reach whoever
-- asked. Without this, a guest row could exist that nobody can ever answer.
do $$
begin
  alter table custom_packages
    add constraint custom_packages_contact_check
    check (
      user_id is not null
      or (contact_name is not null and contact_phone is not null and contact_location is not null)
    );
exception
  when duplicate_object then null;
end $$;

-- Guest requests are the ones an admin has to act on next, so the queue can
-- filter for them without scanning the whole table.
create index if not exists idx_custom_packages_guest
  on custom_packages (created_at desc)
  where user_id is null;
