-- Gallery images that should NOT appear in the deal-page carousel.
-- The array holds the same URL strings that live in `gallery`; the carousel
-- component filters them out while the admin form and itinerary/wallpaper
-- pickers still show the full list.
alter table tour_deals
  add column hidden_gallery jsonb default '[]';
