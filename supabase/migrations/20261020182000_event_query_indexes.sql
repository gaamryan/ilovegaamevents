-- Indexes for the public feed: approved events by date, category lookups, and
-- substring search (the feed filters with ilike '%term%').
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_events_approved_start
  ON public.events (start_time)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_event_categories_category
  ON public.event_categories (category_id, event_id);

CREATE INDEX IF NOT EXISTS idx_events_title_trgm
  ON public.events USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_description_trgm
  ON public.events USING gin (description gin_trgm_ops);
