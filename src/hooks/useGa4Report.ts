import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Ga4RankedRow {
    [dimension: string]: string | number;
}

export interface Ga4Report {
    overview: { activeUsers: number; sessions: number; screenPageViews: number; averageSessionDuration: number }[];
    sessionsByDate: Ga4RankedRow[];
    devices: Ga4RankedRow[];
    os: Ga4RankedRow[];
    browsers: Ga4RankedRow[];
    countries: Ga4RankedRow[];
    regions: Ga4RankedRow[];
    cities: Ga4RankedRow[];
    channels: Ga4RankedRow[];
    topPages: Ga4RankedRow[];
    searchTerms: Ga4RankedRow[];
    searchTermsAvailable: boolean;
}

interface Ga4ErrorBody {
    error: string;
    message?: string;
    detail?: string;
}

export class Ga4NotConfiguredError extends Error {}

export function useGa4Report(days: number) {
    return useQuery({
        queryKey: ["ga4-report", days],
        queryFn: async (): Promise<Ga4Report> => {
            const { data, error } = await supabase.functions.invoke<Ga4Report | Ga4ErrorBody>("ga4-report", {
                body: { days },
            });

            if (error) {
                // A non-2xx response comes back as a FunctionsHttpError with the
                // raw Response on `.context` — the body it returned (e.g. our
                // "not_configured" flag) has to be read off that, not `data`.
                let parsed: Ga4ErrorBody | null = null;
                const context = (error as { context?: Response }).context;
                if (context) {
                    try {
                        parsed = await context.json();
                    } catch {
                        // non-JSON error body — fall through to error.message below
                    }
                }
                if (parsed?.error === "not_configured") throw new Ga4NotConfiguredError(parsed.message);
                throw new Error(parsed?.message || parsed?.detail || parsed?.error || error.message);
            }

            if (data && "error" in data) {
                if (data.error === "not_configured") throw new Ga4NotConfiguredError(data.message);
                throw new Error(data.message || data.detail || data.error);
            }

            return data as Ga4Report;
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
}
