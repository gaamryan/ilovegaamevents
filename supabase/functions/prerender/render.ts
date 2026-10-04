export const SITE_URL = "https://ilovegaam.com";
const SITE_NAME = "I Love GAAM Events";
const SITE_DESCRIPTION =
    "Jacksonville and Northeast Florida events for gamers, artists, music lovers and nerds.";
const TIME_ZONE = "America/New_York";

export interface PrerenderVenue {
    name: string;
    city: string | null;
    state: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    postal_code: string | null;
}

export interface PrerenderEvent {
    slug: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string | null;
    image_url: string | null;
    ticket_url: string | null;
    source_url: string | null;
    price_min: number | null;
    is_free: boolean | null;
    pricing_at_site: boolean | null;
    is_livestream: boolean | null;
    venue: PrerenderVenue | null;
    host: { name: string; website_url: string | null } | null;
    event_categories: { category: { name: string } | null }[] | null;
}

export interface PrerenderListEvent {
    slug: string;
    title: string;
    description: string | null;
    start_time: string;
    is_livestream: boolean | null;
    venue: { name: string; city: string | null } | null;
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function stripHtml(value: string | null | undefined): string {
    return (value ?? "").replace(/<[^>]*>?/gm, "").replace(/[ \t]+/g, " ").trim();
}

function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
        timeZone: TIME_ZONE,
        dateStyle: "full",
        timeStyle: "short",
    });
}

function httpUrl(value: string | null | undefined): string | null {
    return /^https?:\/\//.test(value ?? "") ? (value as string) : null;
}

function paragraphs(text: string): string {
    return text
        .split(/\n{1,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("\n");
}

// Mirrors buildEventJsonLd in src/lib/seo.ts.
export function buildEventJsonLd(event: PrerenderEvent) {
    const url = `${SITE_URL}/events/${event.slug}`;
    const isOnline = !!event.is_livestream;
    const offerUrl = httpUrl(event.ticket_url) ?? url;
    const venue = event.venue;
    const price = event.is_free ? 0 : event.price_min ?? undefined;

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
        location: isOnline
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
                : undefined,
        offers: price !== undefined
            ? { "@type": "Offer", price, priceCurrency: "USD", url: offerUrl, availability: "https://schema.org/InStock" }
            : undefined,
        organizer: event.host
            ? { "@type": "Organization", name: event.host.name, url: event.host.website_url || undefined }
            : undefined,
    };
}

function layout(opts: {
    title: string;
    description: string;
    canonical: string;
    image?: string | null;
    ogType?: string;
    jsonLd?: unknown;
    noindex?: boolean;
    body: string;
}): string {
    const title = escapeHtml(opts.title);
    const description = escapeHtml(opts.description);
    const canonical = escapeHtml(opts.canonical);
    const image = opts.image ? escapeHtml(opts.image) : `${SITE_URL}/og-default.jpg`;
    const jsonLd = opts.jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, "\\u003c")}</script>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="${opts.noindex ? "noindex" : "index,follow"}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:type" content="${opts.ogType ?? "website"}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
${jsonLd}
</head>
<body>
<header><a href="${SITE_URL}/">${SITE_NAME}</a></header>
<main>
${opts.body}
</main>
</body>
</html>`;
}

export function renderEventPage(event: PrerenderEvent): string {
    const description = stripHtml(event.description);
    const venue = event.venue;
    const address = venue
        ? [venue.address_line_1, venue.address_line_2, venue.city, venue.state, venue.postal_code].filter(Boolean).join(", ")
        : "";
    const categories = (event.event_categories ?? []).map((ec) => ec.category?.name).filter(Boolean) as string[];
    const link = httpUrl(event.ticket_url) ?? httpUrl(event.source_url);
    const price = event.is_free
        ? "Free"
        : event.pricing_at_site
            ? "Pricing available at the event site"
            : event.price_min
                ? `From $${event.price_min}`
                : "";

    const body = `<article>
<h1>${escapeHtml(event.title)}</h1>
${event.image_url ? `<img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.title)}" width="1200" />` : ""}
<p><time datetime="${escapeHtml(event.start_time)}">${escapeHtml(formatWhen(event.start_time))}</time></p>
${event.is_livestream ? "<p>Online livestream</p>" : venue ? `<p>${escapeHtml(venue.name)}${address ? ` — ${escapeHtml(address)}` : ""}</p>` : ""}
${event.host ? `<p>Hosted by ${escapeHtml(event.host.name)}</p>` : ""}
${price ? `<p>${escapeHtml(price)}</p>` : ""}
${categories.length ? `<p>Categories: ${escapeHtml(categories.join(", "))}</p>` : ""}
${paragraphs(description)}
${link ? `<p><a href="${escapeHtml(link)}">${event.is_livestream ? "Watch" : "Event details and tickets"}</a></p>` : ""}
</article>
<nav><a href="${SITE_URL}/">All upcoming events</a></nav>`;

    return layout({
        title: `${event.title} | GAAM Events`,
        description: (description || event.title).slice(0, 160),
        canonical: `${SITE_URL}/events/${event.slug}`,
        image: event.image_url,
        ogType: "event",
        jsonLd: buildEventJsonLd(event),
        body,
    });
}

export function renderHomePage(events: PrerenderListEvent[]): string {
    const items = events
        .map((e) => {
            const where = e.is_livestream ? "Online livestream" : [e.venue?.name, e.venue?.city].filter(Boolean).join(", ");
            const blurb = stripHtml(e.description).slice(0, 200);
            return `<li>
<h2><a href="${SITE_URL}/events/${escapeHtml(e.slug)}">${escapeHtml(e.title)}</a></h2>
<p><time datetime="${escapeHtml(e.start_time)}">${escapeHtml(formatWhen(e.start_time))}</time>${where ? ` — ${escapeHtml(where)}` : ""}</p>
${blurb ? `<p>${escapeHtml(blurb)}</p>` : ""}
</li>`;
        })
        .join("\n");

    const body = `<h1>${SITE_NAME}</h1>
<p>${SITE_DESCRIPTION}</p>
<h2>Upcoming events</h2>
<ul>
${items}
</ul>`;

    return layout({
        title: `${SITE_NAME} | Games, Art & Music Events in Jacksonville`,
        description: SITE_DESCRIPTION,
        canonical: `${SITE_URL}/`,
        body,
    });
}

export function renderCategoriesPage(categories: { name: string }[]): string {
    const body = `<h1>Event categories</h1>
<ul>
${categories.map((c) => `<li>${escapeHtml(c.name)}</li>`).join("\n")}
</ul>
<nav><a href="${SITE_URL}/">All upcoming events</a></nav>`;

    return layout({
        title: `Categories | ${SITE_NAME}`,
        description: SITE_DESCRIPTION,
        canonical: `${SITE_URL}/categories`,
        body,
    });
}

export function renderNotFound(): string {
    return layout({
        title: `Event not found | ${SITE_NAME}`,
        description: "This event may have been removed or doesn't exist.",
        canonical: `${SITE_URL}/`,
        noindex: true,
        body: `<h1>Event not found</h1><p><a href="${SITE_URL}/">Browse upcoming events</a></p>`,
    });
}
