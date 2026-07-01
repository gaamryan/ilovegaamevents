import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Source = "eventbrite" | "meetup" | "facebook" | "web";

interface DiscoverInput {
  source: Source;
  keyword?: string;
  city?: string;
  state?: string;
  date_from?: string;
  date_to?: string;
  fb_url?: string;
}

interface DiscoveredEvent {
  source: Source;
  source_url: string;
  title: string;
  description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  venue?: { name?: string; city?: string; address?: string } | null;
  host?: { name?: string } | null;
  image_url?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  is_free?: boolean | null;
  duplicate_of?: { id: string; title: string; score: number } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    // Verify admin
    const { data: isAdminData } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdminData) return json({ error: "Admin only" }, 403);

    const body = (await req.json()) as DiscoverInput;
    const { source, keyword = "", city = "", state = "FL", date_from, date_to, fb_url } = body;

    console.log("Discover:", { source, keyword, city, state, date_from, date_to, fb_url });

    let results: DiscoveredEvent[] = [];

    if (source === "eventbrite") {
      results = await discoverEventbrite(keyword, city, state, date_from, date_to);
    } else if (source === "meetup") {
      results = await discoverMeetup(keyword, city, state, date_from, date_to);
    } else if (source === "facebook") {
      if (!fb_url) return json({ error: "Facebook URL required" }, 400);
      results = await discoverFacebook(fb_url);
    } else if (source === "web") {
      results = await discoverWeb(keyword, city, state, date_from, date_to);
    } else {
      return json({ error: "Unknown source" }, 400);
    }

    // Duplicate detection via SECURITY DEFINER RPC using service role (bypasses RLS if needed)
    const admin = createClient(supabaseUrl, serviceKey);
    for (const r of results) {
      try {
        const startDate = r.start_time ? new Date(r.start_time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const { data: sim } = await admin.rpc("find_similar_events", {
          _title: r.title,
          _start_date: startDate,
          _venue_name: r.venue?.name || null,
          _source_url: r.source_url || null,
        });
        if (sim && sim.length > 0) {
          r.duplicate_of = { id: sim[0].id, title: sim[0].title, score: sim[0].similarity_score };
        }
      } catch (e) {
        console.warn("dedup rpc failed", e);
      }
    }

    return json({ results });
  } catch (err: any) {
    console.error("discover-events error", err);
    return json({ error: err?.message || "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Source handlers ───────────────────────────────────────────────

async function discoverEventbrite(keyword: string, city: string, dateFrom?: string, dateTo?: string): Promise<DiscoveredEvent[]> {
  // Eventbrite public search: use their public HTML search page + Jina proxy for readability
  const q = encodeURIComponent(keyword || "events");
  const loc = encodeURIComponent(city ? `${city}--fl` : "florida");
  const searchUrl = `https://www.eventbrite.com/d/${loc}/${q}/`;
  const jinaUrl = `https://r.jina.ai/${searchUrl}`;

  try {
    const res = await fetch(jinaUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const content: string = data?.data?.content || data?.content || "";
    // Extract eventbrite event URLs
    const urls = Array.from(new Set(
      [...content.matchAll(/https:\/\/www\.eventbrite\.com\/e\/[a-z0-9-]+-tickets-\d+/gi)].map(m => m[0])
    )).slice(0, 20);

    if (urls.length === 0) return [];

    return await extractManyWithAI(urls, "eventbrite", { dateFrom, dateTo });
  } catch (e) {
    console.warn("eventbrite discovery failed", e);
    return [];
  }
}

async function discoverMeetup(keyword: string, city: string, dateFrom?: string, dateTo?: string): Promise<DiscoveredEvent[]> {
  const q = encodeURIComponent(keyword || "");
  const loc = encodeURIComponent(city ? `${city}, FL` : "Florida");
  const searchUrl = `https://www.meetup.com/find/?keywords=${q}&location=${loc}&source=EVENTS`;
  const jinaUrl = `https://r.jina.ai/${searchUrl}`;

  try {
    const res = await fetch(jinaUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const content: string = data?.data?.content || data?.content || "";
    const urls = Array.from(new Set(
      [...content.matchAll(/https:\/\/www\.meetup\.com\/[^\/\s)]+\/events\/\d+/gi)].map(m => m[0])
    )).slice(0, 20);

    if (urls.length === 0) return [];
    return await extractManyWithAI(urls, "meetup", { dateFrom, dateTo });
  } catch (e) {
    console.warn("meetup discovery failed", e);
    return [];
  }
}

async function discoverFacebook(pageUrl: string): Promise<DiscoveredEvent[]> {
  // Scrape a FB page/group for upcoming events
  const eventsUrl = pageUrl.replace(/\/?$/, "/events");
  const jinaUrl = `https://r.jina.ai/${eventsUrl}`;
  try {
    const res = await fetch(jinaUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const content: string = data?.data?.content || data?.content || "";
    const urls = Array.from(new Set(
      [...content.matchAll(/https:\/\/(?:www\.)?facebook\.com\/events\/\d+/gi)].map(m => m[0])
    )).slice(0, 15);
    if (urls.length === 0) return [];
    return await extractManyWithAI(urls, "facebook");
  } catch (e) {
    console.warn("facebook discovery failed", e);
    return [];
  }
}

async function discoverWeb(keyword: string, city: string, dateFrom?: string, dateTo?: string): Promise<DiscoveredEvent[]> {
  const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
  if (!TAVILY_API_KEY) {
    console.warn("TAVILY_API_KEY missing");
    return [];
  }
  const query = `${keyword} events ${city || "Florida"}`.trim();
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 15,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const urls: string[] = (data.results || []).map((r: any) => r.url).filter(Boolean).slice(0, 12);
    if (urls.length === 0) return [];
    return await extractManyWithAI(urls, "web", { dateFrom, dateTo });
  } catch (e) {
    console.warn("web discovery failed", e);
    return [];
  }
}

// ─── AI extraction for a batch of URLs ───────────────────────────

async function extractManyWithAI(
  urls: string[],
  sourceLabel: Source | "web",
  opts: { dateFrom?: string; dateTo?: string } = {}
): Promise<DiscoveredEvent[]> {
  const results: DiscoveredEvent[] = [];
  // limit concurrency
  const chunkSize = 4;
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const settled = await Promise.allSettled(chunk.map(u => extractOneWithAI(u, sourceLabel)));
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value && s.value.title) results.push(s.value);
    }
  }
  // Optional date filter
  if (opts.dateFrom || opts.dateTo) {
    const from = opts.dateFrom ? new Date(opts.dateFrom).getTime() : 0;
    const to = opts.dateTo ? new Date(opts.dateTo).getTime() + 86400000 : Infinity;
    return results.filter(r => {
      if (!r.start_time) return true;
      const t = new Date(r.start_time).getTime();
      return t >= from && t <= to;
    });
  }
  return results;
}

async function extractOneWithAI(url: string, sourceLabel: Source | "web"): Promise<DiscoveredEvent | null> {
  try {
    const jina = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "application/json" } });
    if (!jina.ok) return null;
    const data = await jina.json();
    const content: string = (data?.data?.content || data?.content || "").slice(0, 8000);
    const jinaTitle: string = data?.data?.title || data?.title || "";
    if (!content) return null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return null;

    const prompt = `Extract event details as JSON from this page. Today's date: ${new Date().toISOString().slice(0, 10)}.
Return ONLY this JSON, no markdown:
{
  "title": string,
  "description": string,
  "start_time": ISO 8601 string or null,
  "end_time": ISO 8601 string or null,
  "venue_name": string or null,
  "venue_city": string or null,
  "venue_address": string or null,
  "host_name": string or null,
  "image_url": string or null,
  "price_min": number or null,
  "price_max": number or null,
  "is_free": boolean
}

Page title: ${jinaTitle}
URL: ${url}

Content:
${content}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You extract structured event data. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!aiRes.ok) return null;
    const aiJson = await aiRes.json();
    const text: string = aiJson?.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed: any = null;
    try { parsed = JSON.parse(cleaned); } catch { return null; }
    if (!parsed?.title) return null;

    const finalSource: Source = sourceLabel === "web"
      ? (url.includes("eventbrite.com") ? "eventbrite"
        : url.includes("meetup.com") ? "meetup"
        : url.includes("facebook.com") ? "facebook"
        : "web")
      : sourceLabel;

    return {
      source: finalSource,
      source_url: url,
      title: String(parsed.title).slice(0, 500),
      description: parsed.description || null,
      start_time: parsed.start_time || null,
      end_time: parsed.end_time || null,
      venue: parsed.venue_name ? { name: parsed.venue_name, city: parsed.venue_city, address: parsed.venue_address } : null,
      host: parsed.host_name ? { name: parsed.host_name } : null,
      image_url: parsed.image_url || null,
      price_min: parsed.price_min ?? null,
      price_max: parsed.price_max ?? null,
      is_free: parsed.is_free ?? null,
    };
  } catch (e) {
    console.warn("extractOneWithAI failed", url, e);
    return null;
  }
}
