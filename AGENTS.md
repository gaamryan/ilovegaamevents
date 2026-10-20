
- Database migrations are applied via the migration tool (drizzle/migrations) and mirrored byte-for-byte into supabase/migrations with a timestamped name, because the repo history is tracked there.
- Event categories come from event_categories (category pages join on it); auto_assigned=true marks keyword-suggested rows, and admin-saved selections are written with auto_assigned=false.
