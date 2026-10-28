import { describe, expect, it } from "vitest";

import { clamp } from "@/lib/site";

describe("clamp (meta description length)", () => {
  it("leaves a short description alone", () => {
    expect(clamp("A short line.")).toBe("A short line.");
  });

  it("cuts at a sentence end when one falls in the window", () => {
    const text =
      "A read-only server over a Postgres database that never hands out credentials to the assistant. " +
      "The second sentence runs well past the limit and should not appear in the snippet at all, however long it goes.";
    const out = clamp(text);
    expect(out.endsWith(".")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out).not.toContain("second sentence");
  });

  it("does not leave a dangling article or preposition before the ellipsis", () => {
    const text =
      "An MCP server that pulls current, version-specific library documentation into a prompt so the model stops guessing at deprecated calls and old signatures from stale training data";
    const out = clamp(text);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out).not.toMatch(/\s(a|an|the|of|to|and|or|in|into|on|for|with)…$/i);
  });
});
