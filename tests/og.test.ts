import { describe, expect, it } from "vitest";

import { ogSubtitle } from "@/lib/og";

describe("ogSubtitle", () => {
  it("leaves short text alone", () => {
    expect(ogSubtitle("A short summary.")).toBe("A short summary.");
  });

  it("cuts a long summary at a word boundary with an ellipsis", () => {
    const long = "Crawlers visit sites far more often than people expect. ".repeat(6).trim();
    expect(long.length).toBeGreaterThan(250);
    const out = ogSubtitle(long);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(151);
    // No mid-word cut: the text before the ellipsis is a whole-word prefix.
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
    expect(long[out.length - 1]).toBe(" ");
  });

  it("does not truncate text of exactly the limit", () => {
    const exact = "x".repeat(150);
    expect(ogSubtitle(exact)).toBe(exact);
  });
});
