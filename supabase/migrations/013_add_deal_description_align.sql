-- The About section of a deal page is aligned per deal, chosen by an admin in
-- the deal form. It is a property of that section, not of the page: one tour's
-- body can be justified while the next one's stays left.
--
-- Values must stay in sync with worker/src/lib/validators.ts
-- (DEAL_DESCRIPTION_ALIGN_VALUES) and web/src/lib/text-align.ts.
alter table tour_deals add column if not exists description_align text;

alter table tour_deals drop constraint if exists tour_deals_description_align_check;

alter table tour_deals
  add constraint tour_deals_description_align_check
  check (description_align is null or description_align in ('left', 'center', 'right', 'justify'));

-- No backfill: null means "no choice was ever made", and every reader already
-- draws that as left, which is what every existing row looks like today.
