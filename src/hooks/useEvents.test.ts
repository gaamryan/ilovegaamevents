import { describe, it, expect } from "vitest";
import { buildFeedOrFilter, escapeForPostgrestOr } from "./useEvents";

describe("escapeForPostgrestOr", () => {
  it("leaves plain text untouched", () => {
    expect(escapeForPostgrestOr("cosplay meetup")).toBe("cosplay meetup");
  });

  it("escapes PostgREST or() delimiter characters", () => {
    expect(escapeForPostgrestOr("Trivia Night: Round 1 (finals)")).toBe(
      "Trivia Night\\: Round 1 \\(finals\\)"
    );
  });

  it("escapes a literal comma so it can't inject an extra or() condition", () => {
    expect(escapeForPostgrestOr("id.eq.1,status.eq.approved")).toBe(
      "id\\.eq\\.1\\,status\\.eq\\.approved"
    );
  });
});


describe("buildFeedOrFilter", () => {
  it("is a flat or-list when not searching", () => {
    expect(buildFeedOrFilter("A", "B")).toBe("start_time.gte.A,end_time.gte.B");
  });

  it("pairs each date condition with each text condition when searching", () => {
    const filter = buildFeedOrFilter("A", "B", "jazz");
    expect(filter.split("),and(")).toHaveLength(4);
    expect(filter).toContain("and(start_time.gte.A,title.ilike.%jazz%)");
    expect(filter).toContain("and(end_time.gte.B,description.ilike.%jazz%)");
  });
});
