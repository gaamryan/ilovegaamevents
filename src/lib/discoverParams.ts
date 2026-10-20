import { endOfDay, format, isValid, parse, startOfDay } from "date-fns";
import type { EventFilters } from "@/components/events/FilterDrawer";
import type { SortOption } from "@/components/events/SortSelect";
import { isUuid } from "@/lib/utils";

export const DEFAULT_SORT: SortOption = "date_asc";
const SORTS: SortOption[] = ["date_asc", "date_desc", "price_low", "price_high"];
const DATE_FORMAT = "yyyy-MM-dd";

/** URL keys owned by the Discover page; anything else (utm_*, etc.) is left alone. */
export const DISCOVER_KEYS = ["q", "category", "from", "to", "free", "loc", "pmin", "pmax", "sort"] as const;

interface CategoryRef {
  id: string;
  slug: string;
}

export interface DiscoverState {
  query: string;
  filters: EventFilters;
  sortBy: SortOption;
}

export interface ParsedDiscover extends DiscoverState {
  /** True while a category slug in the URL can't be resolved yet (categories still loading). */
  categoriesPending: boolean;
}

function parseDay(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = parse(value, DATE_FORMAT, new Date());
  return isValid(date) ? date : undefined;
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseDiscoverParams(params: URLSearchParams, categories: CategoryRef[] | undefined): ParsedDiscover {
  const filters: EventFilters = {};
  let categoriesPending = false;

  const tokens = (params.get("category") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const categoryIds: string[] = [];
  for (const token of tokens) {
    if (isUuid(token)) {
      categoryIds.push(token);
    } else if (!categories) {
      categoriesPending = true;
    } else {
      const match = categories.find((c) => c.slug.toLowerCase() === token.toLowerCase());
      if (match) categoryIds.push(match.id);
    }
  }
  if (categoryIds.length > 0) filters.categoryIds = categoryIds;

  const from = parseDay(params.get("from"));
  const to = parseDay(params.get("to"));
  if (from) filters.dateFrom = startOfDay(from);
  if (to) filters.dateTo = endOfDay(to);

  if (params.get("free") === "1") filters.isFree = true;

  const loc = params.get("loc")?.trim();
  if (loc) filters.location = loc;

  const pmin = parseNumber(params.get("pmin"));
  const pmax = parseNumber(params.get("pmax"));
  if (pmin !== undefined) filters.priceMin = pmin;
  if (pmax !== undefined) filters.priceMax = pmax;

  const sort = params.get("sort") as SortOption | null;

  return {
    query: params.get("q")?.trim() ?? "",
    filters,
    sortBy: sort && SORTS.includes(sort) ? sort : DEFAULT_SORT,
    categoriesPending,
  };
}

/** Returns a copy of `base` with the Discover keys replaced by `state`; defaults stay out of the URL. */
export function serializeDiscoverState(
  state: DiscoverState,
  base: URLSearchParams,
  categories: CategoryRef[] | undefined,
): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const key of DISCOVER_KEYS) next.delete(key);

  const { filters } = state;
  if (state.query.trim()) next.set("q", state.query.trim());
  if (filters.categoryIds?.length) {
    const tokens = filters.categoryIds.map((id) => categories?.find((c) => c.id === id)?.slug ?? id);
    next.set("category", tokens.join(","));
  }
  if (filters.dateFrom) next.set("from", format(filters.dateFrom, DATE_FORMAT));
  if (filters.dateTo) next.set("to", format(filters.dateTo, DATE_FORMAT));
  if (filters.isFree) next.set("free", "1");
  if (filters.location?.trim()) next.set("loc", filters.location.trim());
  if (filters.priceMin !== undefined && filters.priceMin > 0) next.set("pmin", String(filters.priceMin));
  if (filters.priceMax !== undefined && filters.priceMax < 200) next.set("pmax", String(filters.priceMax));
  if (state.sortBy !== DEFAULT_SORT) next.set("sort", state.sortBy);
  return next;
}
