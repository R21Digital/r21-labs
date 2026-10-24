import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Report } from "./research";

/**
 * Checks on the files a report puts in `public/research/<slug>/`. Kept out of
 * the scripts (which run on import) so tests can call them.
 *
 * Everything in `public/` is served whatever a report's status says, so these
 * are publishing guards in the same sense as the content guards.
 */

export const PUBLIC_RESEARCH_DIR = path.join(process.cwd(), "public", "research");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) return walk(full);
    return item.isFile() ? [full] : [];
  });
}

/**
 * PDFs under `public/research/<slug>/` for a slug with no published report:
 * a draft's PDF committed by mistake, or one left behind when a report went
 * back to draft or was deleted. Each would be served on the next deploy.
 * Returned as `<slug>/<file>` paths.
 */
export function strayResearchPdfs(publishedSlugs: Set<string>, publicDir = PUBLIC_RESEARCH_DIR): string[] {
  if (!fs.existsSync(publicDir)) return [];
  return fs
    .readdirSync(publicDir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && !publishedSlugs.has(item.name))
    .flatMap((item) =>
      walk(path.join(publicDir, item.name))
        .filter((file) => file.toLowerCase().endsWith(".pdf"))
        .map((file) => path.relative(publicDir, file).split(path.sep).join("/")),
    )
    .sort();
}

export function researchPdfPath(report: Report, publicDir = PUBLIC_RESEARCH_DIR): string {
  return path.join(publicDir, report.slug, `${report.slug}.${report.lang}.pdf`);
}

/** Where the record of what a PDF was printed from lives: next to it. */
export function researchPdfManifestPath(report: Report, publicDir = PUBLIC_RESEARCH_DIR): string {
  return `${researchPdfPath(report, publicDir)}.json`;
}

export interface PdfManifest {
  /** SHA-256 of each source file, keyed by its path inside the report folder. */
  sources: Record<string, string>;
}

/**
 * Hash a text source. Line endings are normalized first, so a Windows
 * checkout (CRLF) and a macOS one (LF) agree on the same commit.
 */
function sourceHash(file: string): string {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text).digest("hex");
}

/**
 * What a report's PDF in one language is printed from: that language's
 * `index.<lang>.mdx` and every `dataFiles` entry. A missing file is recorded as
 * `missing`, so the comparison still fails rather than throwing.
 */
export function pdfManifestFor(report: Report): PdfManifest {
  const sources: Record<string, string> = {};
  for (const file of [`index.${report.lang}.mdx`, ...report.dataFiles]) {
    const full = path.resolve(report.dir, file);
    sources[file] = fs.existsSync(full) ? sourceHash(full) : "missing";
  }
  return { sources };
}

/**
 * Why a committed PDF no longer matches its sources, or null when it does.
 * The message names files, never their contents.
 */
export function stalePdfReason(report: Report, publicDir = PUBLIC_RESEARCH_DIR): string | null {
  const manifestPath = researchPdfManifestPath(report, publicDir);
  if (!fs.existsSync(manifestPath)) {
    return `${path.basename(manifestPath)} is missing, so the PDF cannot be shown to match its sources`;
  }
  const recorded = (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PdfManifest).sources ?? {};
  const current = pdfManifestFor(report).sources;
  const changed = [...new Set([...Object.keys(recorded), ...Object.keys(current)])]
    .filter((file) => recorded[file] !== current[file])
    .sort();
  return changed.length === 0
    ? null
    : `the PDF was printed from different sources (changed: ${changed.join(", ")})`;
}
