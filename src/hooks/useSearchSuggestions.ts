import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SearchSuggestion {
  id: string;
  label: string;
  type: "event" | "venue";
  subtitle?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function fetchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query || query.length < 2) return [];

  const [eventsRes, venuesRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, venue:venues(name)")
      .eq("status", "approved")
      .ilike("title", `%${query}%`)
      .limit(5),
    supabase
      .from("venues")
      .select("id, name, city")
      .ilike("name", `%${query}%`)
      .limit(3),
  ]);

  const eventSuggestions: SearchSuggestion[] = (eventsRes.data || []).map((e) => ({
    id: e.id,
    label: e.title,
    type: "event" as const,
    subtitle: e.venue?.name,
  }));

  const venueSuggestions: SearchSuggestion[] = (venuesRes.data || []).map((v) => ({
    id: v.id,
    label: v.name,
    type: "venue" as const,
    subtitle: v.city || undefined,
  }));

  return [...eventSuggestions, ...venueSuggestions];
}

export function useSearchSuggestions(query: string) {
  const debouncedQuery = useDebounce(query.trim(), 300);

  return useQuery({
    queryKey: ["search-suggestions", debouncedQuery],
    queryFn: () => fetchSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });
}
