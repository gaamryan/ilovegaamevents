import { CalendarDays, Sparkles, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventFilters } from "@/components/events/FilterDrawer";
import { isSameRange, thisWeekendRange, todayRange } from "@/lib/dateRanges";

interface QuickFiltersProps {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
}

/** One-tap Today / This Weekend / Free shortcuts above the feed. */
export function QuickFilters({ filters, onChange }: QuickFiltersProps) {
  const today = todayRange();
  const weekend = thisWeekendRange();
  const todayActive = isSameRange(today, filters.dateFrom, filters.dateTo);
  const weekendActive = isSameRange(weekend, filters.dateFrom, filters.dateTo);

  const toggleRange = (range: { from: Date; to: Date }, active: boolean) => {
    const next = { ...filters };
    if (active) {
      delete next.dateFrom;
      delete next.dateTo;
    } else {
      next.dateFrom = range.from;
      next.dateTo = range.to;
    }
    onChange(next);
  };

  const toggleFree = () => {
    const next = { ...filters };
    if (next.isFree) delete next.isFree;
    else next.isFree = true;
    onChange(next);
  };

  return (
    <div role="group" aria-label="Quick filters" className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-3">
      <Button
        type="button"
        size="sm"
        variant={todayActive ? "default" : "outline"}
        aria-pressed={todayActive}
        className="shrink-0 rounded-full gap-1.5"
        onClick={() => toggleRange(today, todayActive)}
      >
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        Today
      </Button>
      <Button
        type="button"
        size="sm"
        variant={weekendActive ? "default" : "outline"}
        aria-pressed={weekendActive}
        className="shrink-0 rounded-full gap-1.5"
        onClick={() => toggleRange(weekend, weekendActive)}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        This Weekend
      </Button>
      <Button
        type="button"
        size="sm"
        variant={filters.isFree ? "default" : "outline"}
        aria-pressed={!!filters.isFree}
        className="shrink-0 rounded-full gap-1.5"
        onClick={toggleFree}
      >
        <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
        Free
      </Button>
    </div>
  );
}
