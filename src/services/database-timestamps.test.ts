import { describe, expect, it } from "@effect/vitest";
import { parseUtcTimestamp } from "./database-timestamps";

describe("UTC PostgreSQL timestamps", () => {
  it("decodes stored timestamps without applying the process timezone", () => {
    expect(parseUtcTimestamp("2026-11-09 17:52:41.328")).toEqual(
      new Date("2026-11-09T17:52:41.328Z"),
    );
  });

  it("keeps expired rate-limit windows expired after decoding", () => {
    const lastRequest = parseUtcTimestamp("2026-11-09 17:52:41.328");
    const windowStart = new Date("2026-11-09T18:15:15.293Z");
    expect(lastRequest < windowStart).toBe(true);
  });

  it("preserves PostgreSQL infinity values", () => {
    expect(parseUtcTimestamp("infinity")).toBe(Infinity);
    expect(parseUtcTimestamp("-infinity")).toBe(-Infinity);
  });
});
