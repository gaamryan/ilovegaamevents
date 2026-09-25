import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccountKey {
    client_email: string;
    private_key: string;
}

function base64UrlEncode(input: string | Uint8Array): string {
    const raw = typeof input === "string" ? input : String.fromCharCode(...input);
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBinary(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

// Server-to-server OAuth2 (RFC 7523 JWT bearer flow) — no external Google
// SDK needed, just Web Crypto to sign the assertion with the service
// account's private key.
async function getAccessToken(account: ServiceAccountKey): Promise<string> {
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claims = {
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/analytics.readonly",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    };
    const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
    const key = await crypto.subtle.importKey(
        "pkcs8",
        pemToBinary(account.private_key),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = new Uint8Array(
        await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
    );
    const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
    const { access_token } = await res.json();
    return access_token as string;
}

function buildReportRequests(days: number) {
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
    const rankedBy = (metric: string) => [{ metric: { metricName: metric }, desc: true }];

    return {
        overview: {
            dateRanges,
            metrics: [
                { name: "activeUsers" },
                { name: "sessions" },
                { name: "screenPageViews" },
                { name: "averageSessionDuration" },
            ],
        },
        sessionsByDate: {
            dateRanges,
            dimensions: [{ name: "date" }],
            metrics: [{ name: "sessions" }, { name: "activeUsers" }],
            orderBys: [{ dimension: { dimensionName: "date" } }],
        },
        devices: {
            dateRanges,
            dimensions: [{ name: "deviceCategory" }],
            metrics: [{ name: "sessions" }],
            orderBys: rankedBy("sessions"),
        },
        os: {
            dateRanges,
            dimensions: [{ name: "operatingSystem" }],
            metrics: [{ name: "sessions" }],
            orderBys: rankedBy("sessions"),
            limit: 10,
        },
        browsers: {
            dateRanges,
            dimensions: [{ name: "browser" }],
            metrics: [{ name: "sessions" }],
            orderBys: rankedBy("sessions"),
            limit: 10,
        },
        countries: {
            dateRanges,
            dimensions: [{ name: "country" }],
            metrics: [{ name: "sessions" }],
            orderBys: rankedBy("sessions"),
            limit: 10,
        },
        regions: {
            dateRanges,
            dimensions: [{ name: "region" }],
            metrics: [{ name: "sessions" }],
            orderBys: rankedBy("sessions"),
            limit: 10,
        },
        cities: {
            dateRanges,
            dimensions: [{ name: "city" }],
            metrics: [{ name: "sessions" }],
            orderBys: rankedBy("sessions"),
            limit: 10,
        },
        channels: {
            dateRanges,
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }],
            orderBys: rankedBy("sessions"),
        },
        topPages: {
            dateRanges,
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }, { name: "userEngagementDuration" }],
            orderBys: rankedBy("screenPageViews"),
            limit: 15,
        },
    };
}

// Fetched separately from the main batch: until "search_term" is registered
// as a GA4 custom dimension, this dimension name is invalid and Google
// rejects the request — isolating it means that failure never takes down
// every other report in the batch.
function buildSearchTermsRequest(days: number) {
    return {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        dimensions: [{ name: "customEvent:search_term" }],
        metrics: [{ name: "eventCount" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 15,
    };
}

type ReportRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type RawReport = { dimensionHeaders?: { name: string }[]; metricHeaders?: { name: string }[]; rows?: ReportRow[] };

function shapeReport(report: RawReport | undefined): Record<string, string | number>[] {
    if (!report?.rows) return [];
    const dimNames = report.dimensionHeaders?.map((h) => h.name) ?? [];
    const metricNames = report.metricHeaders?.map((h) => h.name) ?? [];
    return report.rows.map((row) => {
        const shaped: Record<string, string | number> = {};
        dimNames.forEach((name, i) => (shaped[name] = row.dimensionValues?.[i]?.value ?? ""));
        metricNames.forEach((name, i) => (shaped[name] = Number(row.metricValues?.[i]?.value ?? 0)));
        return shaped;
    });
}

function normalizePropertyPath(propertyId: string): string {
    return propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // This exposes real visitor traffic data, so only admins may call it.
        const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        const { data: { user } } = await supabase.auth.getUser(jwt);
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        const { data: role } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();
        if (!role) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const propertyId = Deno.env.get("GA4_PROPERTY_ID");
        const serviceAccountJson = Deno.env.get("GA4_SERVICE_ACCOUNT_KEY");
        if (!propertyId || !serviceAccountJson) {
            return new Response(
                JSON.stringify({ error: "not_configured", message: "GA4_PROPERTY_ID / GA4_SERVICE_ACCOUNT_KEY secrets are not set" }),
                { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
        const account: ServiceAccountKey = JSON.parse(serviceAccountJson);
        const property = normalizePropertyPath(propertyId);

        const body = await req.json().catch(() => ({}));
        const days = Number(body?.days) || 30;

        const accessToken = await getAccessToken(account);
        const authHeaders = {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        };

        const reportDefs = buildReportRequests(days);
        const reportNames = Object.keys(reportDefs) as (keyof typeof reportDefs)[];

        const batchRes = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/${property}:batchRunReports`,
            {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ requests: reportNames.map((name) => reportDefs[name]) }),
            },
        );

        if (!batchRes.ok) {
            const errText = await batchRes.text();
            console.error("GA4 Data API batch error:", errText);
            return new Response(JSON.stringify({ error: "ga4_request_failed", detail: errText }), {
                status: 502,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { reports } = await batchRes.json();
        const shaped: Record<string, ReturnType<typeof shapeReport>> = {};
        reportNames.forEach((name, i) => {
            shaped[name] = shapeReport(reports?.[i]);
        });

        let searchTermsAvailable = true;
        try {
            const searchRes = await fetch(
                `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
                {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify(buildSearchTermsRequest(days)),
                },
            );
            if (!searchRes.ok) throw new Error(await searchRes.text());
            shaped.searchTerms = shapeReport(await searchRes.json());
        } catch (err) {
            console.warn("search_term custom dimension not available yet:", err);
            shaped.searchTerms = [];
            searchTermsAvailable = false;
        }

        return new Response(JSON.stringify({ ...shaped, searchTermsAvailable }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("ga4-report error:", message);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
