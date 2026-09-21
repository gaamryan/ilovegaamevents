import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventData {
    title: string;
    description: string;
    start_time: string;
    end_time: string | null;
    image_url: string | null;
    ticket_url: string | null;
    price_min: number | null;
    price_max: number | null;
    is_free: boolean | null;
    status: "draft" | "pending" | "approved" | "rejected";
    source: "manual" | "eventbrite" | "meetup" | "ticketspice" | "facebook" | "instagram" | "startgg";
    source_url: string;
    is_series: boolean;
    dates: string[];
    organizer?: string;
    location?: string;
    address?: string;
    google_maps_link?: string;
    _warnings?: string[];
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { url } = await req.json();

        if (!url) {
            throw new Error("URL is required");
        }

        console.log(`Processing URL: ${url}`);

        let eventData: Partial<EventData> = {
            source_url: url,
            status: "draft",
            source: "manual",
            start_time: new Date().toISOString(),
            is_free: false,
            price_min: null,
            price_max: null,
            end_time: null,
            is_series: false,
            dates: [],
        };

        // Determine source
        if (url.includes("eventbrite.com")) eventData.source = "eventbrite";
        else if (url.includes("meetup.com")) eventData.source = "meetup";
        else if (url.includes("facebook.com")) eventData.source = "facebook";
        else if (url.includes("ticketspice.com")) eventData.source = "ticketspice";
        else if (url.includes("instagram.com")) eventData.source = "instagram";
        else if (url.includes("start.gg")) eventData.source = "startgg";

        let parsingSuccessful = false;

        // Strategy 1: Direct Fetch (Best for JSON-LD and Meta Tags)
        // Facebook and Instagram block bots, so skip direct fetch for them
        if (eventData.source !== "facebook" && eventData.source !== "instagram" && eventData.source !== "startgg") {
            try {
                console.log("Attempting direct fetch...");
                const response = await fetch(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
                    },
                });

                if (response.ok) {
                    const html = await response.text();
                    if (!html.includes("Security Check") && !html.includes("challenge")) {
                        const parsedData = parseHtml(html, url);
                        eventData = { ...eventData, ...parsedData };
                        if (eventData.title) {
                            parsingSuccessful = true;
                            console.log("Direct fetch successful");
                        }
                    }
                }
            } catch (e) {
                console.warn("Direct fetch failed, falling back to proxy:", e);
            }
        }

        // Strategy 2: Jina AI Proxy (Fallback for blocked sites & default for Facebook/Instagram)
        if (!parsingSuccessful) {
            console.log("Attempting Jina AI proxy...");
            const jinaUrl = `https://r.jina.ai/${url}`;
            const response = await fetch(jinaUrl, {
                headers: {
                    "Accept": "application/json",
                },
            });

            if (response.ok) {
                const data = await response.json();
                const jinaData = data.data || data;

                if (jinaData && jinaData.title) {
                    eventData.title = jinaData.title;
                    if (jinaData.description) eventData.description = jinaData.description;

                    const content = jinaData.content || "";

                    // Image extraction — Instagram-specific: use absolute URL of first post image
                    if (eventData.source === "instagram") {
                        // For Instagram, extract all image URLs and pick the first full-size one
                        // Instagram CDN images typically contain these patterns
                        const allImages = [...content.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)];
                        // Filter to actual content images (skip tiny icons, profile pics, etc.)
                        const postImages = allImages.filter(m => {
                            const imgUrl = m[1];
                            // Instagram CDN images are usually from scontent or fbcdn
                            const isInstaCdn = /scontent|cdninstagram|fbcdn/i.test(imgUrl);
                            // Skip small/icon images
                            const isSmall = /s150x150|s320x320|s64x64|\/s\d{2,3}x/i.test(imgUrl);
                            // Skip profile pictures
                            const isProfile = /profile.pic|\/p\/\d+x\d+\//i.test(imgUrl);
                            return (isInstaCdn && !isSmall && !isProfile) || /\.(jpg|jpeg|png|webp)/i.test(imgUrl);
                        });

                        if (postImages.length > 0) {
                            // Use the first post image (first carousel image or single post image)
                            eventData.image_url = postImages[0][1];
                            console.log(`Instagram: Using absolute image URL: ${eventData.image_url}`);
                        } else if (allImages.length > 0) {
                            // Fallback to first image found
                            eventData.image_url = allImages[0][1];
                        }

                        // Also try og:image as fallback
                        if (!eventData.image_url) {
                            const ogMatch = content.match(/og:image["\s]*content=["']([^"']+)["']/i);
                            if (ogMatch?.[1]) eventData.image_url = ogMatch[1];
                        }
                    } else {
                        const ogImageMatch = content.match(/og:image["\s]*content=["']([^"']+)["']/i);
                        if (ogImageMatch && ogImageMatch[1]) {
                            eventData.image_url = ogImageMatch[1];
                        } else {
                            const allImages = [...content.matchAll(/!\[.*?\]\((.*?)\)/g)];
                            const coverImage = allImages.find(m =>
                                /header|hero|cover|banner|featured|event|poster|og[-_]?image/i.test(m[1])
                            );
                            if (coverImage) {
                                eventData.image_url = coverImage[1];
                            } else if (allImages.length > 0) {
                                eventData.image_url = allImages[0][1];
                            }
                        }
                    }

                    // Facebook specific cleanup
                    if (eventData.source === "facebook" && eventData.title) {
                        if (eventData.title.includes("Log into Facebook") || eventData.title.includes("Facebook")) {
                            // Try to regex title from content if possible
                        }
                    }

                    parsingSuccessful = true;
                    console.log("Jina fetch successful");

                    // Strategy 3: AI extraction for Instagram posts
                    if (eventData.source === "instagram" && content) {
                        console.log("Instagram detected — sending content to AI for extraction...");
                        try {
                            const aiParsed = await extractEventWithAI(content, url, "instagram");
                            if (aiParsed) {
                                // Merge AI fields, preferring AI results but keeping image from Jina
                                const jinaImage = eventData.image_url;
                                eventData = { ...eventData, ...aiParsed };
                                // Keep Jina image if AI didn't find one
                                if (!eventData.image_url && jinaImage) {
                                    eventData.image_url = jinaImage;
                                }
                                console.log("AI extraction successful for Instagram");
                            }
                            // For Instagram, use the source URL as the ticket URL
                            eventData.ticket_url = url;
                        } catch (aiErr) {
                            console.warn("AI extraction failed, using Jina data as fallback:", aiErr);
                        }
                    }

                    // Strategy 3b: AI extraction for start.gg tournaments
                    if (eventData.source === "startgg" && content) {
                        console.log("start.gg detected — sending content to AI for extraction...");
                        try {
                            const aiParsed = await extractEventWithAI(content, url, "startgg");
                            if (aiParsed) {
                                const jinaImage = eventData.image_url;
                                eventData = { ...eventData, ...aiParsed };
                                if (!eventData.image_url && jinaImage) {
                                    eventData.image_url = jinaImage;
                                }
                                console.log("AI extraction successful for start.gg");
                            }
                            // Use source URL as ticket URL for registration
                            eventData.ticket_url = url;
                        } catch (aiErr) {
                            console.warn("AI extraction failed for start.gg, using Jina data as fallback:", aiErr);
                        }

                        // Extract start.gg cover image from content if not already found
                        if (!eventData.image_url) {
                            const startggImageMatch = content.match(/(https:\/\/images\.start\.gg\/images\/[^\s)]+)/i);
                            if (startggImageMatch) {
                                eventData.image_url = startggImageMatch[1];
                                console.log(`start.gg: Found cover image: ${eventData.image_url}`);
                            }
                        }
                    }
                }
            }
        }

        // ─── Payload Validation ────────────────────────────────────────────
        const warnings: string[] = [];

        if (!eventData.title || eventData.title.trim().length === 0) {
            eventData.title = "New Event (Import Failed)";
            warnings.push("Title could not be extracted");
        }

        if (!eventData.description || eventData.description.trim().length === 0) {
            warnings.push("Description is missing");
        }

        // Validate start_time is a real date
        if (!eventData.start_time || isNaN(Date.parse(eventData.start_time))) {
            eventData.start_time = new Date().toISOString();
            warnings.push("Start time could not be parsed, defaulting to now");
        }

        // Validate end_time if present
        if (eventData.end_time && isNaN(Date.parse(eventData.end_time))) {
            eventData.end_time = null;
            warnings.push("End time was invalid, removed");
        }

        // Validate image_url is a proper URL
        if (eventData.image_url) {
            try {
                new URL(eventData.image_url);
            } catch {
                eventData.image_url = null;
                warnings.push("Image URL was malformed, removed");
            }
        }

        // Validate ticket_url if present
        if (eventData.ticket_url) {
            try {
                new URL(eventData.ticket_url);
            } catch {
                eventData.ticket_url = null;
                warnings.push("Ticket URL was malformed, removed");
            }
        }

        // Validate prices are non-negative numbers
        if (eventData.price_min !== null && eventData.price_min !== undefined) {
            eventData.price_min = Number(eventData.price_min);
            if (isNaN(eventData.price_min) || eventData.price_min < 0) {
                eventData.price_min = null;
                warnings.push("Invalid price_min, removed");
            }
        }
        if (eventData.price_max !== null && eventData.price_max !== undefined) {
            eventData.price_max = Number(eventData.price_max);
            if (isNaN(eventData.price_max) || eventData.price_max < 0) {
                eventData.price_max = null;
                warnings.push("Invalid price_max, removed");
            }
        }

        // Sanitize title/description length
        if (eventData.title && eventData.title.length > 500) {
            eventData.title = eventData.title.substring(0, 500);
            warnings.push("Title was truncated to 500 chars");
        }
        if (eventData.description && eventData.description.length > 10000) {
            eventData.description = eventData.description.substring(0, 10000);
            warnings.push("Description was truncated to 10000 chars");
        }

        if (warnings.length > 0) {
            console.warn("Import validation warnings:", warnings);
            eventData._warnings = warnings;
        }

        return new Response(JSON.stringify(eventData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

// ─── AI Extraction for Instagram & start.gg ───────────────────────────────────

async function extractEventWithAI(content: string, sourceUrl: string, platform: "instagram" | "startgg" = "instagram"): Promise<Partial<EventData> | null> {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
        console.error("LOVABLE_API_KEY not configured, skipping AI extraction");
        return null;
    }

    // Truncate content to avoid token limits (larger for start.gg which has more data)
    const truncatedContent = content.substring(0, platform === "startgg" ? 12000 : 8000);

    const systemPrompt = platform === "startgg"
        ? `You are an expert at extracting tournament/event information from start.gg tournament pages. Today's date is ${new Date().toISOString().split('T')[0]}.

start.gg is a gaming tournament platform. Tournament pages contain tournament name, date ranges, full street addresses, descriptions with schedules and entry fees, cover images, and sub-events (game brackets).

Parse date ranges carefully. "Aug 14th -- 16th, 2026" means start Aug 14 end Aug 16. Extract entry/venue fees as pricing. Clean up descriptions - remove attendee lists and navigation but keep schedule, rules, and key details. List sub-events/games in the description.

Return ONLY valid JSON, no markdown, no code fences.`
        : `You are an expert at extracting event information from Instagram posts. Extract structured event details from the provided post content. Today's date is ${new Date().toISOString().split('T')[0]}.

When dates are relative (e.g. "this Friday", "tomorrow"), resolve them relative to today's date. If no year is specified, assume the nearest upcoming occurrence.

Return ONLY valid JSON, no markdown, no code fences.`;

    const userPrompt = platform === "startgg"
        ? `Extract tournament details from this start.gg page. Return JSON with these fields (use null if unknown):

{
  "title": "tournament name",
  "description": "tournament description with schedule and key details",
  "start_time": "ISO 8601 datetime",
  "end_time": "ISO 8601 datetime or null",
  "location": "venue name",
  "address": "full street address (street, city, state, zip)",
  "organizer": "tournament organizer name",
  "ticket_url": "registration URL if found",
  "price_min": number or null,
  "price_max": number or null,
  "is_free": boolean,
  "image_url": "cover/banner image URL (prefer images.start.gg URLs)"
}

start.gg page content:
${truncatedContent}`
        : `Extract event details from this Instagram post content. Return a JSON object with these fields (use null for any field you cannot determine):

{
  "title": "event name/title",
  "description": "event description (clean, without hashtags)",
  "start_time": "ISO 8601 datetime string",
  "end_time": "ISO 8601 datetime string or null",
  "location": "venue name",
  "address": "full street address",
  "organizer": "host/organizer name",
  "ticket_url": "URL for tickets if mentioned",
  "price_min": number or null,
  "price_max": number or null,
  "is_free": boolean
}

Instagram post content:
${truncatedContent}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            tools: [
                {
                    type: "function",
                    function: {
                        name: "extract_event",
                        description: `Extract structured event data from a ${platform === "startgg" ? "start.gg tournament page" : "social media post"}`,
                        parameters: {
                            type: "object",
                            properties: {
                                title: { type: "string", description: "Event/tournament name" },
                                description: { type: "string", description: "Event description with key details" },
                                start_time: { type: "string", description: "ISO 8601 datetime for event start" },
                                end_time: { type: "string", description: "ISO 8601 datetime for event end, or null" },
                                location: { type: "string", description: "Venue or location name" },
                                address: { type: "string", description: "Full street address" },
                                organizer: { type: "string", description: "Host or organizer name" },
                                ticket_url: { type: "string", description: "URL for tickets/registration" },
                                price_min: { type: "number", description: "Minimum price/entry fee" },
                                price_max: { type: "number", description: "Maximum price/entry fee" },
                                is_free: { type: "boolean", description: "Whether the event is free" },
                                image_url: { type: "string", description: "Cover/banner image URL" }
                            },
                            required: ["title"],
                            additionalProperties: false
                        }
                    }
                }
            ],
            tool_choice: { type: "function", function: { name: "extract_event" } },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`AI gateway error ${response.status}:`, errText);
        return null;
    }

    const result = await response.json();

    // Extract from tool call response
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
        try {
            const parsed = typeof toolCall.function.arguments === "string"
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

            const eventFields: Partial<EventData> = {};
            if (parsed.title) eventFields.title = parsed.title;
            if (parsed.description) eventFields.description = parsed.description;
            if (parsed.start_time) eventFields.start_time = parsed.start_time;
            if (parsed.end_time) eventFields.end_time = parsed.end_time;
            if (parsed.location) eventFields.location = parsed.location;
            if (parsed.address) eventFields.address = parsed.address;
            if (parsed.organizer) eventFields.organizer = parsed.organizer;
            if (parsed.ticket_url) eventFields.ticket_url = parsed.ticket_url;
            if (parsed.price_min !== undefined && parsed.price_min !== null) eventFields.price_min = parsed.price_min;
            if (parsed.price_max !== undefined && parsed.price_max !== null) eventFields.price_max = parsed.price_max;
            if (parsed.is_free !== undefined) eventFields.is_free = parsed.is_free;
            if (parsed.image_url) eventFields.image_url = parsed.image_url;

            // Generate Google Maps link
            if (parsed.address || parsed.location) {
                const query = parsed.address || parsed.location;
                eventFields.google_maps_link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
            }

            return eventFields;
        } catch (parseErr) {
            console.error("Failed to parse AI tool call response:", parseErr);
        }
    }

    return null;
}

// ─── HTML Parser ───────────────────────────────────────────────────────────────

function parseHtml(html: string, url: string) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return {};

    const getMeta = (property: string) => {
        const tag = doc.querySelector(`meta[property="${property}"]`) ||
            doc.querySelector(`meta[name="${property}"]`);
        return tag?.getAttribute("content") || null;
    };

    let title = getMeta("og:title") || doc.querySelector("title")?.textContent || "";
    let description = getMeta("og:description") || getMeta("description") || "";
    let image_url = getMeta("og:image");
    let start_time = new Date().toISOString();
    let end_time: string | null = null;
    let is_series = false;
    let dates: string[] = [];
    let organizer: string | undefined = undefined;
    let location: string | undefined = undefined;
    let address: string | undefined = undefined;
    let google_maps_link: string | undefined = undefined;

    let price_min: number | null = null;
    let price_max: number | null = null;
    let is_free: boolean = false;

    if (title) title = title.replace(" | Eventbrite", "").replace(" | Meetup", "");

    // JSON-LD extraction
    const scriptTags = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scriptTags) {
        try {
            const content = script.textContent;
            if (content) {
                const json = JSON.parse(content);
                const items = Array.isArray(json) ? json : [json];
                const eventSchema = items.find(i => i["@type"] === "Event" || i["@type"]?.includes("Event"));

                if (eventSchema) {
                    if (eventSchema.name) title = eventSchema.name;
                    if (eventSchema.description) description = eventSchema.description;
                    if (eventSchema.startDate) start_time = eventSchema.startDate;
                    if (eventSchema.endDate) end_time = eventSchema.endDate;

                    if (eventSchema.image) {
                        const img = eventSchema.image;
                        image_url = Array.isArray(img) ? img[0] : (typeof img === 'string' ? img : img.url);
                    }

                    if (eventSchema.location) {
                        const loc = eventSchema.location;
                        if (loc.name) location = loc.name;
                        if (loc.address) {
                            if (typeof loc.address === 'string') {
                                address = loc.address;
                            } else if (typeof loc.address === 'object') {
                                const parts = [
                                    loc.address.streetAddress,
                                    loc.address.addressLocality,
                                    loc.address.addressRegion,
                                    loc.address.postalCode
                                ].filter(Boolean);
                                address = parts.join(", ");
                            }
                        }
                    }

                    if (eventSchema.organizer) {
                        if (typeof eventSchema.organizer === 'string') {
                            organizer = eventSchema.organizer;
                        } else if (eventSchema.organizer.name) {
                            organizer = eventSchema.organizer.name;
                        }
                    }

                    if (eventSchema.subEvent && Array.isArray(eventSchema.subEvent)) {
                        is_series = true;
                        dates = eventSchema.subEvent
                            .map((e: { startDate?: string }) => e.startDate)
                            .filter((d: string) => d)
                            .sort();
                    }

                    if (eventSchema.offers) {
                        const offers = Array.isArray(eventSchema.offers) ? eventSchema.offers : [eventSchema.offers];
                        type Offer = { price?: number; lowPrice?: number; highPrice?: number };
                        const lowPriceOffer = offers.sort((a: Offer, b: Offer) => (a.price || a.lowPrice || 0) - (b.price || b.lowPrice || 0))[0];
                        const highPriceOffer = offers.sort((a: Offer, b: Offer) => (b.price || b.highPrice || 0) - (a.price || a.lowPrice || 0))[0];

                        if (lowPriceOffer) {
                            const min = lowPriceOffer.lowPrice || lowPriceOffer.price;
                            if (min !== undefined) {
                                price_min = parseFloat(min);
                                if (price_min === 0) is_free = true;
                            }
                        }

                        if (highPriceOffer) {
                            const max = highPriceOffer.highPrice || highPriceOffer.price;
                            if (max !== undefined) {
                                price_max = parseFloat(max);
                            }
                        }

                        if (price_min === 0 && price_max === 0) is_free = true;
                    }

                    break;
                }
            }
        } catch (e) {
            // ignore parse errors
        }
    }

    if (address || location) {
        const query = address || location;
        if (query) {
            google_maps_link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        }
    }

    return {
        title, description, image_url, start_time, end_time,
        is_series, dates, organizer, location, address, google_maps_link
    };
}
