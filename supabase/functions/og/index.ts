import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Discordbot|WhatsApp|TelegramBot|Googlebot|iMessageLinkPreview|Applebot/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("id");

  if (!eventId) {
    return new Response("Missing event id", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: event, error } = await supabase
    .from("events")
    .select("slug, title, description, image_url, start_time")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) {
    return new Response("Event not found", { status: 404, headers: corsHeaders });
  }

  const description = (event.description || event.title || "")
    .replace(/<[^>]*>?/gm, "")
    .substring(0, 200);

  const siteUrl = Deno.env.get("SITE_URL") || "https://ilovegaam.com";
  const eventUrl = `${siteUrl}/events/${event.slug || eventId}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(event.title)} | GAAM Events</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(event.title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="event" />
  <meta property="og:url" content="${escapeHtml(eventUrl)}" />
  ${event.image_url ? `<meta property="og:image" content="${escapeHtml(event.image_url)}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(event.title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${event.image_url ? `<meta name="twitter:image" content="${escapeHtml(event.image_url)}" />` : ""}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(eventUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(eventUrl)}">${escapeHtml(event.title)}</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
