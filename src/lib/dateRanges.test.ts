import { describe, expect, it } from "vitest";
import { dayGroupLabel, isSameRange, thisWeekendRange, todayRange } from "./dateRanges";

describe("dateRanges", () => {
  it("covers the whole of today", () => {
    const { from, to } = todayRange(new Date(2026, 9, 21, 15, 30));
    expect([from.getHours(), to.getHours(), to.getMinutes()]).toEqual([0, 23, 59]);
  });

  it("points at the coming Saturday and Sunday on a weekday", () => {
    const { from, to } = thisWeekendRange(new Date(2026, 9, 21)); // Wednesday
    expect([from.getDay(), to.getDay()]).toEqual([6, 0]);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });

  it("keeps the current weekend while it is under way", () => {
    expect(thisWeekendRange(new Date(2026, 9, 25, 12)).from.getDay()).toBe(6); // Sunday
    expect(thisWeekendRange(new Date(2026, 9, 24, 12)).to.getDay()).toBe(0); // Saturday
  });

  it("matches ranges within a second", () => {
    const range = todayRange();
    expect(isSameRange(range, range.from, range.to)).toBe(true);
    expect(isSameRange(range, undefined, range.to)).toBe(false);
  });
});

describe("dayGroupLabel", () => {
  const now = new Date(2026, 9, 21, 12);
  it("names today, tomorrow and later days", () => {
    expect(dayGroupLabel(new Date(2026, 9, 21, 19), now)).toBe("Today");
    expect(dayGroupLabel(new Date(2026, 9, 22, 9), now)).toBe("Tomorrow");
    expect(dayGroupLabel(new Date(2026, 9, 24, 9), now)).toBe("Saturday, Oct 24");
  });
  it("groups events that started on an earlier day as happening now", () => {
    expect(dayGroupLabel(new Date(2026, 9, 18, 9), now)).toBe("Happening now");
  });
});
