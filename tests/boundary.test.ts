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

/**
 * Routes that are dynamic ON PURPOSE, named one by one.
 *
 * `/api/submit` is the form endpoint added 2026-08-23. A POST handler cannot be
 * prerendered, so the assertion below had to admit an exception — and the shape
 * of the exception is the whole point. A pattern like "anything under /api" or
 * "any route with no page.tsx" would have given back the guarantee this file
 * exists to hold, silently, the first time someone added a second endpoint.
 * An explicit list means the next dynamic route requires editing a test, which
 * is a conversation rather than an accident.
 *
 * What the static-only claim protected was never "no server code" for its own
 * sake — it was that no CONTENT is resolved at request time, so draft safety
 * cannot depend on a runtime lookup staying guarded. This route reads no
 * content at all, which is asserted directly below.
 */
const INTENTIONALLY_DYNAMIC = new Set(["/api/submit"]);

describe("static-only routing", () => {
  it("keeps the dynamic-route exception to routes that touch no content", () => {
    /**
     * The exception is only safe while it stays true. A form endpoint that
     * started reading the content layer would be a draft-leak surface with a
     * permission slip already signed.
     *
     * 🔴 The first version of this check grepped the route's own source for the
     * literal `@/lib/content`. Adversarial review 2026-08-24 pointed out that
     * this proves almost nothing: a relative import, or any helper that itself
     * reads content, walks straight past it. That is the same mistake as
     * `draft-leak.test.ts` matching on `.xml` — a test that looks like a
     * guarantee and asserts a spelling.
     *
     * This walks the route's whole local dependency graph instead.
     */
    const CONTENT_MODULES = ["lib/content", "lib/schema"];

    /** Every first-party module reachable from `entry`, transitively. */
    function localDeps(entry: string, seen = new Set<string>()): Set<string> {
      const resolved = [".ts", ".tsx", "/index.ts", ""]
        .map((ext) => `${entry}${ext}`)
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!resolved || seen.has(resolved)) return seen;
      seen.add(resolved);

      const source = fs.readFileSync(resolved, "utf8");
      for (const [, spec] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const next = spec.startsWith("@/")
          ? path.join(process.cwd(), spec.slice(2))
          : spec.startsWith(".")
            ? path.resolve(path.dirname(resolved), spec)
            : null; // bare specifier — a package, not ours
        if (next) localDeps(next, seen);
      }
      return seen;
    }

    for (const route of INTENTIONALLY_DYNAMIC) {
      const file = path.join(process.cwd(), "app", `${route}/route.ts`);
      expect(fs.existsSync(file), `${route} is allowlisted but does not exist.`).toBe(true);

      const reached = [...localDeps(file)].map((f) =>
        path.relative(process.cwd(), f).replace(/\\/g, "/"),
      );

      // Vacuity guard: a walk that resolves nothing would pass silently.
      expect(
        reached.length,
        `Dependency walk for ${route} found nothing — the resolver is broken.`,
      ).toBeGreaterThan(1);

      const offenders = reached.filter((f) =>
        CONTENT_MODULES.some((mod) => f.startsWith(mod)),
      );
      expect(
        offenders,
        `${route} is allowlisted as dynamic AND reaches the content layer. One or the other.`,
      ).toEqual([]);
    }
  });

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

  it("prerenders every app route, leaving nothing server-rendered on demand", () => {
    /**
     * The check above only sees routes Next put in `dynamicRoutes`. A route
     * that is fully dynamic never gets there, so it passed while
     * `/[type]/[slug]/opengraph-image` was rendering Satori on every request —
     * the one dynamic route on a site whose README claims static-only.
     *
     * Adding `generateStaticParams` + `dynamicParams = false` to an image route
     * is easy to forget precisely because the cards look right either way. This
     * asserts the property the README states, instead of the mechanism.
     */
    const appManifestPath = path.join(
      process.cwd(),
      ".next",
      "server",
      "app-paths-manifest.json",
    );
    expect(
      fs.existsSync(appManifestPath),
      "No app paths manifest - run `npm run build` before `npm test`.",
    ).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(appManifestPath, "utf8"));
    const prerender = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), ".next", "prerender-manifest.json"), "utf8"),
    );

    const prerendered = new Set([
      ...Object.keys(prerender.routes ?? {}),
      ...Object.keys(prerender.dynamicRoutes ?? {}),
    ]);

    // Framework internals are not pages and are never requested directly.
    const IGNORED = new Set(["/_not-found/page", "/_global-error/page"]);

    const dynamic = Object.keys(manifest)
      .filter((route) => !IGNORED.has(route))
      .map((route) => route.replace(/\/(page|route)$/, "") || "/")
      .filter((route) => !prerendered.has(route))
      .filter((route) => !INTENTIONALLY_DYNAMIC.has(route));

    expect(dynamic, "These routes render on demand. Give them generateStaticParams.").toEqual(
      [],
    );
  });
});
