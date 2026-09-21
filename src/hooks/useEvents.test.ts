import { describe, it, expect } from "vitest";
import { escapeForPostgrestOr } from "./useEvents";

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
