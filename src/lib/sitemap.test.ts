import { describe, expect, it } from "vitest";
import { buildSitemapXml } from "../../supabase/functions/sitemap/xml";
import { renderCategoryPage, renderCategoriesPage } from "../../supabase/functions/prerender/render";

describe("sitemap", () => {
  const xml = buildSitemapXml({
    siteUrl: "https://ilovegaam.com",
    events: [{ slug: "jazz-night-1", updated_at: "2026-10-01T00:00:00Z" }, { slug: null, updated_at: null }],
    categorySlugs: ["music", "table-top"],
  });

  it("includes category URLs next to events", () => {
    expect(xml).toContain("<loc>https://ilovegaam.com/categories/music</loc>");
    expect(xml).toContain("<loc>https://ilovegaam.com/categories/table-top</loc>");
    expect(xml).toContain("<loc>https://ilovegaam.com/events/jazz-night-1</loc>");
  });

  it("skips events with no slug", () => {
    expect(xml.match(/\/events\//g)?.length).toBe(1);
  });
});

describe("prerendered category pages", () => {
  const category = { slug: "music", name: "Music", icon: "🎵", description: "Live bands." };

  it("renders a canonical, indexable page with its events", () => {
    const html = renderCategoryPage(category, [
      { slug: "jazz-1", title: "Jazz Night", description: null, start_time: "2026-11-01T23:00:00Z", is_livestream: false, venue: null },
    ]);
    expect(html).toContain('href="https://ilovegaam.com/categories/music"');
    expect(html).toContain("Jazz Night");
    expect(html).toContain('content="index,follow"');
  });

  it("marks an empty category noindex", () => {
    const html = renderCategoryPage(category, []);
    expect(html).toContain("No upcoming Music events yet.");
    expect(html).toContain('content="noindex"');
  });

  it("links the categories index to each category page", () => {
    expect(renderCategoriesPage([category])).toContain('href="https://ilovegaam.com/categories/music"');
  });
});
