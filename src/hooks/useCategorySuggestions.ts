import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CategorySuggestion {
  category_id: string;
  slug: string;
  matched_keyword: string;
}

export async function fetchCategorySuggestions(
  title: string,
  venue?: string | null,
  host?: string | null
): Promise<CategorySuggestion[]> {
  if (!title?.trim()) return [];
  const { data, error } = await supabase.rpc("suggest_categories", {
    _title: title,
    _venue: venue || undefined,
    _host: host || undefined,
  });
  if (error) {
    console.error("suggest_categories failed", error);
    return [];
  }
  return (data ?? []) as CategorySuggestion[];
}

/** Debounced (~400ms) keyword-based category suggestions. */
export function useCategorySuggestions(title: string, venue?: string | null, host?: string | null, delay = 400) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await fetchCategorySuggestions(title, venue, host);
      if (!cancelled) setSuggestions(res);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [title, venue, host, delay]);
  return suggestions;
}
