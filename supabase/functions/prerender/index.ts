import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    renderCategoriesPage,
    renderEventPage,
    renderHomePage,
    renderNotFound,
    type PrerenderEvent,
    type PrerenderListEvent,
} from "./render.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9-]{1,120}$/i;

// Returned as JSON ({ status, html }) rather than HTML: Supabase rewrites
// text/html responses from *.supabase.co to text/plain, so the Cloudflare
// Worker wraps this back into a real HTML response.
const respond = (status: number, html: string) =>
    new Response(JSON.stringify({ status, html }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });

Deno.serve(async (req) => {
    const path = new URL(req.url).searchParams.get("path") || "/";

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The service role bypasses RLS, so every query below is limited to approved events.
    if (path === "/") {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from("events")
            .select("slug, title, description, start_time, is_livestream, venue:venues(name, city)")
            .eq("status", "approved")
            .gte("start_time", cutoff)
            .order("start_time", { ascending: true })
            .limit(100);
        if (error) return new Response("error", { status: 500 });
        return respond(200, renderHomePage((data ?? []) as unknown as PrerenderListEvent[]));
    }

    if (path === "/categories") {
        const { data, error } = await supabase.from("categories").select("name").order("name");
        if (error) return new Response("error", { status: 500 });
        return respond(200, renderCategoriesPage(data ?? []));
    }

    const match = path.match(/^\/events\/([^/]+)$/);
    const slugOrId = match?.[1];
    if (!slugOrId || (!UUID_RE.test(slugOrId) && !SLUG_RE.test(slugOrId))) {
        return respond(404, renderNotFound());
    }

    const { data, error } = await supabase
        .from("events")
        .select(`slug, title, description, start_time, end_time, image_url, ticket_url, source_url,
            price_min, is_free, pricing_at_site, is_livestream,
            venue:venues(name, city, state, address_line_1, address_line_2, postal_code),
            host:hosts(name, website_url),
            event_categories(category:categories(name))`)
        .eq("status", "approved")
        .eq(UUID_RE.test(slugOrId) ? "id" : "slug", slugOrId)
        .maybeSingle();

    if (error) return new Response("error", { status: 500 });
    if (!data) return respond(404, renderNotFound());
    return respond(200, renderEventPage(data as unknown as PrerenderEvent));
});
