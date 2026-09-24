
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";

export function Analytics() {
    const { data: settings } = useSettings();
    const location = useLocation();
    // Tracks which measurement ID gtag has actually been initialized with, so
    // a route change sends a pageview instead of re-initializing every time.
    const initializedIdRef = useRef<string | null>(null);

    const measurementId =
        import.meta.env.VITE_GA_MEASUREMENT_ID || settings?.ga_measurement_id;

    useEffect(() => {
        if (!measurementId) return;
        const page = location.pathname + location.search;

        // Loaded on demand so react-ga4 never ships in the main bundle for
        // visitors when no GA measurement ID is configured.
        import("react-ga4").then(({ default: ReactGA }) => {
            // This is a client-routed SPA — react-router changes the page
            // without a real browser navigation, so gtag never sees it on
            // its own. initialize() once, then send a pageview on every
            // route change, or GA only ever records one hit per visit.
            if (initializedIdRef.current !== measurementId) {
                ReactGA.initialize(measurementId);
                initializedIdRef.current = measurementId;
            }
            ReactGA.send({ hitType: "pageview", page });
        });
    }, [measurementId, location.pathname, location.search]);

    return null;
}
