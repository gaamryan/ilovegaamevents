import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSitemapXml } from "./xml.ts";

const SITE_URL = Deno.env.get("SITE_URL") || "https://ilovegaam.com";

Deno.serve(async () => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Keep events that ended recently so just-finished pages don't vanish instantly.
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const [eventsRes, categoriesRes, countsRes] = await Promise.all([
        supabase
            .from("events")
            .select("slug, updated_at")
            .eq("status", "approved")
            .gte("start_time", cutoff)
            .order("start_time", { ascending: true })
            .limit(5000),
        supabase.from("categories").select("id, slug"),
        supabase.from("category_upcoming_counts").select("category_id, upcoming_count"),
    ]);

    if (eventsRes.error || categoriesRes.error || countsRes.error) {
        return new Response("Failed to build sitemap", { status: 500 });
    }

    const withEvents = new Set((countsRes.data ?? []).filter((c) => (c.upcoming_count ?? 0) > 0).map((c) => c.category_id));
    const categorySlugs = (categoriesRes.data ?? []).filter((c) => withEvents.has(c.id)).map((c) => c.slug);

    return new Response(buildSitemapXml({ siteUrl: SITE_URL, events: eventsRes.data ?? [], categorySlugs }), {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
});
