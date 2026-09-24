// Thin wrapper around react-ga4, shared by every call site that needs to
// send GA4 hits (pageviews, custom events). Centralized so there's exactly
// one place that resolves the measurement ID and initializes gtag once,
// instead of every caller re-deriving that logic.

let initializedId: string | null = null;

export function resolveMeasurementId(settingsId?: string): string | undefined {
    return import.meta.env.VITE_GA_MEASUREMENT_ID || settingsId;
}

// Loaded on demand so react-ga4 never ships in the main bundle for visitors
// when no GA measurement ID is configured.
async function getGa(measurementId?: string) {
    if (!measurementId) return null;
    const { default: ReactGA } = await import("react-ga4");
    if (initializedId !== measurementId) {
        ReactGA.initialize(measurementId);
        initializedId = measurementId;
    }
    return ReactGA;
}

export async function trackPageview(measurementId: string | undefined, page: string) {
    const ga = await getGa(measurementId);
    ga?.send({ hitType: "pageview", page });
}

// "search" + "search_term" is GA4's recommended event schema for site
// search — once search_term is registered as a custom dimension in the GA4
// property, this powers the built-in Site Search reports and is queryable
// in Explorations / Looker Studio.
export async function trackSearch(measurementId: string | undefined, searchTerm: string) {
    const ga = await getGa(measurementId);
    ga?.event("search", { search_term: searchTerm });
}
