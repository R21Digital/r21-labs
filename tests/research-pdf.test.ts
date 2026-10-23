import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { getPublishedReports, type Lang } from "@/lib/research";

/**
 * Every published report ships a committed PDF in each language.
 *
 * The citation block always links `/research/<slug>/<slug>.<lang>.pdf`, and
 * Vercel's build image has no browser, so the PDFs are produced locally by
 * `npm run research:pdf` and committed. This is the gate that keeps a published
 * report from linking to a 404. Run via `npm run verify`.
 */

const LANGS: Lang[] = ["en", "es"];

describe("research PDFs", () => {
  for (const lang of LANGS) {
    const reports = getPublishedReports(lang);

    it(`${lang}: reads the published list (${reports.length})`, () => {
      expect(Array.isArray(reports)).toBe(true);
    });

    for (const report of reports) {
      it(`${report.slug}.${lang}.pdf exists and is a PDF`, () => {
        const file = path.join(
          process.cwd(),
          "public",
          "research",
          report.slug,
          `${report.slug}.${lang}.pdf`,
        );
        expect(fs.existsSync(file), `missing ${file} (run npm run research:pdf)`).toBe(true);
        expect(fs.readFileSync(file).subarray(0, 4).toString("latin1")).toBe("%PDF");
      });
    }
  }
});
