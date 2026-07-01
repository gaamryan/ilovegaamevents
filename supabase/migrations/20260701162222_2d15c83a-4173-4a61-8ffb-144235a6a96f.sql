CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_source_url ON public.events (source_url);

CREATE OR REPLACE FUNCTION public.find_similar_events(
  _title text,
  _start_date date,
  _venue_name text DEFAULT NULL,
  _source_url text DEFAULT NULL
)
RETURNS TABLE (id uuid, title text, start_time timestamptz, venue_name text, similarity_score real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.start_time, v.name AS venue_name,
         GREATEST(similarity(e.title, _title),
                  CASE WHEN _source_url IS NOT NULL AND e.source_url = _source_url THEN 1.0 ELSE 0 END)::real AS similarity_score
  FROM public.events e
  LEFT JOIN public.venues v ON v.id = e.venue_id
  WHERE (
    (_source_url IS NOT NULL AND e.source_url = _source_url)
    OR (
      similarity(e.title, _title) > 0.5
      AND e.start_time::date BETWEEN (_start_date - INTERVAL '1 day')::date AND (_start_date + INTERVAL '1 day')::date
    )
  )
  ORDER BY similarity_score DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_events(text, date, text, text) TO authenticated, service_role;