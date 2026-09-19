-- Reviews & Ratings System
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. REVIEWS TABLE
-- ============================================================
create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  deal_id uuid references tour_deals(id) on delete cascade not null,
  booking_id uuid references bookings(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  title text not null,
  body text not null,
  is_approved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, deal_id)
);

-- ============================================================
-- 2. DENORMALIZED RATING STATS ON tour_deals
-- ============================================================
alter table tour_deals
  add column if not exists avg_rating numeric(3,2) default 0,
  add column if not exists review_count int default 0;

-- ============================================================
-- 3. AUTO-UPDATE TRIGGER for avg_rating / review_count
-- ============================================================
create or replace function update_deal_rating_stats()
returns trigger as $$
declare
  target_deal_id uuid;
begin
  -- Determine which deal to update
  if TG_OP = 'DELETE' then
    target_deal_id := OLD.deal_id;
  else
    target_deal_id := NEW.deal_id;
  end if;

  update tour_deals
  set
    avg_rating = coalesce((
      select round(avg(r.rating), 2)
      from reviews r
      where r.deal_id = target_deal_id and r.is_approved = true
    ), 0),
    review_count = (
      select count(*)
      from reviews r
      where r.deal_id = target_deal_id and r.is_approved = true
    )
  where id = target_deal_id;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$ language plpgsql;

create trigger on_review_change
  after insert or update or delete on reviews
  for each row execute procedure update_deal_rating_stats();

-- ============================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_review_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger on_review_update
  before update on reviews
  for each row execute procedure update_review_updated_at();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
alter table reviews enable row level security;

-- Everyone can read approved reviews
create policy "Public can read approved reviews"
  on reviews for select
  using (is_approved = true);

-- Users can read their own reviews (even unapproved)
create policy "Users can read own reviews"
  on reviews for select
  using (auth.uid() = user_id);

-- Authenticated users can insert their own reviews
create policy "Users can create own reviews"
  on reviews for insert
  with check (auth.uid() = user_id);

-- Users can update their own reviews
create policy "Users can update own reviews"
  on reviews for update
  using (auth.uid() = user_id);

-- Users can delete their own reviews
create policy "Users can delete own reviews"
  on reviews for delete
  using (auth.uid() = user_id);

-- Admins can manage all reviews
create policy "Admins can manage reviews"
  on reviews for all
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));
