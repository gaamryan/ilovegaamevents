import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Ga4RankedRow } from "@/hooks/useGa4Report";

const chartConfig: ChartConfig = {
    sessions: { label: "Sessions", color: "hsl(var(--primary))" },
    activeUsers: { label: "Active users", color: "hsl(var(--accent))" },
};

function formatGa4Date(raw: string): string {
    // GA4 returns dates as "YYYYMMDD"
    if (!/^\d{8}$/.test(raw)) return raw;
    const date = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionsChart({ rows }: { rows: Ga4RankedRow[] }) {
    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground py-6 text-center">No data yet</p>;
    }

    const data = rows.map((row) => ({
        date: formatGa4Date(String(row.date ?? "")),
        sessions: Number(row.sessions ?? 0),
        activeUsers: Number(row.activeUsers ?? 0),
    }));

    return (
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <defs>
                    <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                    dataKey="sessions"
                    type="monotone"
                    stroke="var(--color-sessions)"
                    fill="url(#fillSessions)"
                    strokeWidth={2}
                />
            </AreaChart>
        </ChartContainer>
    );
}
