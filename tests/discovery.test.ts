import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { getPublishedEntries, readEntriesUnguarded } from "@/lib/content";
import { SITE_URL, canonicalPath } from "@/lib/site";

/**
 * The discovery layer, asserted against BUILT OUTPUT.
 *
 * Why this file exists: on 2026-08-22 the live site served `robots.txt` 404,
 * `sitemap.xml` 404, zero OpenGraph tags, zero canonicals, and ONE title —
 * `R21 Labs` — shared by all eleven entry pages. Eleven identical results in a
 * SERP, on a site whose second stated goal is SEO.
 *
 * The gap was invisible because two files were written expecting a sitemap and
 * a feed that nobody was assigned to build: lib/content.ts documents itself as
 * "Every route, the sitemap, and the RSS feed read through this", and
 * draft-leak.test.ts says sitemap and RSS "arrive in Phase 4 and are picked up
 * automatically". Phase 4's task rows were hero, directory, playbook template,
 * entry pages. The discovery layer fell between the tables.
 *
 * Prose in a comment is not a guard. This is the guard.
 */

const BUILD_DIR = path.join(process.cwd(), ".next", "server", "app");

/**
 * Next emits a metadata route as `sitemap.xml.body`, not `sitemap.xml` — the
 * extension is a payload marker, not the served name. Matching on a trailing
 * `.xml` therefore finds nothing and the test passes vacuously, which is the
 * exact failure mode this file was written to end. Match by STEM.
 */
function builtFile(stem: string): string | null {
  if (!fs.existsSync(BUILD_DIR)) return null;
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
      const full = path.join(dir, item.name);
      return item.isDirectory() ? walk(full) : [full];
    });
  return walk(BUILD_DIR).find((f) => path.basename(f).startsWith(stem)) ?? null;
}

/**
 * `_global-error` is Next's own last-resort boundary. It REPLACES the root
 * layout — that is its whole purpose — so it structurally cannot inherit the
 * layout's metadata or JSON-LD, and it is never linked, indexed, or shared.
 * Excluded by name rather than by a wildcard, so a real page starting with an
 * underscore would still be checked.
 */
const FRAMEWORK_PAGES = new Set(["_global-error.html"]);

function builtHtml(): Array<{ file: string; html: string }> {
  if (!fs.existsSync(BUILD_DIR)) return [];
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) return walk(full);
      return item.name.endsWith(".html") ? [full] : [];
    });
  return walk(BUILD_DIR)
    .filter((file) => !FRAMEWORK_PAGES.has(path.basename(file)))
    .map((file) => ({
      file: path.relative(BUILD_DIR, file),
      html: fs.readFileSync(file, "utf8"),
    }));
}

/** Metadata values are HTML-escaped in the output; compare on the same footing. */
function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

describe("discovery layer — build output", () => {
  const pages = builtHtml();

  it("has build output to inspect", () => {
    // A FAILURE, not a skip. A skipped test reads green in CI.
    expect(
      pages.length,
      "No built HTML found — run `npm run build` before `npm test`.",
    ).toBeGreaterThan(0);
  });

  it("emits a sitemap", () => {
    expect(builtFile("sitemap.xml"), "No sitemap in build output.").not.toBeNull();
  });

  it("emits robots, and it points at the sitemap", () => {
    const robots = builtFile("robots.txt");
    expect(robots, "No robots.txt in build output.").not.toBeNull();

    const body = fs.readFileSync(robots as string, "utf8");
    // A robots.txt that does not name the sitemap is decoration. The whole
    // point is telling a crawler where the index is.
    expect(body).toContain(`${SITE_URL}/sitemap.xml`);
  });

  it("lists every published entry in the sitemap, and nothing else", () => {
    const sitemap = fs.readFileSync(builtFile("sitemap.xml") as string, "utf8");
    const listed = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decode(m[1]));

    const expected = [
      SITE_URL,
      ...getPublishedEntries().map((entry) => `${SITE_URL}${canonicalPath(entry)}`),
    ];

    expect([...listed].sort()).toEqual([...expected].sort());
  });

  it("gives every page its own title", () => {
    const titles = pages.map(({ file, html }) => ({
      file,
      title: decode(/<title>(.*?)<\/title>/.exec(html)?.[1] ?? ""),
    }));

    const missing = titles.filter((t) => t.title === "");
    expect(missing.map((t) => t.file), "Pages with no <title>.").toEqual([]);

    // The defect verbatim: eleven entry pages all titled "R21 Labs". A
    // duplicate title is not a style problem — it is eleven identical SERP rows.
    const seen = new Map<string, string[]>();
    for (const { file, title } of titles) {
      seen.set(title, [...(seen.get(title) ?? []), file]);
    }
    const duplicated = [...seen.entries()].filter(([, files]) => files.length > 1);
    expect(
      duplicated.map(([title, files]) => `"${title}" on ${files.join(", ")}`),
      "Duplicate <title> across pages.",
    ).toEqual([]);
  });

  it("gives every page its own description", () => {
    const descriptions = pages.map(({ file, html }) => ({
      file,
      description: decode(
        /<meta name="description" content="(.*?)"/.exec(html)?.[1] ?? "",
      ),
    }));

    expect(
      descriptions.filter((d) => d.description === "").map((d) => d.file),
      "Pages with no meta description.",
    ).toEqual([]);

    const seen = new Map<string, string[]>();
    for (const { file, description } of descriptions) {
      seen.set(description, [...(seen.get(description) ?? []), file]);
    }
    expect(
      [...seen.entries()]
        .filter(([, files]) => files.length > 1)
        .map(([desc, files]) => `"${desc.slice(0, 40)}…" on ${files.join(", ")}`),
      "Duplicate meta description across pages.",
    ).toEqual([]);
  });

  it("gives every page a canonical and an absolute OpenGraph image", () => {
    for (const { file, html } of pages) {
      expect(
        /<link rel="canonical"/.test(html),
        `${file} has no canonical URL.`,
      ).toBe(true);

      const ogImage = /<meta property="og:image" content="(.*?)"/.exec(html)?.[1];
      expect(ogImage, `${file} has no og:image.`).toBeTruthy();
      // A relative og:image is ignored by every scraper. This is the single
      // most common way an OpenGraph block looks correct and does nothing.
      expect(
        decode(ogImage as string).startsWith("http"),
        `${file} has a RELATIVE og:image (${ogImage}) — scrapers ignore it.`,
      ).toBe(true);
    }
  });

  it("keeps drafts out of the feed", () => {
    const feed = builtFile("feed.xml");
    expect(feed, "No RSS feed in build output.").not.toBeNull();

    const body = fs.readFileSync(feed as string, "utf8");
    const drafts = readEntriesUnguarded().filter((e) => e.status !== "published");

    // Vacuity guard, same reasoning as draft-leak.test.ts.
    expect(
      drafts.length,
      "No drafts exist, so this assertion proves nothing.",
    ).toBeGreaterThan(0);

    for (const draft of drafts) {
      expect(body.includes(draft.slug), `Draft "${draft.slug}" leaked into the feed.`).toBe(
        false,
      );
    }
  });

  it("describes itself to machines with structured data", () => {
    // Goal 2 of the spec is AI citability. A crawler that cannot tell what
    // kind of thing a page is has to guess from prose.
    for (const { file, html } of pages) {
      expect(
        html.includes('type="application/ld+json"'),
        `${file} carries no JSON-LD.`,
      ).toBe(true);
    }
  });
});
