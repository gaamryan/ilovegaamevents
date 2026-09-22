import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isUuid } from "@/lib/utils";
import type { Event } from "./useEvents";

/**
 * Looks an event up by its public slug (the normal case, e.g. from
 * /events/:slug) or by its raw id (legacy links, and Admin's ?edit=<id>
 * deep link) — whichever `slugOrId` looks like.
 */
export function useSingleEvent(slugOrId: string | undefined) {
  return useQuery({
    queryKey: ["event", slugOrId],
    queryFn: async () => {
      if (!slugOrId) throw new Error("Event slug or ID is required");

      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          venue:venues(id, name, city, address_line_1, address_line_2, state, postal_code, map_url, latitude, longitude),
          host:hosts(id, name, logo_url, website_url),
          event_categories(
            category:categories(id, name, slug, icon, color)
          )
        `)
        .eq(isUuid(slugOrId) ? "id" : "slug", slugOrId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Event not found");

      return data as unknown as Event;
    },
    enabled: !!slugOrId,
  });
}
