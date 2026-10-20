import { describe, it, expect } from "vitest";
import { slugifyCategory, normalizeKeyword, addKeywords, swapSortOrder, isUncategorized } from "./categoryHelpers";

describe("slugifyCategory", () => {
  it("matches the database slug rules", () => {
    expect(slugifyCategory("Arts & Culture")).toBe("arts-culture");
    expect(slugifyCategory("  Food / Drink!! ")).toBe("food-drink");
    expect(slugifyCategory("Cosplay")).toBe("cosplay");
  });
});

describe("keywords", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeKeyword("  Live   Music ")).toBe("live music");
  });
  it("splits on commas and de-duplicates", () => {
    expect(addKeywords(["dj"], "DJ, Open Mic ,, d&d")).toEqual(["dj", "open mic", "d&d"]);
  });
});

describe("swapSortOrder", () => {
  const list = [
    { id: "a", sort_order: 1 },
    { id: "b", sort_order: 2 },
    { id: "c", sort_order: 2 },
  ];
  it("swaps with the neighbor", () => {
    expect(swapSortOrder(list, 1, "up")).toEqual([
      { id: "b", sort_order: 1 },
      { id: "a", sort_order: 2 },
    ]);
  });
  it("cannot move past the ends", () => {
    expect(swapSortOrder(list, 0, "up")).toBeNull();
    expect(swapSortOrder(list, 2, "down")).toBeNull();
  });
  it("nudges when orders are equal", () => {
    expect(swapSortOrder(list, 2, "up")).toEqual([
      { id: "c", sort_order: 2 },
      { id: "b", sort_order: 3 },
    ]);
  });
});

describe("isUncategorized", () => {
  it("is true only with no category links", () => {
    expect(isUncategorized({ event_categories: [] })).toBe(true);
    expect(isUncategorized({})).toBe(true);
    expect(isUncategorized({ event_categories: [{}] })).toBe(false);
  });
});
