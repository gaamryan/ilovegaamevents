import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EventFilters } from "@/components/events/FilterDrawer";
import type { SortOption } from "@/components/events/SortSelect";
import { startOfDay } from "date-fns";

// Minimal column selections to reduce data transfer
const EVENT_LIST_COLUMNS = `id, slug, title, description, start_time, end_time, image_url, ticket_url, price_min, price_max, is_free, status, source, source_url, featured, is_recurring, recurrence_frequency, created_at, pricing_at_site, is_livestream`;
const VENUE_LIST_COLUMNS = `id, name, city, latitude, longitude`;
const HOST_LIST_COLUMNS = `id, name`;
const CATEGORY_COLUMNS = `id, name, slug, icon, color`;

// Pagination response wrapper
export interface PaginatedResult<T> {
  data: T[];
  count: number | null;
}

// PostgREST's `.or()` filter syntax uses `,` `.` `:` `(` `)` as delimiters
// between conditions, so a raw search term containing them has to be
// backslash-escaped to be treated as literal text instead of breaking (or
// silently changing) the filter.
export function escapeForPostgrestOr(term: string): string {
  return term.replace(/[,.():]/g, (c) => `\\${c}`);
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  image_url: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean | null;
  pricing_at_site: boolean | null;
  is_livestream: boolean | null;
  status: "draft" | "pending" | "approved" | "rejected";
  source: "manual" | "eventbrite" | "meetup" | "ticketspice" | "facebook";
  source_url: string | null;
  featured: boolean | null;
  is_recurring: boolean | null;
  recurrence_frequency: string | null;
  // Only selected by the admin list and single-event queries.
  recurrence_until?: string | null;
  parent_event_id?: string | null;
  created_at: string;
  venue: {
    id: string;
    name: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    // Only selected by the admin list and single-event queries.
    address_line_1?: string | null;
    address_line_2?: string | null;
    state?: string | null;
    postal_code?: string | null;
    map_url?: string | null;
  } | null;
  host: {
    id: string;
    name: string;
    // Only selected by the admin list and single-event queries.
    logo_url?: string | null;
    website_url?: string | null;
  } | null;
  // JOIN table structure
  event_categories: {
    category: Category;
    // Only selected by the admin list and single-event queries.
    auto_assigned?: boolean;
  }[];
}

interface UseApprovedEventsOptions {
  categoryId?: string | null;
  categoryIds?: string[];
  filters?: EventFilters;
  sortBy?: SortOption;
  page?: number;     // 0-indexed
  limit?: number;    // items per page
  search?: string;   // matched server-side against title/description
  enabled?: boolean; // hold the query until inputs (e.g. category slugs) are resolved
}

export function useApprovedEvents(options: UseApprovedEventsOptions = {}) {
  const { categoryId, categoryIds, filters, sortBy = "date_asc", page = 0, limit = 20, search } = options;

  return useQuery({
    queryKey: ["events", "approved", categoryId, categoryIds, filters, sortBy, page, limit, search],
    queryFn: async () => {
      const result = await fetchApprovedEvents({ categoryId, categoryIds, filters, sortBy, page, limit, search });
      return result;
    },
  });
}

async function fetchApprovedEvents({
  categoryId,
  categoryIds,
  filters,
  sortBy = "date_asc",
  page = 0,
  limit = 20,
  search,
}: {
  categoryId?: string | null;
  categoryIds?: string[];
  filters?: EventFilters;
  sortBy?: SortOption;
  page?: number;
  limit?: number;
  search?: string;
}) {
  const hasCategoryFilter = !!(categoryId || (categoryIds && categoryIds.length > 0));

  const selectQuery = hasCategoryFilter
    ? `${EVENT_LIST_COLUMNS}, venue:venues(${VENUE_LIST_COLUMNS}), host:hosts(${HOST_LIST_COLUMNS}), event_categories!inner(category:categories(${CATEGORY_COLUMNS}))`
    : `${EVENT_LIST_COLUMNS}, venue:venues(${VENUE_LIST_COLUMNS}), host:hosts(${HOST_LIST_COLUMNS}), event_categories(category:categories(${CATEGORY_COLUMNS}))`;

  // Location matches venue name or city. Resolved up front so pagination
  // stays full (filtering after the fetch left short or empty pages).
  const locationTerm = filters?.location?.trim();
  let venueIds: string[] | null = null;
  if (locationTerm) {
    const term = escapeForPostgrestOr(locationTerm);
    const { data: venues, error: venueError } = await supabase
      .from("venues")
      .select("id")
      .or(`name.ilike.%${term}%,city.ilike.%${term}%`)
      .limit(200);
    if (venueError) throw venueError;
    venueIds = (venues ?? []).map((v) => v.id);
    if (venueIds.length === 0) return { data: [] as Event[], hasMore: false };
  }

  let query = supabase
    .from("events")
    .select(selectQuery)
    .eq("status", "approved");

  // Fetch one row past the page: if it exists there is a next page. This
  // replaces an exact count, which made the database count every match on
  // every page request.
  const from = page * limit;
  query = query.range(from, from + limit);

  if (venueIds) {
    query = query.in("venue_id", venueIds);
  }
  if (categoryId) {
    query = query.eq("event_categories.category_id", categoryId);
  }
  if (categoryIds && categoryIds.length > 0) {
    query = query.in("event_categories.category_id", categoryIds);
  }

  // Include events that already started but are still running (multi-day
  // markets, festivals): upcoming start, or an end time still in the future.
  const windowStart = (filters?.dateFrom ?? startOfDay(new Date())).toISOString();
  const stillRunningFrom = (filters?.dateFrom ?? new Date()).toISOString();
  const andConditions = [`or(start_time.gte.${windowStart},end_time.gte.${stillRunningFrom})`];
  if (filters?.dateTo) {
    const endOfDay = new Date(filters.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.lte("start_time", endOfDay.toISOString());
  }

  if (filters?.isFree) {
    query = query.eq("is_free", true);
  }
  if (!filters?.isFree) {
    if (filters?.priceMin !== undefined && filters.priceMin > 0) {
      query = query.gte("price_min", filters.priceMin);
    }
    if (filters?.priceMax !== undefined && filters.priceMax < 200) {
      query = query.lte("price_max", filters.priceMax);
    }
  }

  const trimmedSearch = search?.trim();
  if (trimmedSearch && trimmedSearch.length >= 2) {
    const term = escapeForPostgrestOr(trimmedSearch);
    andConditions.push(`or(title.ilike.%${term}%,description.ilike.%${term}%)`);
  }
  // A single `or=(and(...))`: supabase-js has no top-level `and`, and this keeps
  // the date window and search from being read as two competing `or` filters.
  query = query.or(`and(${andConditions.join(",")})`);

  switch (sortBy) {
    case "date_asc":
      query = query.order("start_time", { ascending: true });
      break;
    case "date_desc":
      query = query.order("start_time", { ascending: false });
      break;
    case "price_low":
      query = query.order("price_min", { ascending: true, nullsFirst: false });
      break;
    case "price_high":
      query = query.order("price_max", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as Event[];
  return { data: rows.slice(0, limit), hasMore: rows.length > limit };
}

export function useInfiniteApprovedEvents(options: Omit<UseApprovedEventsOptions, 'page'> = {}) {
  const { categoryId, categoryIds, filters, sortBy = "date_asc", limit = 20, search, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: ["events", "approved", "infinite", categoryId, categoryIds, filters, sortBy, limit, search],
    queryFn: async ({ pageParam = 0 }) => {
      return fetchApprovedEvents({ categoryId, categoryIds, filters, sortBy, page: pageParam, limit, search });
    },
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length : undefined),
  });
}

export function useFeaturedEvents() {
  return useQuery({
    queryKey: ["events", "featured"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select(`
          ${EVENT_LIST_COLUMNS},
          venue:venues(${VENUE_LIST_COLUMNS}),
          host:hosts(${HOST_LIST_COLUMNS}),
          event_categories(
            category:categories(${CATEGORY_COLUMNS})
          )
        `)
        .eq("status", "approved")
        .eq("featured", true)
        // Not "passed": still running (end_time in the future) if it has an
        // end_time, otherwise it just hasn't started yet.
        .or(`end_time.gte.${now},and(end_time.is.null,start_time.gte.${now})`)
        .order("featured_order", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true })
        .limit(3);

      if (error) throw error;
      return data as Event[];
    },
  });
}

export interface FeaturedOrderEvent {
  id: string;
  title: string;
  image_url: string | null;
  start_time: string;
  end_time: string | null;
  featured_order: number | null;
}

// Admin: every currently-featured, not-yet-passed event, for the "Featured
// Order" reorder panel — a superset of what useFeaturedEvents() actually
// shows (that one caps at 3), so admins can see what's queued up next.
export function useFeaturedEventsForOrdering() {
  return useQuery({
    queryKey: ["events", "featured", "admin"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id, title, image_url, start_time, end_time, featured_order")
        .eq("status", "approved")
        .eq("featured", true)
        .or(`end_time.gte.${now},and(end_time.is.null,start_time.gte.${now})`)
        .order("featured_order", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as FeaturedOrderEvent[];
    },
  });
}

export function useReorderFeaturedEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const results = await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from("events").update({ featured_order: index }).eq("id", id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", "featured"] });
    },
    onError: (error) => {
      console.error("Failed to reorder featured events:", error);
    },
  });
}

// Admin: only select columns needed for the list view + edit drawer
const ADMIN_EVENT_COLUMNS = `id, slug, title, description, start_time, end_time, image_url, ticket_url, price_min, price_max, is_free, status, source, source_url, source_id, featured, is_recurring, recurrence_frequency, recurrence_until, parent_event_id, created_at, pricing_at_site, is_livestream, category_id, venue_id, host_id`;

export function useAllEvents(filters?: {
  status?: "draft" | "pending" | "approved" | "rejected";
  source?: "manual" | "eventbrite" | "meetup" | "ticketspice" | "facebook";
  search?: string;
}) {
  return useQuery({
    queryKey: ["events", "all", filters],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select(`
          ${ADMIN_EVENT_COLUMNS},
          venue:venues(${VENUE_LIST_COLUMNS}, address_line_1, address_line_2, state, postal_code, map_url),
          host:hosts(${HOST_LIST_COLUMNS}, logo_url, website_url),
          event_categories(
            auto_assigned,
            category:categories(${CATEGORY_COLUMNS})
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.source) {
        query = query.eq("source", filters.source);
      }
      if (filters?.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Event[];
    },
    staleTime: 2 * 60 * 1000, // 2 min for admin — fresher data needed
  });
}

export function useUpdateEventStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      status,
    }: {
      eventIds: string[];
      status: "approved" | "rejected" | "pending" | "draft";
    }) => {
      const { error } = await supabase
        .from("events")
        .update({
          status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
        })
        .in("id", eventIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useToggleFeatured() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, featured }: { eventId: string; featured: boolean }) => {
      const { error } = await supabase
        .from("events")
        .update({ featured })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      const { error } = await supabase.from("events").delete().in("id", eventIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useBulkUpdateEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      updates,
      categoryIds,
    }: {
      eventIds: string[];
      updates: {
        price_min?: number | null;
        price_max?: number | null;
        is_free?: boolean;
        category_id?: string | null;
      };
      categoryIds?: string[];
    }) => {
      // 1. Update basic fields
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("events")
          .update(updates)
          .in("id", eventIds);
        if (error) throw error;
      }

      // 2. Update Categories (if provided)
      if (categoryIds) {
        // Remove existing associations for these events
        const { error: deleteError } = await supabase
          .from("event_categories")
          .delete()
          .in("event_id", eventIds);

        if (deleteError) throw deleteError;

        // Insert new associations
        if (categoryIds.length > 0) {
          const associations = [];
          for (const eventId of eventIds) {
            for (const catId of categoryIds) {
              associations.push({ event_id: eventId, category_id: catId });
            }
          }
          const { error: insertError } = await supabase.from("event_categories").insert(associations); // auto_assigned defaults to false
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}