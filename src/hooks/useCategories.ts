import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sort_order: number | null;
  description: string | null;
  keywords: string[];
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, icon, color, sort_order, description, keywords")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 10 * 60 * 1000, // categories rarely change — 10 min
  });
}

/** Map of category_id -> number of approved upcoming/ongoing events. */
export function useCategoryUpcomingCounts() {
  return useQuery({
    queryKey: ["category-upcoming-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_upcoming_counts")
        .select("category_id, upcoming_count");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.category_id) map[row.category_id] = row.upcoming_count ?? 0;
      }
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Public surfaces: keep only categories with upcoming events, plus any currently selected.
 * If counts aren't loaded yet, returns the list unchanged.
 */
export function filterCategoriesWithUpcoming<T extends { id: string }>(
  categories: T[] | undefined,
  counts: Record<string, number> | undefined,
  keepIds: (string | null | undefined)[] = []
): T[] {
  if (!categories) return [];
  if (!counts) return categories;
  const keep = new Set(keepIds.filter(Boolean) as string[]);
  return categories.filter((c) => (counts[c.id] ?? 0) > 0 || keep.has(c.id));
}
