import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventbriteData {
  "@type"?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string | { url?: string };
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
  organizer?: {
    name?: string;
    url?: string;
  };
  offers?: {
    price?: number;
    priceCurrency?: string;
    url?: string;
  } | Array<{ price?: number; priceCurrency?: string; url?: string }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user and check admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.log("Admin check failed:", roleError);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate Eventbrite URL
    if (!url.includes("eventbrite.com") && !url.includes("eventbrite.co")) {
      return new Response(JSON.stringify({ error: "Invalid Eventbrite URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Fetching Eventbrite page:", url);

    // Fetch the Eventbrite page
    const pageResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ILoveGAAM/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!pageResponse.ok) {
      console.error("Failed to fetch page:", pageResponse.status);
      return new Response(JSON.stringify({ error: "Failed to fetch Eventbrite page" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await pageResponse.text();

    // Extract JSON-LD data (Eventbrite embeds event data this way)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    
    let eventData: EventbriteData | null = null;

    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        // Handle array of JSON-LD objects
        if (Array.isArray(jsonLd)) {
          eventData = jsonLd.find((item: EventbriteData) => item["@type"] === "Event") || jsonLd[0];
        } else {
          eventData = jsonLd;
        }
        console.log("Extracted JSON-LD event data");
      } catch (e) {
        console.error("Failed to parse JSON-LD:", e);
      }
    }

    // Fallback: Extract from meta tags if JSON-LD fails
    if (!eventData) {
      console.log("Falling back to meta tag extraction");
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
      const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      
      if (titleMatch) {
        eventData = {
          name: titleMatch[1],
          description: descMatch?.[1],
          image: imageMatch?.[1],
        };
      }
    }

    if (!eventData || !eventData.name) {
      return new Response(JSON.stringify({ error: "Could not extract event data from URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract source ID from URL (e.g., /e/event-name-123456789)
    const sourceIdMatch = url.match(/(\d{10,})/);
    const sourceId = sourceIdMatch ? sourceIdMatch[1] : null;

    // Check for duplicate
    if (sourceId) {
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("source", "eventbrite")
        .eq("source_id", sourceId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ 
          error: "Event already imported",
          existingId: existing.id
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Handle venue creation if location data exists
    let venueId: string | null = null;
    if (eventData.location) {
      const venueName = eventData.location.name || "Unknown Venue";
      const address = eventData.location.address;

      // Check for existing venue
      const { data: existingVenue } = await supabase
        .from("venues")
        .select("id")
        .eq("name", venueName)
        .maybeSingle();

      if (existingVenue) {
        venueId = existingVenue.id;
      } else {
        const { data: newVenue, error: venueError } = await supabase
          .from("venues")
          .insert({
            name: venueName,
            address_line_1: address?.streetAddress,
            city: address?.addressLocality,
            state: address?.addressRegion,
            postal_code: address?.postalCode,
            country: address?.addressCountry || "USA",
          })
          .select("id")
          .single();

        if (!venueError && newVenue) {
          venueId = newVenue.id;
          console.log("Created venue:", venueId);
        }
      }
    }

    // Handle host/organizer creation
    let hostId: string | null = null;
    if (eventData.organizer?.name) {
      // Check for existing host
      const { data: existingHost } = await supabase
        .from("hosts")
        .select("id")
        .eq("name", eventData.organizer.name)
        .eq("source", "eventbrite")
        .maybeSingle();

      if (existingHost) {
        hostId = existingHost.id;
      } else {
        const { data: newHost, error: hostError } = await supabase
          .from("hosts")
          .insert({
            name: eventData.organizer.name,
            source: "eventbrite",
            website_url: eventData.organizer.url,
          })
          .select("id")
          .single();

        if (!hostError && newHost) {
          hostId = newHost.id;
          console.log("Created host:", hostId);
        }
      }
    }

    // Parse pricing
    let priceMin: number | null = null;
    let priceMax: number | null = null;
    let isFree = false;
    let ticketUrl: string | null = null;

    if (eventData.offers) {
      const offers = Array.isArray(eventData.offers) ? eventData.offers : [eventData.offers];
      const prices = offers.map((o) => o.price || 0).filter((p) => p >= 0);
      
      if (prices.length > 0) {
        priceMin = Math.min(...prices);
        priceMax = Math.max(...prices);
        isFree = priceMin === 0 && priceMax === 0;
      }
      
      ticketUrl = offers[0]?.url || url;
    }

    // Get image URL
    const imageUrl = typeof eventData.image === "string" 
      ? eventData.image 
      : eventData.image?.url || null;

    // Parse dates
    const startTime = eventData.startDate ? new Date(eventData.startDate).toISOString() : new Date().toISOString();
    const endTime = eventData.endDate ? new Date(eventData.endDate).toISOString() : null;

    // Create the event with pending status
    const { data: newEvent, error: eventError } = await supabase
      .from("events")
      .insert({
        title: eventData.name,
        description: eventData.description || null,
        start_time: startTime,
        end_time: endTime,
        venue_id: venueId,
        host_id: hostId,
        image_url: imageUrl,
        ticket_url: ticketUrl || url,
        price_min: priceMin,
        price_max: priceMax,
        is_free: isFree,
        status: "pending",
        source: "eventbrite",
        source_id: sourceId,
        source_url: url,
      })
      .select(`
        *,
        venue:venues(id, name, city),
        host:hosts(id, name)
      `)
      .single();

    if (eventError) {
      console.error("Error creating event:", eventError);
      return new Response(JSON.stringify({ error: "Failed to create event", details: eventError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Successfully imported event:", newEvent.id);

    return new Response(JSON.stringify({ 
      success: true, 
      event: newEvent,
      message: "Event imported and pending approval"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
