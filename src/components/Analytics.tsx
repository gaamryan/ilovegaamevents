
import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";

export function Analytics() {
    const { data: settings } = useSettings();

    useEffect(() => {
        const measurementId =
            import.meta.env.VITE_GA_MEASUREMENT_ID ||
            settings?.ga_measurement_id;

        if (!measurementId) return;

        // Loaded on demand so react-ga4 never ships in the main bundle for
        // visitors when no GA measurement ID is configured.
        import("react-ga4").then(({ default: ReactGA }) => {
            ReactGA.initialize(measurementId);
            ReactGA.send({ hitType: "pageview", page: window.location.pathname });
        });
    }, [settings?.ga_measurement_id]);

    return null;
}
