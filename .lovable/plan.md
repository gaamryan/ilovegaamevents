
# Admin Event Discovery

Add a new **Discover** tab in the Admin panel that lets you search external platforms (Eventbrite, Facebook, Meetup, web) for events matching keywords / city / date range, preview normalized results, and import selected ones as drafts through the existing import pipeline — with fuzzy duplicate detection against the current database.

## User flow

1. Admin opens **Admin → Discover**.
2. Picks a **source** (Eventbrite, Facebook, Meetup, or Web Search) via tabs/toggle.
3. Enters **keyword**, **city + radius**, **date range**, or clicks a **Category preset** (Nerds & Gaming, Comedy, Table Top, etc.) to prefill keyword sets.
4. Hits Search → results stream in as cards with title, date, venue, source badge, thumbnail, and a **Duplicate** flag if we detect a match already in the DB.
5. Selects one or many results → **Import as Draft** button runs each through the existing `import-event` pipeline. Imported events land in Admin → Events with `status = 'draft'` for final review/editing before approval.

## Sources & how each is queried

| Source | Method |
|---|---|
| **Eventbrite** | Public search page scrape via existing Firecrawl/Jina + Gemini pipeline (Eventbrite killed their public search API). Query built from keyword + Florida city. |
| **Facebook** | No public search. Admin pastes a FB page/group URL (or picks from a saved list of venue/host FB pages), and we scrape upcoming events off that page. |
| **Meetup** | Meetup GraphQL public endpoint via edge function — keyword + lat/lng + radius + date. |
| **Web Search** | Tavily (`TAVILY_API_KEY` already configured) with site filters + date operators; top results piped through Gemini to extract structured event data. |

Admin picks the source per search — no cross-source merging in v1.

## Duplicate detection

For every result, before showing it:
- Exact match on `source_url`.
- Fuzzy match: same-day start (±1 day), title similarity ≥ 0.75 (trigram), same venue name/city.

Results with matches show a yellow **Likely duplicate** badge linking to the existing event; still importable but off by default.

## Import pipeline

Selected results POST to the existing `import-event` edge function (already handles image re-hosting, venue/host upsert, category assignment, sanitization). New wrapper just:
- forces `status = 'draft'`
- passes through the normalized payload from discovery
- returns per-item success/error for the UI

## Category presets

Stored as a small config map (in `src/lib/discovery-presets.ts`):
```
"Nerds & Gaming" → ["anime", "gaming tournament", "cosplay", "comic con", "esports"]
"Comedy"         → ["stand up", "open mic comedy", "comedy show"]
"Table Top"      → ["board game", "D&D", "magic the gathering", "warhammer"]
...
```
Clicking a preset OR-joins terms into the keyword field (admin can edit before searching).

## Technical breakdown

**New edge function: `discover-events`**
- Input: `{ source, keyword, city, radius_miles, date_from, date_to, fb_url? }`
- Dispatches to a per-source handler; each returns a normalized array:
  ```ts
  { source, source_url, title, description, start_time, end_time,
    venue: { name, city, address? }, host: { name }, image_url,
    price_min?, price_max?, is_free? }
  ```
- Runs dedup query (RPC using `pg_trgm` similarity on `events.title`) and attaches `duplicate_of?: event_id` to each result.
- Returns `{ results: [...] }`.

**DB migration**
- Enable `pg_trgm` extension (if not already).
- Add RPC `find_similar_events(title text, start_date date, venue_name text)` returning event IDs — SECURITY DEFINER, callable by authenticated admins only.
- Add GIN trigram index on `events.title` for search performance.

**Frontend**
- New file `src/components/admin/DiscoverTab.tsx` — search form, source selector, results grid, bulk select, import button.
- New hook `src/hooks/useDiscoverEvents.ts` — wraps the edge function.
- New file `src/lib/discovery-presets.ts` — category → keyword map.
- Add "Discover" tab to `src/pages/Admin.tsx` (icon: `Search` or `Radar` from lucide).
- Reuse existing `EventCard`-style layout for result previews, plus a `<Badge>` for source and duplicate state.

**Existing code reused**
- `import-event` edge function (import pipeline, image re-hosting, venue/host upsert)
- Firecrawl/Jina + Gemini extraction from `event-scraping-architecture` memory
- `TAVILY_API_KEY` secret for web search
- Admin auth guard on the page

## Out of scope (v1)

- Auto-scheduled background scans / saved searches (can add later — memory noted).
- Cross-source merging / dedup between two discovery results in the same run.
- Facebook keyword search (not possible without Graph API + Page approval).
- Editing results inline before import — admin edits after import from Events tab (existing flow).

## Deliverables

1. Migration: `pg_trgm` + `find_similar_events` RPC + trigram index.
2. Edge function: `supabase/functions/discover-events/index.ts` + `config.toml` entry (`verify_jwt = false`, auth checked in-function).
3. `src/components/admin/DiscoverTab.tsx`
4. `src/hooks/useDiscoverEvents.ts`
5. `src/lib/discovery-presets.ts`
6. `src/pages/Admin.tsx` — add tab wiring.

Ready to build when you approve.
