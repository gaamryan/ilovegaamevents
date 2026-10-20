-- Keyword fixes found by testing against the upcoming events:
--  * "smash" matched the band Smash Mouth; "tournament" pulled card-game and sports events into Video Games.
--  * Missed: TCG / Magic nights, live-music venues, art markets and painting sessions.
UPDATE public.categories SET keywords = (
  SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(
    array_remove(array_remove(keywords, 'smash'), 'tournament') || ARRAY['super smash','smash bros','smash circuit']
  ) AS k
) WHERE slug = 'video-games';

UPDATE public.categories SET keywords = (SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(keywords || ARRAY[
  'tcg','commander','friday night magic','fnm','clocktower','riftbound','one piece','yu-gi-oh','flesh and blood']) AS k)
WHERE slug = 'table-top';

UPDATE public.categories SET keywords = (SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(keywords || ARRAY[
  'amphitheater','amphitheatre','music hall','soundstage','jazz','tribute','live at']) AS k)
WHERE slug = 'music';

UPDATE public.categories SET keywords = (SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(keywords || ARRAY[
  'arts market','artwalk','sketching','painting','art association','art festival']) AS k)
WHERE slug = 'arts-culture';

UPDATE public.categories SET keywords = (SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(keywords || ARRAY[
  'conversation']) AS k)
WHERE slug = 'educational';
