import type { Event } from "@/hooks/useEvents";

export const SITE_URL = "https://ilovegaam.com";
export const SITE_NAME = "I Love GAAM Events";
export const SITE_DESCRIPTION =
    "Jacksonville and Northeast Florida events for gamers, artists, music lovers and nerds.";

export function stripHtml(value: string | null | undefined): string {
    return (value ?? "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
}

export function eventPath(event: Pick<Event, "slug" | "id">): string {
    return `/events/${event.slug || event.id}`;
}

export function buildEventJsonLd(event: Event) {
    const url = `${SITE_URL}${eventPath(event)}`;
    const isOnline = !!event.is_livestream;
    const venue = event.venue;
    const offerUrl = /^https?:\/\//.test(event.ticket_url ?? "") ? event.ticket_url : url;

    const location = isOnline
        ? { "@type": "VirtualLocation", url: offerUrl }
        : venue
            ? {
                "@type": "Place",
                name: venue.name,
                address: {
                    "@type": "PostalAddress",
                    streetAddress: [venue.address_line_1, venue.address_line_2].filter(Boolean).join(", ") || undefined,
                    addressLocality: venue.city || undefined,
                    addressRegion: venue.state || undefined,
                    postalCode: venue.postal_code || undefined,
                },
            }
            : undefined;

    const price = event.is_free ? 0 : event.price_min ?? undefined;
    const offers = price !== undefined
        ? {
            "@type": "Offer",
            price,
            priceCurrency: "USD",
            url: offerUrl,
            availability: "https://schema.org/InStock",
        }
        : undefined;

    return {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        description: stripHtml(event.description) || undefined,
        url,
        startDate: event.start_time,
        endDate: event.end_time || undefined,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: isOnline
            ? "https://schema.org/OnlineEventAttendanceMode"
            : "https://schema.org/OfflineEventAttendanceMode",
        image: event.image_url ? [event.image_url] : undefined,
        location,
        offers,
        organizer: event.host
            ? { "@type": "Organization", name: event.host.name, url: event.host.website_url || undefined }
            : undefined,
    };
}

// "<" is escaped so event text can never close the surrounding <script> tag.
export function serializeJsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
