CREATE OR REPLACE FUNCTION public.auto_categorize_event(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n integer := 0; t text; vn text; hn text;
BEGIN
  -- Signed-in callers must be admins; trigger/service contexts (no auth user) are allowed.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_categories WHERE event_id = _event_id) THEN RETURN 0; END IF;
  SELECT e.title, v.name, h.name INTO t, vn, hn
  FROM public.events e LEFT JOIN public.venues v ON v.id = e.venue_id LEFT JOIN public.hosts h ON h.id = e.host_id
  WHERE e.id = _event_id;
  IF t IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.event_categories (event_id, category_id, auto_assigned)
  SELECT _event_id, s.category_id, true FROM public.suggest_categories(t, vn, hn) s
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;