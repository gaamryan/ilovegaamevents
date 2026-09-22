-- Default value for the "Don't Miss" hero carousel's auto-advance interval,
-- read via useSettings()/hero_slide_interval_ms. Stored in the existing
-- key/value `settings` table (see 20260211000000_create_settings_table.sql)
-- rather than a new table — same public-read / authenticated-write RLS
-- already in place there.
--
-- Not strictly required for the app to work: the admin Settings page
-- upserts this key on first save regardless, and the frontend falls back
-- to 6000ms in code if the row is missing. This just seeds a sensible
-- default so the setting has a value before anyone visits Settings.
insert into public.settings (key, value)
values ('hero_slide_interval_ms', '6000')
on conflict (key) do nothing;
