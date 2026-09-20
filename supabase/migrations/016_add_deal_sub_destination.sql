-- Store the more specific place selected under a deal's destination division.
-- Existing deals remain valid and continue to display their current destination.
ALTER TABLE tour_deals
  ADD COLUMN IF NOT EXISTS sub_destination TEXT;
