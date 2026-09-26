import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiscoverSource = "eventbrite" | "meetup" | "facebook" | "web";

export interface DiscoveredEvent {
  source: DiscoverSource;
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

export interface DiscoverInput {
  source: DiscoverSource;
  keyword?: string;
  city?: string;
  state?: string;
  date_from?: string;
  date_to?: string;
  fb_url?: string;
}

export function useDiscoverEvents() {
  return useMutation({
    mutationFn: async (input: DiscoverInput): Promise<DiscoveredEvent[]> => {
      const { data, error } = await supabase.functions.invoke("discover-events", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.results || []) as DiscoveredEvent[];
    },
  });
}

export interface ImportDraftInput {
  event: DiscoveredEvent;
}

/**
 * Insert a discovered event directly as a draft. Handles venue/host upsert.
 */
export async function importDiscoveredAsDraft(event: DiscoveredEvent): Promise<{ id: string }> {
  let venue_id: string | null = null;
  let host_id: string | null = null;

  if (event.venue?.name) {
    const { data: existing } = await supabase
      .from("venues")
      .select("id")
      .ilike("name", event.venue.name)
      .maybeSingle();
    if (existing?.id) {
      venue_id = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("venues")
        .insert({
          name: event.venue.name,
          city: event.venue.city || null,
          address_line_1: event.venue.address || null,
        })
        .select("id")
        .single();
      if (!error && inserted) venue_id = inserted.id;
    }
  }

  if (event.host?.name) {
    const { data: existing } = await supabase
      .from("hosts")
      .select("id")
      .ilike("name", event.host.name)
      .maybeSingle();
    if (existing?.id) {
      host_id = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("hosts")
        .insert({ name: event.host.name })
        .select("id")
        .single();
      if (!error && inserted) host_id = inserted.id;
    }
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      title: event.title,
      slug: generateEventSlug(event.title),
      description: event.description || null,
      start_time: event.start_time || new Date().toISOString(),
      end_time: event.end_time || null,
      image_url: event.image_url || null,
      ticket_url: event.source_url,
      price_min: event.price_min ?? null,
      price_max: event.price_max ?? null,
      is_free: event.is_free ?? false,
      status: "draft",
      source: event.source === "web" ? "manual" : event.source,
      source_url: event.source_url,
      venue_id,
      host_id,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}
