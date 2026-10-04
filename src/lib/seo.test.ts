import { describe, expect, it } from "vitest";
import { buildEventJsonLd, serializeJsonLd } from "./seo";
import type { Event } from "@/hooks/useEvents";

const base = {
    id: "1",
    slug: "game-night-abc123",
    title: "Game Night",
    description: "<p>Bring <b>friends</b></p>",
    start_time: "2026-11-01T23:00:00Z",
    end_time: null,
    image_url: "https://example.com/a.jpg",
    ticket_url: "tickets.example.com",
    price_min: 10,
    is_free: false,
    is_livestream: false,
    venue: { name: "The Venue", city: "Jacksonville", state: "FL", address_line_1: "1 Main St", address_line_2: null, postal_code: "32202" },
    host: { name: "Host Co", website_url: "https://host.example" },
} as unknown as Event;

describe("buildEventJsonLd", () => {
    it("builds an in-person event with a postal address and offer", () => {
        const ld = buildEventJsonLd(base);
        expect(ld.url).toBe("https://ilovegaam.com/events/game-night-abc123");
        expect(ld.description).toBe("Bring friends");
        expect(ld.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
        expect(ld.location).toMatchObject({ "@type": "Place", name: "The Venue" });
        expect(ld.offers).toMatchObject({ price: 10, url: ld.url });
    });

    it("uses a virtual location for livestreams and price 0 for free events", () => {
        const ld = buildEventJsonLd({ ...base, is_livestream: true, is_free: true, ticket_url: "https://twitch.tv/x" } as Event);
        expect(ld.eventAttendanceMode).toBe("https://schema.org/OnlineEventAttendanceMode");
        expect(ld.location).toEqual({ "@type": "VirtualLocation", url: "https://twitch.tv/x" });
        expect(ld.offers).toMatchObject({ price: 0 });
    });
});

describe("serializeJsonLd", () => {
    it("escapes < so event text cannot close the script tag", () => {
        expect(serializeJsonLd({ t: "</script><script>x" })).not.toContain("</script>");
    });
});
