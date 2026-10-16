import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// r21labs.com ran with no analytics until 2026-10-16 and nothing noticed. Pin the tag and its gate.
describe("GA4", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  it("loads the R21 Labs property", () => {
    expect(layout).toContain('GA_ID = "G-FBR3V4Z84G"');
    expect(layout).toContain("googletagmanager.com/gtag/js?id=${GA_ID}");
  });
  it("only on the production deployment", () => {
    expect(layout).toContain('process.env.VERCEL_ENV === "production"');
  });
});
