interface RankedBarListProps {
    rows: { label: string; value: number }[];
    emptyLabel?: string;
    formatValue?: (value: number) => string;
}

const defaultFormat = (value: number) => value.toLocaleString();

// A compact ranked list with an inline proportional bar — used for every
// "sessions by X" breakdown (device, OS, browser, geography, channel).
// Deliberately not a recharts bar chart: these are single-metric rankings,
// not multi-series comparisons, and the numbers are printed as text, so
// nothing here depends on color to be read.
export function RankedBarList({ rows, emptyLabel = "No data yet", formatValue = defaultFormat }: RankedBarListProps) {
    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground py-6 text-center">{emptyLabel}</p>;
    }

    const max = Math.max(...rows.map((r) => r.value), 1);

    return (
        <ul className="space-y-2.5">
            {rows.map((row) => (
                <li key={row.label} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate text-foreground" title={row.label}>
                        {row.label || "(not set)"}
                    </span>
                    <span className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <span
                            className="absolute inset-y-0 left-0 rounded-full bg-primary"
                            style={{ width: `${(row.value / max) * 100}%` }}
                        />
                    </span>
                    <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                        {formatValue(row.value)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
