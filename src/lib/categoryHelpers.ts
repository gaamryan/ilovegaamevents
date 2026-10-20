// Pure helpers for category admin + auto-categorization UI.

/** Mirrors the database slugify(): lowercase, non-alphanumerics -> single dash, trimmed. */
export function slugifyCategory(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Trim, lowercase, collapse inner whitespace. */
export function normalizeKeyword(k: string): string {
  return (k || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Add comma-separated input to an existing list, normalized and de-duplicated (order kept). */
export function addKeywords(existing: string[], input: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...existing, ...(input || "").split(",")]) {
    const k = normalizeKeyword(raw);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export interface Orderable {
  id: string;
  sort_order: number | null;
}

/**
 * Move item at `index` up or down by swapping sort_order with its neighbor.
 * Returns the two updates to persist, or null when the move isn't possible.
 * If both share the same sort_order, the moved item is nudged so order actually changes.
 */
export function swapSortOrder(
  list: Orderable[],
  index: number,
  direction: "up" | "down"
): { id: string; sort_order: number }[] | null {
  const otherIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= list.length || otherIndex < 0 || otherIndex >= list.length) return null;
  const a = list[index];
  const b = list[otherIndex];
  const aOrder = a.sort_order ?? index;
  const bOrder = b.sort_order ?? otherIndex;
  if (aOrder === bOrder) {
    return direction === "up"
      ? [{ id: a.id, sort_order: bOrder }, { id: b.id, sort_order: bOrder + 1 }]
      : [{ id: a.id, sort_order: bOrder + 1 }, { id: b.id, sort_order: bOrder }];
  }
  return [
    { id: a.id, sort_order: bOrder },
    { id: b.id, sort_order: aOrder },
  ];
}

/** An event counts as uncategorized when it has no event_categories rows. */
export function isUncategorized(event: { event_categories?: unknown[] | null }): boolean {
  return !event.event_categories || event.event_categories.length === 0;
}
