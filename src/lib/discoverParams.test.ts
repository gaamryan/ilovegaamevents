import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { legacyCategoryRedirect, parseDiscoverParams, serializeDiscoverState } from "./discoverParams";

const ID_A = "11111111-1111-4111-8111-111111111111";
const categories = [
  { id: ID_A, slug: "music" },
  { id: "22222222-2222-4222-8222-222222222222", slug: "table-top" },
];

describe("parseDiscoverParams", () => {
  it("returns defaults for an empty URL", () => {
    const parsed = parseDiscoverParams(new URLSearchParams(), categories);
    expect(parsed).toEqual({ query: "", filters: {}, sortBy: "date_asc", categoriesPending: false });
  });

  it("resolves category slugs and raw ids, dropping unknown slugs", () => {
    const parsed = parseDiscoverParams(new URLSearchParams(`category=table-top,${ID_A},nope`), categories);
    expect(parsed.filters.categoryIds).toEqual(["22222222-2222-4222-8222-222222222222", ID_A]);
  });

  it("flags slugs as pending until categories load", () => {
    const parsed = parseDiscoverParams(new URLSearchParams("category=music"), undefined);
    expect(parsed.categoriesPending).toBe(true);
    expect(parsed.filters.categoryIds).toBeUndefined();
  });

  it("covers whole days so the date chips still match", () => {
    const { filters } = parseDiscoverParams(new URLSearchParams("from=2026-11-01&to=2026-11-02"), categories);
    expect(filters.dateFrom?.getHours()).toBe(0);
    expect(filters.dateTo?.getHours()).toBe(23);
  });

  it("ignores invalid values", () => {
    const parsed = parseDiscoverParams(new URLSearchParams("from=garbage&sort=weird&pmin=-4&free=yes"), categories);
    expect(parsed.filters).toEqual({});
    expect(parsed.sortBy).toBe("date_asc");
  });
});

describe("serializeDiscoverState", () => {
  it("round-trips filters, search and sort", () => {
    const base = new URLSearchParams("category=music&q=smash+night&free=1&loc=Decca+Live&from=2026-11-01&to=2026-11-03&sort=price_low&pmin=10");
    const parsed = parseDiscoverParams(base, categories);
    const out = serializeDiscoverState(parsed, new URLSearchParams(), categories);
    expect(Object.fromEntries(out)).toEqual({
      category: "music",
      q: "smash night",
      free: "1",
      loc: "Decca Live",
      from: "2026-11-01",
      to: "2026-11-03",
      sort: "price_low",
      pmin: "10",
    });
    expect(format(parsed.filters.dateTo!, "yyyy-MM-dd")).toBe("2026-11-03");
  });

  it("keeps defaults out of the URL and preserves unrelated params", () => {
    const out = serializeDiscoverState(
      { query: "", filters: { priceMax: 200 }, sortBy: "date_asc" },
      new URLSearchParams("utm_source=ig&q=old&sort=date_desc"),
      categories,
    );
    expect(out.toString()).toBe("utm_source=ig");
  });
});

describe("legacyCategoryRedirect", () => {
  it("sends old single-category links to the category page, keeping utm params", () => {
    expect(legacyCategoryRedirect(new URLSearchParams(`category=${ID_A}`), categories)).toBe("/categories/music");
    expect(legacyCategoryRedirect(new URLSearchParams("category=Table-Top&utm_source=ig"), categories)).toBe(
      "/categories/table-top?utm_source=ig",
    );
  });

  it("leaves filtered or multi-category Discover URLs alone", () => {
    expect(legacyCategoryRedirect(new URLSearchParams("category=music&free=1"), categories)).toBeNull();
    expect(legacyCategoryRedirect(new URLSearchParams("category=music,table-top"), categories)).toBeNull();
    expect(legacyCategoryRedirect(new URLSearchParams("category=nope"), categories)).toBeNull();
    expect(legacyCategoryRedirect(new URLSearchParams("category=music"), undefined)).toBeNull();
  });
});
