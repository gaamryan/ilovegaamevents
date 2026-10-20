const escapeXml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface SitemapInput {
    siteUrl: string;
    events: { slug: string | null; updated_at: string | null }[];
    /** Slugs of categories that have upcoming events; empty ones are left out (thin pages). */
    categorySlugs: string[];
}

export function buildSitemapXml({ siteUrl, events, categorySlugs }: SitemapInput): string {
    const urls = [
        `<url><loc>${escapeXml(siteUrl)}/</loc></url>`,
        `<url><loc>${escapeXml(siteUrl)}/categories</loc></url>`,
        ...categorySlugs.map((slug) => `<url><loc>${escapeXml(`${siteUrl}/categories/${slug}`)}</loc></url>`),
        ...events
            .filter((e) => e.slug)
            .map((e) => {
                const lastmod = e.updated_at ? `<lastmod>${new Date(e.updated_at).toISOString()}</lastmod>` : "";
                return `<url><loc>${escapeXml(`${siteUrl}/events/${e.slug}`)}</loc>${lastmod}</url>`;
            }),
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
