// Cloudflare Worker: serves crawlers fully rendered HTML from the Supabase
// "prerender" function; everyone else (and any failure) falls through to
// the normal site.
const PRERENDER_URL = "https://wytjvdafpdspizmrqjsn.supabase.co/functions/v1/prerender";

// AI and social crawlers that don't run JavaScript. Googlebot and Bingbot are
// left out on purpose: they render JS themselves.
const BOT_UA =
    /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|Applebot|DuckDuckBot|CCBot|Bytespider|Amazonbot|meta-externalagent|cohere-ai|YouBot|Diffbot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot/i;

const isPublicPage = (pathname) =>
    pathname === "/" || pathname === "/categories" || /^\/events\/[^/]+$/.test(pathname);

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const userAgent = request.headers.get("user-agent") || "";

        if (request.method === "GET" && isPublicPage(url.pathname) && BOT_UA.test(userAgent)) {
            try {
                const res = await fetch(`${PRERENDER_URL}?path=${encodeURIComponent(url.pathname)}`, {
                    cf: { cacheTtl: 300, cacheEverything: true },
                });
                if (res.ok) {
                    const { status, html } = await res.json();
                    return new Response(html, {
                        status,
                        headers: {
                            "Content-Type": "text/html; charset=utf-8",
                            "Cache-Control": "public, max-age=300",
                            "X-Prerendered": "1",
                        },
                    });
                }
            } catch {
                // fall through to the origin site
            }
        }

        return fetch(request);
    },
};
