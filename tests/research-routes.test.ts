import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { getPublishedReports, readResearchUnguarded, reportPath } from "@/lib/research";
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

  it("does not prerender a page or copy data for a report that is not published", () => {
    // content/research/_draft-fixture/ is a permanent draft, so this never
    // checks an empty list, whatever is published.
    const published = new Set(en.map((r) => r.slug));
    const drafts = [
      ...new Set(
        readResearchUnguarded()
          .filter((r) => !published.has(r.slug))
          .map((r) => r.slug),
      ),
    ];
    expect(drafts, "the permanent draft fixture is missing or was published").toContain(
      "_draft-fixture",
    );
    for (const slug of drafts) {
      const draft = { slug };
      for (const page of [`research/${draft.slug}.html`, `es/research/${draft.slug}.html`]) {
        expect(fs.existsSync(path.join(BUILD_DIR, page)), `${page} was built for a draft`).toBe(
          false,
        );
      }
      const data = path.join(process.cwd(), "public", "research", draft.slug, "data");
      expect(fs.existsSync(data), `${data} was copied for a draft`).toBe(false);
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

/**
 * The footer is rendered by the root layout on every page. On `/es/*` it picks
 * Spanish from the path. The English strings are stated literally here, not
 * read from lib/strings.ts, so a change to the English footer fails this test.
 */
const EN_SUBSCRIBE_COPY =
  "A note when something is added or a playbook lands. No schedule, because there is no point sending one when nothing has been tested. Your address is used for that and nothing else.";

describe("footer language", () => {
  it("shows the Spanish footer on Spanish research pages and not the English subscribe text", () => {
    const pages = [built("es/research.html"), ...es.map((r) => built(`es/research/${r.slug}.html`))];
    for (const page of pages) {
      expect(page).toContain(STRINGS.es.footer.subscribeCopy);
      expect(page).toContain(STRINGS.es.footer.newEntries);
      expect(page).toContain(STRINGS.es.footer.work);
      expect(page).not.toContain(EN_SUBSCRIBE_COPY);
      expect(page).not.toContain("New entries");
      expect(page).not.toContain("Work with R21");
    }
  });

  it("keeps the English footer on English pages, unchanged", () => {
    const pages = [
      built("index.html"),
      built("research.html"),
      ...en.map((r) => built(`research/${r.slug}.html`)),
    ];
    for (const page of pages) {
      expect(page).toContain(EN_SUBSCRIBE_COPY);
      expect(page).toContain("New entries");
      expect(page).toContain("Work with R21");
      expect(page).not.toContain(STRINGS.es.footer.subscribeCopy);
    }
  });

  it("keeps the footer link URLs unchanged on Spanish pages", () => {
    const page = built("es/research.html");
    for (const href of ["/blog", "/suggest", "/contact", "/terms"]) {
      expect(page).toContain(`href="${href}"`);
    }
  });
});