import type { LucideIcon } from "lucide-react";

export function StatTile({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: LucideIcon;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
    );
}
