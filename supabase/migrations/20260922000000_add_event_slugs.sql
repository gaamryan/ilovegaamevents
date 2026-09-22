-- SEO-friendly event URLs: adds a stable, human-readable `slug` column to
-- `events`, generated once at insert time from the title plus a short
-- suffix from the event's own id (so it's guaranteed unique without any
-- collision-checking logic, and never has to change if the title is edited
-- later).
--
-- Format: "<slugified-title>-<first 8 chars of id>", e.g.
--   "ancient-city-con-2026-3f9a1e22"

-- 1. The column itself.
alter table events add column if not exists slug text;

-- 2. Slugify helper: lowercase, non-alphanumeric runs become a single "-",
--    leading/trailing "-" trimmed.
create or replace function slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )
  );
$$;

-- 3. Trigger: set slug once, only if not already set, on insert. Title
--    edits after creation do NOT change the slug — the URL should stay
--    stable once it's been shared or indexed.
create or replace function set_event_slug()
returns trigger
language plpgsql
as $$
declare
  base text;
begin
  if new.slug is null then
    base := substr(slugify(new.title), 1, 60);
    if base = '' then
      new.slug := substr(new.id::text, 1, 8);
    else
      new.slug := base || '-' || substr(new.id::text, 1, 8);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_event_slug on events;
create trigger trg_set_event_slug
  before insert on events
  for each row
  execute function set_event_slug();

-- 4. Backfill existing rows using the same rule.
update events
set slug = case
  when substr(slugify(title), 1, 60) = '' then substr(id::text, 1, 8)
  else substr(slugify(title), 1, 60) || '-' || substr(id::text, 1, 8)
end
where slug is null;

-- 5. Uniqueness + fast lookup by slug, and lock the column down now that
--    every row has one.
create unique index if not exists events_slug_key on events(slug);
alter table events alter column slug set not null;
