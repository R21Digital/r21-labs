import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The publishing boundary, enforced instead of asserted.
 *
 * Adversarial review 2026-08-20 was right that calling getPublishedEntries() a
 * "choke point no route can bypass" was a convention, not a boundary — the raw
 * reader was exported under an inviting name and any future sitemap, feed, or
 * route handler could import it and skip every guard.
 *
 * This test is the boundary. It fails the suite if anything renderable reaches
 * for the unguarded reader.
 */

const RENDERABLE = ["app"];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(item.name) ? [full] : [];
  });
}

describe("publishing boundary", () => {
  const files = RENDERABLE.flatMap((dir) => walk(path.join(process.cwd(), dir)));

  it("has renderable files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("lets nothing under app/ import the unguarded reader", () => {
    const offenders = files.filter((file) =>
      fs.readFileSync(file, "utf8").includes("readEntriesUnguarded"),
    );
    expect(
      offenders.map((f) => path.relative(process.cwd(), f)),
      "These bypass every publishing guard. Use getPublishedEntries().",
    ).toEqual([]);
  });
});

describe("static-only routing", () => {
  it("has no dynamic fallback route in the prerender manifest", () => {
    // `export const dynamicParams = false` is the fix; this asserts the OUTPUT.
    // Without it an unknown /x/y invokes the renderer at request time, which
    // breaks the static-only claim and makes draft safety depend on the runtime
    // lookup staying guarded forever.
    const manifestPath = path.join(process.cwd(), ".next", "prerender-manifest.json");
    expect(
      fs.existsSync(manifestPath),
      "No prerender manifest - run `npm run build` before `npm test`.",
    ).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const withFallback = Object.entries(manifest.dynamicRoutes ?? {}).filter(
      ([, route]) => (route as { fallback?: unknown }).fallback !== false,
    );
    expect(withFallback.map(([name]) => name)).toEqual([]);
  });
});
