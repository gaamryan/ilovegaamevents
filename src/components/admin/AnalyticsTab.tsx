import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useGa4Report, Ga4NotConfiguredError, type Ga4RankedRow } from "@/hooks/useGa4Report";
import {
    BarChart3,
    ExternalLink,
    Users,
    MousePointerClick,
    Eye,
    Clock3,
    Smartphone,
    Globe2,
    Search as SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/admin/analytics/StatTile";
import { RankedBarList } from "@/components/admin/analytics/RankedBarList";
import { SessionsChart } from "@/components/admin/analytics/SessionsChart";

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function toRanked(rows: Ga4RankedRow[], dimensionKey: string, metricKey = "sessions") {
    return rows.map((r) => ({ label: String(r[dimensionKey] ?? ""), value: Number(r[metricKey] ?? 0) }));
}

export function AnalyticsTab() {
    const { data: settings, isLoading: settingsLoading } = useSettings();
    const [days, setDays] = useState(30);
    const { data: report, isLoading, error } = useGa4Report(days);

    const lookerUrl = settings?.looker_studio_url;
    const gaId = settings?.ga_measurement_id;

    if (settingsLoading) {
        return <div className="p-8 flex justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
    }

    if (!gaId) {
        return (
            <div className="p-4 text-center py-20">
                <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center mb-4">
                    <BarChart3 className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Analytics Configured</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    Set your GA4 Measurement ID in the Settings tab to start collecting analytics.
                </p>
            </div>
        );
    }

    const notConfigured = error instanceof Ga4NotConfiguredError;

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-lg font-medium">Site Traffic</h3>
                <div className="flex items-center gap-2">
                    <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                        <SelectTrigger className="w-32 h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" asChild>
                        <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">
                            Open GA4 <ExternalLink className="h-4 w-4 ml-1" />
                        </a>
                    </Button>
                </div>
            </div>

            {notConfigured ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground">On-site dashboard isn't set up yet</p>
                    <p>
                        This dashboard reads live numbers from the GA4 Data API. Add the{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">GA4_PROPERTY_ID</code> and{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">GA4_SERVICE_ACCOUNT_KEY</code> secrets
                        to the <code className="text-xs bg-muted px-1 py-0.5 rounded">ga4-report</code> edge function
                        in Supabase to enable it.
                    </p>
                </div>
            ) : error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                    Couldn't load analytics: {error.message}
                </div>
            ) : isLoading || !report ? (
                <div className="p-8 flex justify-center"><div className="animate-pulse text-muted-foreground">Loading traffic data...</div></div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatTile label="Active users" value={(report.overview[0]?.activeUsers ?? 0).toLocaleString()} icon={Users} />
                        <StatTile label="Sessions" value={(report.overview[0]?.sessions ?? 0).toLocaleString()} icon={MousePointerClick} />
                        <StatTile label="Pageviews" value={(report.overview[0]?.screenPageViews ?? 0).toLocaleString()} icon={Eye} />
                        <StatTile label="Avg. session" value={formatDuration(report.overview[0]?.averageSessionDuration ?? 0)} icon={Clock3} />
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <h4 className="text-sm font-medium mb-3">Sessions over time</h4>
                        <SessionsChart rows={report.sessionsByDate} />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                                <Smartphone className="h-4 w-4" /> Device
                            </h4>
                            <RankedBarList rows={toRanked(report.devices, "deviceCategory")} />
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3">Operating system</h4>
                            <RankedBarList rows={toRanked(report.os, "operatingSystem")} />
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3">Browser</h4>
                            <RankedBarList rows={toRanked(report.browsers, "browser")} />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                                <Globe2 className="h-4 w-4" /> Country
                            </h4>
                            <RankedBarList rows={toRanked(report.countries, "country")} />
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3">State / region</h4>
                            <RankedBarList rows={toRanked(report.regions, "region")} />
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3">City</h4>
                            <RankedBarList rows={toRanked(report.cities, "city")} />
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <h4 className="text-sm font-medium mb-3">Where visitors come from</h4>
                        <RankedBarList rows={toRanked(report.channels, "sessionDefaultChannelGroup")} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3">Top pages</h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Page</TableHead>
                                        <TableHead className="text-right">Views</TableHead>
                                        <TableHead className="text-right">Avg. time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.topPages.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                No data yet
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        report.topPages.map((row) => {
                                            const views = Number(row.screenPageViews ?? 0);
                                            const engagement = Number(row.userEngagementDuration ?? 0);
                                            return (
                                                <TableRow key={String(row.pagePath)}>
                                                    <TableCell className="max-w-[200px] truncate" title={String(row.pagePath)}>
                                                        {String(row.pagePath)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">{views.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {formatDuration(views ? engagement / views : 0)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-4">
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                                <SearchIcon className="h-4 w-4" /> Top searches
                            </h4>
                            {!report.searchTermsAvailable ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    Register <code className="text-xs bg-muted px-1 py-0.5 rounded">search_term</code> as
                                    a custom dimension in GA4 (Admin → Custom definitions) to see this.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Term</TableHead>
                                            <TableHead className="text-right">Searches</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.searchTerms.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                                    No searches yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            report.searchTerms.map((row) => (
                                                <TableRow key={String(row["customEvent:search_term"])}>
                                                    <TableCell>{String(row["customEvent:search_term"])}</TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {Number(row.eventCount ?? 0).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </>
            )}

            {lookerUrl && (
                <div className="space-y-2">
                    <h3 className="text-lg font-medium">External dashboard</h3>
                    <div className="rounded-xl border border-border overflow-hidden bg-card">
                        <iframe
                            src={lookerUrl}
                            className="w-full border-0"
                            style={{ height: "calc(100vh - 240px)", minHeight: "500px" }}
                            allowFullScreen
                            sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
