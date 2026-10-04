import { describe, expect, it } from "vitest";
import {
    renderEventPage,
    renderHomePage,
    renderNotFound,
    type PrerenderEvent,
} from "../../supabase/functions/prerender/render";

const event: PrerenderEvent = {
    slug: "game-night-abc123",
    title: 'Game <Night> & "Friends"',
    description: "<p>Bring friends</p>\nSecond line",
    start_time: "2026-11-01T23:00:00Z",
    end_time: null,
    image_url: "https://example.com/a.jpg",
    ticket_url: "https://tickets.example.com",
    source_url: null,
    price_min: 10,
    is_free: false,
    pricing_at_site: false,
    is_livestream: false,
    venue: { name: "The Venue", city: "Jacksonville", state: "FL", address_line_1: "1 Main St", address_line_2: null, postal_code: "32202" },
    host: { name: "Host Co", website_url: null },
    event_categories: [{ category: { name: "Gaming" } }],
};

describe("prerender pages", () => {
    it("renders event content, canonical and JSON-LD as real HTML", () => {
        const html = renderEventPage(event);
        expect(html).toContain('<link rel="canonical" href="https://ilovegaam.com/events/game-night-abc123"');
        expect(html).toContain("The Venue");
        expect(html).toContain("Hosted by Host Co");
        expect(html).toContain('"@type":"Event"');
        expect(html).toContain("Sunday, November 1, 2026");
    });

    it("escapes event text so it cannot inject markup", () => {
        const html = renderEventPage(event);
        expect(html).not.toContain("<Night>");
        expect(html).toContain("Game &lt;Night&gt; &amp; &quot;Friends&quot;");
    });

    it("lists upcoming events on the home page with slug links", () => {
        const html = renderHomePage([
            { slug: "x-1", title: "X", description: null, start_time: "2026-11-01T23:00:00Z", is_livestream: true, venue: null },
        ]);
        expect(html).toContain('href="https://ilovegaam.com/events/x-1"');
        expect(html).toContain("Online livestream");
    });

    it("marks missing events noindex", () => {
        expect(renderNotFound()).toContain('content="noindex"');
    });
});
