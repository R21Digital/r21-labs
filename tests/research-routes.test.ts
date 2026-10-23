import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { getPublishedReports, reportPath } from "@/lib/research";
import { SITE_URL } from "@/lib/site";
import { STRINGS } from "@/lib/strings";

/**
 * The research routes, asserted against BUILT OUTPUT (same approach as
 * tests/discovery.test.ts). Run `npm run build` first.
 *
 * Per-report assertions loop over whatever is published, so the suite does not
 * hard-code a slug. The index pages are asserted unconditionally, which keeps
 * this file meaningful while zero reports are published.
 */

const BUILD_DIR = path.join(process.cwd(), ".next", "server", "app");

function built(file: string): string {
  const full = path.join(BUILD_DIR, file);
  expect(fs.existsSync(full), `${file} is not in the build output.`).toBe(true);
  return fs.readFileSync(full, "utf8");
}

// React serializes the attribute as `hrefLang`; HTML attribute names are
// case-insensitive, so match on that footing.
const HREFLANG_ES = /hreflang="es"/i;
const HREFLANG_EN = /hreflang="en"/i;
const HREFLANG_DEFAULT = /hreflang="x-default"/i;

const en = getPublishedReports("en");
const es = getPublishedReports("es");

describe("research index pages", () => {
  it("builds both index pages with their own language marker", () => {
    expect(built("research.html")).toContain(STRINGS.en.indexTitle);
    const spanish = built("es/research.html");
    expect(spanish).toContain('lang="es"');
    expect(spanish).toContain(STRINGS.es.indexTitle);
  });

  it("lists every published report on its language index, with a link to the twin", () => {
    const enIndex = built("research.html");
    const esIndex = built("es/research.html");
    for (const report of en) {
      expect(enIndex).toContain(`href="${reportPath(report)}"`);
      expect(enIndex).toContain(`href="/es/research/${report.slug}"`);
    }
    for (const report of es) {
      expect(esIndex).toContain(`href="${reportPath(report)}"`);
      expect(esIndex).toContain(`href="/research/${report.slug}"`);
    }
  });
});

describe("research report pages", () => {
  it("has the same published slugs in both languages", () => {
    expect(en.map((r) => r.slug).sort()).toEqual(es.map((r) => r.slug).sort());
  });

  it("renders both language pages with hreflang pairs", () => {
    for (const report of en) {
      const enPage = built(`research/${report.slug}.html`);
      const esPage = built(`es/research/${report.slug}.html`);
      expect(enPage).toMatch(HREFLANG_ES);
      expect(enPage).toContain(`href="${SITE_URL}/es/research/${report.slug}"`);
      expect(esPage).toMatch(HREFLANG_EN);
      expect(esPage).toMatch(HREFLANG_DEFAULT);
      expect(esPage).toContain(`href="${SITE_URL}/research/${report.slug}"`);
    }
  });

  it("marks the Spanish article as Spanish", () => {
    for (const report of es) {
      expect(built(`es/research/${report.slug}.html`)).toContain('lang="es"');
    }
  });

  it("shows the byline, the citation block and data download links", () => {
    for (const report of [...en, ...es]) {
      const page = built(`${reportPath(report).slice(1)}.html`);
      expect(page).toContain(report.author);
      expect(page).toContain("<details");
      expect(page).toContain("@misc");
      for (const file of report.dataFiles) {
        expect(page).toContain(`/research/${report.slug}/data/${path.basename(file)}`);
      }
    }
  });

  it("copies data files to public at build", () => {
    for (const report of en) {
      for (const file of report.dataFiles) {
        const copied = path.join(
          process.cwd(),
          "public",
          "research",
          report.slug,
          "data",
          path.basename(file),
        );
        expect(fs.existsSync(copied), `${copied} was not copied.`).toBe(true);
      }
    }
  });
});
