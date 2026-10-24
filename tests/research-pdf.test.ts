import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getPublishedReports, type Lang, type Report } from "@/lib/research";
import {
  pdfManifestFor,
  researchPdfManifestPath,
  researchPdfPath,
  stalePdfReason,
  strayResearchPdfs,
} from "@/lib/research-files";

/**
 * Every published report ships a committed PDF in each language, printed from
 * the sources as they are now.
 *
 * The citation block always links `/research/<slug>/<slug>.<lang>.pdf`, and
 * Vercel's build image has no browser, so the PDFs are produced locally by
 * `npm run research:pdf` and committed. This is the gate that keeps a published
 * report from linking to a 404, or to a PDF of an older version of itself. Run
 * via `npm run verify`.
 *
 * The freshness check lives here and not in prebuild on purpose: regenerating
 * a PDF needs a finished build, so a prebuild check would block the build that
 * fixes it.
 */

const LANGS: Lang[] = ["en", "es"];
const REGENERATE = "re-run npm run build && npm run research:pdf";

describe("research PDFs", () => {
  for (const lang of LANGS) {
    const reports = getPublishedReports(lang);

    it(`${lang}: reads the published list (${reports.length})`, () => {
      expect(Array.isArray(reports)).toBe(true);
    });

    for (const report of reports) {
      it(`${report.slug}.${lang}.pdf exists and is a PDF`, () => {
        const file = researchPdfPath(report);
        expect(fs.existsSync(file), `missing ${file} (run npm run research:pdf)`).toBe(true);
        expect(fs.readFileSync(file).subarray(0, 4).toString("latin1")).toBe("%PDF");
      });

      it(`${report.slug}.${lang}.pdf was printed from the current sources`, () => {
        const reason = stalePdfReason(report);
        expect(reason, `${report.slug}.${lang}.pdf: ${reason}; ${REGENERATE}`).toBeNull();
      });
    }
  }

  it("ships no PDF for a report that is not published", () => {
    // Files in public/ are served whatever the report's status, so a PDF left
    // behind for a draft (or for a deleted report) publishes it on the next
    // deploy. This holds with zero published reports: then no PDF may exist.
    // Prebuild (scripts/copy-research-data.ts) runs the same check.
    const published = new Set(getPublishedReports("en").map((r) => r.slug));
    expect(strayResearchPdfs(published), "PDFs for unpublished reports in public/research").toEqual(
      [],
    );
  });
});

describe("research PDF file checks", () => {
  function tempReport(): { report: Report; root: string; publicDir: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "research-pdf-"));
    const dir = path.join(root, "content", "census");
    fs.mkdirSync(path.join(dir, "data"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.en.mdx"), "---\ntitle: x\n---\nBody\n");
    fs.writeFileSync(path.join(dir, "data", "stats.json"), '{"labels":[]}\n');
    const report = {
      slug: "census",
      dir,
      filePath: "census/index.en.mdx",
      lang: "en",
      kind: "measurement",
      title: "x",
      status: "published",
      publishedOn: "2026-11-10",
      summary: "",
      author: "Carlos Jimenez, R21 Digital",
      pair: "index.es.mdx",
      issue: 1,
      measuredOn: "2026-10-22",
      dataFiles: ["data/stats.json"],
      body: "",
    } satisfies Report;
    return { report, root, publicDir: path.join(root, "public") };
  }

  function writeManifest(report: Report, publicDir: string) {
    const file = researchPdfManifestPath(report, publicDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(pdfManifestFor(report)));
  }

  it("finds PDFs for unpublished slugs, at any depth, and ignores published ones", () => {
    const { root, publicDir } = tempReport();
    for (const file of ["live/live.en.pdf", "draft/draft.en.pdf", "gone/old/gone.es.PDF"]) {
      fs.mkdirSync(path.dirname(path.join(publicDir, file)), { recursive: true });
      fs.writeFileSync(path.join(publicDir, file), "%PDF");
    }
    fs.mkdirSync(path.join(publicDir, "draft", "data"), { recursive: true });
    fs.writeFileSync(path.join(publicDir, "draft", "data", "stats.json"), "{}");

    expect(strayResearchPdfs(new Set(["live"]), publicDir)).toEqual([
      "draft/draft.en.pdf",
      "gone/old/gone.es.PDF",
    ]);
    expect(strayResearchPdfs(new Set(["live", "draft", "gone"]), publicDir)).toEqual([]);
    expect(strayResearchPdfs(new Set(), path.join(root, "nope"))).toEqual([]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("accepts a manifest that matches, even across CRLF and LF checkouts", () => {
    const { report, root, publicDir } = tempReport();
    writeManifest(report, publicDir);
    expect(stalePdfReason(report, publicDir)).toBeNull();
    const mdx = path.join(report.dir, "index.en.mdx");
    fs.writeFileSync(mdx, fs.readFileSync(mdx, "utf8").replace(/\n/g, "\r\n"));
    expect(stalePdfReason(report, publicDir)).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("fails a missing manifest", () => {
    const { report, root, publicDir } = tempReport();
    expect(stalePdfReason(report, publicDir)).toMatch(/census\.en\.pdf\.json is missing/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("fails when the report or a data file changed after printing", () => {
    const { report, root, publicDir } = tempReport();
    writeManifest(report, publicDir);
    fs.appendFileSync(path.join(report.dir, "index.en.mdx"), "One more line.\n");
    expect(stalePdfReason(report, publicDir)).toMatch(/changed: index\.en\.mdx/);

    writeManifest(report, publicDir);
    fs.writeFileSync(path.join(report.dir, "data", "stats.json"), '{"labels":["3.3%"]}\n');
    expect(stalePdfReason(report, publicDir)).toMatch(/changed: data\/stats\.json/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("fails when dataFiles gained a file after printing", () => {
    const { report, root, publicDir } = tempReport();
    writeManifest(report, publicDir);
    fs.writeFileSync(path.join(report.dir, "data", "METHOD.md"), "# Method\n");
    const grown = { ...report, dataFiles: [...report.dataFiles, "data/METHOD.md"] };
    expect(stalePdfReason(grown, publicDir)).toMatch(/changed: data\/METHOD\.md/);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
