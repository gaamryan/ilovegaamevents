
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
import { resolveMeasurementId, trackPageview } from "@/lib/analytics";

export function Analytics() {
    const { data: settings } = useSettings();
    const location = useLocation();
    const measurementId = resolveMeasurementId(settings?.ga_measurement_id);

    useEffect(() => {
        if (!measurementId) return;
        // This is a client-routed SPA — react-router changes the page
        // without a real browser navigation, so gtag never sees it on its
        // own. Fire a pageview on every route change, or GA only ever
        // records one hit per visit.
        trackPageview(measurementId, location.pathname + location.search);
    }, [measurementId, location.pathname, location.search]);

    return null;
}
