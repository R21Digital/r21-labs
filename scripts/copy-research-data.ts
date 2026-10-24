/**
 * Prebuild: publish each report's data files.
 *
 * Copies every `dataFiles` entry of every published report from
 * `content/research/<slug>/` to `public/research/<slug>/data/`, which is where
 * the citation block links to. Exits 1 when a listed file is missing, so a
 * download link can never point at nothing. The completeness guard already
 * catches this inside `getPublishedReports`; this fails first with a plain
 * message when the script is run on its own.
 *
 * Only files named in `dataFiles` are copied: a draft CSV or a denylist sitting
 * in the report's `data/` folder never reaches `public/`.
 *
 * Also exits 1 when a PDF sits under `public/research/<slug>/` for a slug with
 * no published report (see `strayResearchPdfs`). PDF freshness is NOT checked
 * here: regenerating a PDF needs a finished build, so a freshness check in
 * prebuild would block the very build that fixes it. That check is in
 * tests/research-pdf.test.ts.
 */
import fs from "node:fs";
import path from "node:path";

import { getPublishedReports } from "../lib/research";
import { PUBLIC_RESEARCH_DIR as PUBLIC_DIR, strayResearchPdfs } from "../lib/research-files";

// Rebuilt from scratch each run so a file removed from `dataFiles` is removed
// from the site too.
for (const entry of fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR) : []) {
  fs.rmSync(path.join(PUBLIC_DIR, entry, "data"), { recursive: true, force: true });
}

const reports = getPublishedReports("en");

// A PDF in public/ is served whatever the report's status says. One left for a
// draft, or behind a report that went back to draft or was deleted, would
// publish it on this deploy, so the build stops here.
const strays = strayResearchPdfs(new Set(reports.map((report) => report.slug)), PUBLIC_DIR);
if (strays.length > 0) {
  console.error(
    `\nPDFs for UNPUBLISHED research reports in public/research (${strays.length}):\n  - ` +
      `${strays.join("\n  - ")}\n\n` +
      `public/ is served whatever a report's status says. Delete these files (and their ` +
      `.pdf.json manifests), or publish the report in both languages.\n`,
  );
  process.exit(1);
}

const missing: string[] = [];
let copied = 0;

for (const report of reports) {
  const target = path.join(PUBLIC_DIR, report.slug, "data");
  for (const file of report.dataFiles) {
    const source = path.resolve(report.dir, file);
    if (!fs.existsSync(source)) {
      missing.push(`${report.filePath}: ${file}`);
      continue;
    }
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(source, path.join(target, path.basename(file)));
    copied += 1;
  }
}

if (missing.length > 0) {
  console.error(`\nMISSING research data files (${missing.length}):\n  - ${missing.join("\n  - ")}\n`);
  process.exit(1);
}

console.log(
  `research data: ${copied} file${copied === 1 ? "" : "s"} for ${reports.length} report${reports.length === 1 ? "" : "s"}`,
);
