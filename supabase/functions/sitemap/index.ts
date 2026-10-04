import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") || "https://ilovegaam.com";

const escapeXml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async () => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Keep events that ended recently so just-finished pages don't vanish instantly.
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await supabase
        .from("events")
        .select("slug, updated_at")
        .eq("status", "approved")
        .gte("start_time", cutoff)
        .order("start_time", { ascending: true })
        .limit(5000);

    if (error) {
        return new Response("Failed to build sitemap", { status: 500 });
    }

    const urls = [
        `<url><loc>${SITE_URL}/</loc></url>`,
        `<url><loc>${SITE_URL}/categories</loc></url>`,
        ...(events ?? [])
            .filter((e) => e.slug)
            .map((e) => {
                const lastmod = e.updated_at ? `<lastmod>${new Date(e.updated_at).toISOString()}</lastmod>` : "";
                return `<url><loc>${escapeXml(`${SITE_URL}/events/${e.slug}`)}</loc>${lastmod}</url>`;
            }),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
});
