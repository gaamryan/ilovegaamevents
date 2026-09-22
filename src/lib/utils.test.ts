import { describe, it, expect } from "vitest";
import { isUuid } from "./utils";

describe("isUuid", () => {
  it("recognizes a real event id", () => {
    expect(isUuid("3f9a1e22-4b6c-4d8a-9f1a-6c2b8e7d5a10")).toBe(true);
  });

  it("recognizes uppercase UUIDs too", () => {
    expect(isUuid("3F9A1E22-4B6C-4D8A-9F1A-6C2B8E7D5A10")).toBe(true);
  });

  it("rejects a slug", () => {
    expect(isUuid("ancient-city-con-2026-3f9a1e22")).toBe(false);
  });

  it("rejects a bare 8-char id suffix", () => {
    expect(isUuid("3f9a1e22")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isUuid("")).toBe(false);
  });
});
