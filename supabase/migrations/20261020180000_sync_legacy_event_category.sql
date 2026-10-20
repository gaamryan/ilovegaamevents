-- events.category_id (legacy single category) is still written by importers and
-- scouting, but the site filters and counts via event_categories. Copy the legacy
-- value into event_categories, keep new writes in sync, and count from one place.

INSERT INTO public.event_categories (event_id, category_id, auto_assigned)
SELECT e.id, e.category_id, false
FROM public.events e
WHERE e.category_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_sync_legacy_event_category()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    INSERT INTO public.event_categories (event_id, category_id, auto_assigned)
    VALUES (NEW.id, NEW.category_id, false)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- Name sorts before trg_events_auto_categorize so a legacy category wins over keyword guesses.
DROP TRIGGER IF EXISTS trg_events_a_sync_legacy_category ON public.events;
CREATE TRIGGER trg_events_a_sync_legacy_category
AFTER INSERT OR UPDATE OF category_id ON public.events
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_legacy_event_category();

CREATE OR REPLACE VIEW public.category_upcoming_counts WITH (security_invoker = true) AS
SELECT c.id AS category_id,
  (SELECT count(DISTINCT e.id) FROM public.events e
   JOIN public.event_categories ec ON ec.event_id = e.id
   WHERE ec.category_id = c.id
     AND e.status = 'approved'::event_status
     AND (e.end_time >= now() OR (e.end_time IS NULL AND e.start_time >= date_trunc('day', now())))
  )::integer AS upcoming_count
FROM public.categories c;

GRANT SELECT ON public.category_upcoming_counts TO anon, authenticated;
