-- Lets admins control the order featured events appear in on the homepage
-- "Don't Miss" hero carousel. Null means "no explicit order set" — those
-- events sort after explicitly-ordered ones, by start_time.
alter table events add column if not exists featured_order integer;

create index if not exists events_featured_order_idx
  on events (featured_order)
  where featured = true;
