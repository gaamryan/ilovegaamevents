ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.event_categories ADD COLUMN IF NOT EXISTS auto_assigned boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key_idx ON public.categories(slug);
CREATE UNIQUE INDEX IF NOT EXISTS event_categories_event_category_idx ON public.event_categories(event_id, category_id);

INSERT INTO public.categories (name, slug, icon, color, sort_order)
VALUES ('Cosplay','cosplay','🦸','#D946EF',104)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.categories c SET description = v.d, keywords = v.k
FROM (VALUES
 ('music','Live bands, DJs, and open mics. Find your next favorite noise.', ARRAY['karaoke','concert','live music','band','dj','open mic','jam session','album release','orchestra','symphony','acoustic']),
 ('sports','Games, tournaments, and rec leagues, whether you''re swinging or cheering.', ARRAY['football','basketball','baseball','soccer','hockey','golf','5k','10k','marathon','run club','fun run','pickleball','roller derby','jaguars','icemen','jumbo shrimp']),
 ('arts-culture','Gallery nights, art walks, theater, and makers making things.', ARRAY['art walk','gallery','exhibit','exhibition','museum','theater','theatre','ballet','art show','craft fair','makers market','open studio','poetry','film screening','art market','draw together']),
 ('food-drink','Pop-ups, tastings, and brewery nights. Come hungry.', ARRAY['food truck','tasting','brewery','beer','wine','cocktail','brunch','pop-up','popup','bbq','taco','coffee','farmers market','cook-off']),
 ('tech','Meetups, workshops, and demos for people who build stuff.', ARRAY['hackathon','coding','developer','developers','startup','cybersecurity','tech talk','data science']),
 ('wellness','Yoga, fitness, and mindful hangs to recharge your battery.', ARRAY['yoga','meditation','mindfulness','fitness','pilates','sound bath','wellness','breathwork','tai chi']),
 ('community','Meetups, volunteer days, and fundraisers. Good people doing good things.', ARRAY['volunteer','fundraiser','charity','town hall','neighborhood','cleanup','clean-up','food drive','toy drive','networking']),
 ('nightlife','Themed nights, late sets, and after-dark adventures.', ARRAY['nightlife','nightclub','night club','rave','glowrave','after party','afterparty','bar crawl','pub crawl','dance party','late night','21+']),
 ('nerds-gaming','Cons, fandom meetups, and game nights. Your people are here.', ARRAY['anime','manga','comic','comics','comic con','con','fandom','convention','sci-fi','geek','nerd','star wars','pokemon','pokémon','gundam']),
 ('comedy','Stand-up, improv, and open mics. Warning: laughing may occur.', ARRAY['comedy','comedian','stand-up','standup','stand up','improv','roast','open mic comedy']),
 ('table-top','Board games, D&D, and card nights. Roll for initiative.', ARRAY['d&d','dnd','dungeons & dragons','dungeons and dragons','tabletop','table top','board game','board games','rpg','magic: the gathering','mtg','warhammer','pathfinder','card game','trading card','lorcana','miniatures']),
 ('video-games','Tournaments, LAN nights, and retro arcade runs. Player two, join in.', ARRAY['esports','e-sports','tournament','smash','fgc','street fighter','tekken','mario kart','lan party','lan night','retro gaming','speedrun','fortnite','valorant','overwatch','minecraft','game night','gaming','video game','video games']),
 ('educational','Classes, talks, and workshops. Learn something new tonight.', ARRAY['class','classes','workshop','lecture','seminar','course','tutorial','masterclass','lesson','learn to']),
 ('cosplay','Cons, costume contests, and cosplay nights out. Suit up.', ARRAY['cosplay','costume','costumes','masquerade'])
) AS v(s,d,k)
WHERE c.slug = v.s;

CREATE OR REPLACE FUNCTION public.suggest_categories(_title text, _venue text DEFAULT NULL, _host text DEFAULT NULL)
RETURNS TABLE(category_id uuid, slug text, matched_keyword text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH hay AS (
    SELECT lower(concat_ws(' ', coalesce(_title,''), coalesce(_venue,''), coalesce(_host,''))) AS h
  ),
  m AS (
    SELECT c.id, c.slug, kw, c.sort_order
    FROM public.categories c, unnest(c.keywords) AS kw, hay
    WHERE kw <> '' AND hay.h ~ ('(^|[^[:alnum:]])' || regexp_replace(lower(kw), '([\.\^\$\*\+\?\(\)\[\]\{\}\|\\/-])', '\\\1', 'g') || '([^[:alnum:]]|$)')
  )
  SELECT DISTINCT ON (m.id) m.id, m.slug, m.kw
  FROM m ORDER BY m.id, length(m.kw) DESC;
$$;

CREATE OR REPLACE FUNCTION public.auto_categorize_event(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n integer := 0; t text; vn text; hn text;
BEGIN
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

CREATE OR REPLACE FUNCTION public.trg_auto_categorize_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.source IS DISTINCT FROM 'manual'::event_source THEN
    PERFORM public.auto_categorize_event(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_events_auto_categorize ON public.events;
CREATE TRIGGER trg_events_auto_categorize AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_categorize_event();

CREATE OR REPLACE FUNCTION public.auto_categorize_uncategorized(_upcoming_only boolean DEFAULT true)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; total integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  FOR r IN
    SELECT e.id FROM public.events e
    WHERE e.status IS DISTINCT FROM 'rejected'::event_status
      AND NOT EXISTS (SELECT 1 FROM public.event_categories ec WHERE ec.event_id = e.id)
      AND (NOT _upcoming_only OR e.end_time >= now() OR (e.end_time IS NULL AND e.start_time >= date_trunc('day', now())))
  LOOP
    IF public.auto_categorize_event(r.id) > 0 THEN total := total + 1; END IF;
  END LOOP;
  RETURN total;
END; $$;

CREATE OR REPLACE FUNCTION public.preview_auto_categorization(_upcoming_only boolean DEFAULT true)
RETURNS TABLE(event_id uuid, title text, start_time timestamptz, suggested jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN QUERY
  SELECT e.id, e.title, e.start_time, s.j
  FROM public.events e
  LEFT JOIN public.venues v ON v.id = e.venue_id
  LEFT JOIN public.hosts h ON h.id = e.host_id
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('category_id', x.category_id, 'slug', x.slug, 'matched_keyword', x.matched_keyword)) AS j
    FROM public.suggest_categories(e.title, v.name, h.name) x
  ) s
  WHERE e.status IS DISTINCT FROM 'rejected'::event_status
    AND NOT EXISTS (SELECT 1 FROM public.event_categories ec WHERE ec.event_id = e.id)
    AND (NOT _upcoming_only OR e.end_time >= now() OR (e.end_time IS NULL AND e.start_time >= date_trunc('day', now())))
    AND s.j IS NOT NULL
  ORDER BY e.start_time;
END; $$;

REVOKE EXECUTE ON FUNCTION public.auto_categorize_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_categorize_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.suggest_categories(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_categorize_uncategorized(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_auto_categorization(boolean) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.category_upcoming_counts WITH (security_invoker = true) AS
SELECT c.id AS category_id,
  (SELECT count(DISTINCT e.id) FROM public.events e
   WHERE e.status = 'approved'::event_status
     AND (e.end_time >= now() OR (e.end_time IS NULL AND e.start_time >= date_trunc('day', now())))
     AND (e.category_id = c.id OR EXISTS (SELECT 1 FROM public.event_categories ec WHERE ec.event_id = e.id AND ec.category_id = c.id))
  )::integer AS upcoming_count
FROM public.categories c;

GRANT SELECT ON public.category_upcoming_counts TO anon, authenticated;
GRANT SELECT ON public.categories, public.event_categories, public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories, public.event_categories TO authenticated;
GRANT ALL ON public.categories, public.event_categories TO service_role;

INSERT INTO public.event_categories (event_id, category_id, auto_assigned)
SELECT e.id, c.id, true FROM public.events e, public.categories c
WHERE c.slug = 'cosplay' AND e.status = 'approved'::event_status AND e.title ILIKE '%cosplay%'
ON CONFLICT DO NOTHING;