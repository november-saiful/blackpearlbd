-- Bilingual tour-deal content.
--
-- Each deal keeps its existing canonical columns as the fallback (and as the
-- value older clients read), and gains an English and a Bengali copy of every
-- piece of prose. `itinerary` phases and `route_waypoints` entries carry their
-- own `*_en` / `*_bn` keys because both are jsonb.
--
-- Existing rows are backfilled by script detection: Bengali copy goes to the
-- `_bn` column, everything else to `_en`. The other language stays null, so a
-- deal written in one language still renders in both views via the fallback
-- chain (_en -> _bn -> canonical / _bn -> _en -> canonical).
--
-- Fresh-DB safe: every statement is additive and guard-checked.

alter table public.tour_deals
  add column if not exists title_en text,
  add column if not exists title_bn text,
  add column if not exists short_description_en text,
  add column if not exists short_description_bn text,
  add column if not exists description_en text,
  add column if not exists description_bn text,
  add column if not exists inclusions_en jsonb,
  add column if not exists inclusions_bn jsonb,
  add column if not exists exclusions_en jsonb,
  add column if not exists exclusions_bn jsonb;

/* ------------------------------------------------------------------ */
/* 1. Backfill top-level prose                                        */
/* ------------------------------------------------------------------ */

update public.tour_deals
set
  title_en = case
    when title_en is null and title_bn is null and coalesce(title, '') <> '' and title !~ '[ঀ-৿]' then title
    else title_en
  end,
  title_bn = case
    when title_en is null and title_bn is null and title ~ '[ঀ-৿]' then title
    else title_bn
  end,
  short_description_en = case
    when short_description_en is null and short_description_bn is null
      and coalesce(short_description, '') <> '' and short_description !~ '[ঀ-৿]' then short_description
    else short_description_en
  end,
  short_description_bn = case
    when short_description_en is null and short_description_bn is null
      and coalesce(short_description, '') <> '' and short_description ~ '[ঀ-৿]' then short_description
    else short_description_bn
  end,
  description_en = case
    when description_en is null and description_bn is null
      and coalesce(description, '') <> '' and description !~ '[ঀ-৿]' then description
    else description_en
  end,
  description_bn = case
    when description_en is null and description_bn is null
      and coalesce(description, '') <> '' and description ~ '[ঀ-৿]' then description
    else description_bn
  end;

/* Lists are jsonb arrays; detect the script from their rendered text. */
update public.tour_deals
set
  inclusions_en = case
    when inclusions_en is null and inclusions_bn is null
      and jsonb_typeof(inclusions) = 'array' and inclusions <> '[]'::jsonb
      and inclusions::text !~ '[ঀ-৿]' then inclusions
    else inclusions_en
  end,
  inclusions_bn = case
    when inclusions_en is null and inclusions_bn is null
      and jsonb_typeof(inclusions) = 'array' and inclusions <> '[]'::jsonb
      and inclusions::text ~ '[ঀ-৿]' then inclusions
    else inclusions_bn
  end,
  exclusions_en = case
    when exclusions_en is null and exclusions_bn is null
      and jsonb_typeof(exclusions) = 'array' and exclusions <> '[]'::jsonb
      and exclusions::text !~ '[ঀ-৿]' then exclusions
    else exclusions_en
  end,
  exclusions_bn = case
    when exclusions_en is null and exclusions_bn is null
      and jsonb_typeof(exclusions) = 'array' and exclusions <> '[]'::jsonb
      and exclusions::text ~ '[ঀ-৿]' then exclusions
    else exclusions_bn
  end;

/* ------------------------------------------------------------------ */
/* 2. Backfill itinerary phase titles and descriptions                */
/* ------------------------------------------------------------------ */

update public.tour_deals d
set itinerary = (
  select jsonb_agg(
    case
      when jsonb_typeof(phase) <> 'object' then phase
      else phase || jsonb_strip_nulls(jsonb_build_object(
        'title_en', case
          when not (phase ? 'title_en') and coalesce(phase->>'title', '') <> ''
            and phase->>'title' !~ '[ঀ-৿]' then phase->>'title'
        end,
        'title_bn', case
          when not (phase ? 'title_bn') and coalesce(phase->>'title', '') <> ''
            and phase->>'title' ~ '[ঀ-৿]' then phase->>'title'
        end,
        'description_en', case
          when not (phase ? 'description_en') and coalesce(phase->>'description', '') <> ''
            and phase->>'description' !~ '[ঀ-৿]' then phase->>'description'
        end,
        'description_bn', case
          when not (phase ? 'description_bn') and coalesce(phase->>'description', '') <> ''
            and phase->>'description' ~ '[ঀ-৿]' then phase->>'description'
        end
      ))
    end
    order by ordinality
  )
  from jsonb_array_elements(d.itinerary) with ordinality as steps(phase, ordinality)
)
where jsonb_typeof(d.itinerary) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(d.itinerary) as steps(phase)
    where jsonb_typeof(phase) = 'object'
      and (not (phase ? 'title_en') or not (phase ? 'title_bn'))
  );

/* ------------------------------------------------------------------ */
/* 3. Backfill route-waypoint names                                   */
/* ------------------------------------------------------------------ */

update public.tour_deals d
set route_waypoints = (
  select jsonb_agg(
    case
      when jsonb_typeof(point) <> 'object' then point
      else point || jsonb_strip_nulls(jsonb_build_object(
        'name_en', case
          when not (point ? 'name_en') and coalesce(point->>'name', '') <> ''
            and point->>'name' !~ '[ঀ-৿]' then point->>'name'
        end,
        'name_bn', case
          when not (point ? 'name_bn') and coalesce(point->>'name', '') <> ''
            and point->>'name' ~ '[ঀ-৿]' then point->>'name'
        end
      ))
    end
    order by ordinality
  )
  from jsonb_array_elements(d.route_waypoints) with ordinality as points(point, ordinality)
)
where jsonb_typeof(d.route_waypoints) = 'array'
  and jsonb_array_length(d.route_waypoints) > 0;
