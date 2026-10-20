import { addDays, endOfDay, endOfWeek, format, isSameDay, nextSaturday, nextSunday, startOfDay } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export function todayRange(now = new Date()): DateRange {
  return { from: startOfDay(now), to: endOfDay(now) };
}

export function thisWeekRange(now = new Date()): DateRange {
  return { from: startOfDay(now), to: endOfDay(endOfWeek(now, { weekStartsOn: 0 })) };
}

/** Saturday and Sunday of this weekend; on a weekend it is the weekend already under way. */
export function thisWeekendRange(now = new Date()): DateRange {
  const day = now.getDay();
  const dayMs = 86_400_000;
  if (day === 6) return { from: startOfDay(now), to: endOfDay(new Date(now.getTime() + dayMs)) };
  if (day === 0) return { from: startOfDay(new Date(now.getTime() - dayMs)), to: endOfDay(now) };
  return { from: startOfDay(nextSaturday(now)), to: endOfDay(nextSunday(now)) };
}

export function isSameRange(range: DateRange, from?: Date, to?: Date): boolean {
  if (!from || !to) return false;
  return Math.abs(from.getTime() - range.from.getTime()) < 1000 && Math.abs(to.getTime() - range.to.getTime()) < 1000;
}

/** Header text for a day group in the feed; events already under way from an earlier day share one group. */
export function dayGroupLabel(startTime: Date | string, now = new Date()): string {
  const date = new Date(startTime);
  if (date < startOfDay(now)) return "Happening now";
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, addDays(now, 1))) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}
