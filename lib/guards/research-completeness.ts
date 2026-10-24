import fs from "node:fs";
import path from "node:path";

import type { Report } from "../research";

/**
 * Research guard 1 — a published report is complete.
 *
 * Author and measuredOn are re-checked here even though the reader validates
 * shape, so this guard stands on its own when called with hand-built reports.
 * A measurement must describe its method; a field note must name its sources.
 * Every file the front matter lists as data has to exist inside the report folder.
 * When data/stats.json carries a top-level `n`, `sampleSize` must equal it, so
 * the denominator printed in the byline is the one the figures use.
 */

const HEADINGS = {
  measurement: { en: "Method", es: "Método" },
  "field-note": { en: "Sources", es: "Fuentes" },
} as const;

function hasHeading(body: string, title: string): boolean {
  const wanted = title.normalize("NFC").toLowerCase();
  return body
    .normalize("NFC")
    .split(/\r?\n/)
    .some((line) => {
      const match = /^##\s+(.+?)\s*#*\s*$/.exec(line);
      return match !== null && match[1].toLowerCase() === wanted;
    });
}

/**
 * The top-level `n` of `data/stats.json`, or null when there is no stats file,
 * no numeric `n`, or the file does not parse (the numbers guard reports that).
 */
function topLevelN(report: Report): number | null {
  const file = path.join(report.dir, "data", "stats.json");
  if (!fs.existsSync(file)) return null;
  try {
    const n = (JSON.parse(fs.readFileSync(file, "utf8")) as { n?: unknown } | null)?.n;
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

function isAbsoluteLike(file: string): boolean {
  return path.isAbsolute(file) || /^[a-zA-Z]:/.test(file) || /^[\\/]/.test(file);
}

export function checkResearchCompleteness(reports: Report[]): string[] {
  const errors: string[] = [];

  for (const report of reports) {
    const fail = (msg: string) => errors.push(`${report.filePath}: ${msg}`);

    if (report.author.trim() === "") fail("`author` is empty");
    if (report.measuredOn.trim() === "") fail("`measuredOn` is empty");

    const heading = HEADINGS[report.kind][report.lang];
    if (!hasHeading(report.body, heading)) {
      fail(
        report.kind === "measurement"
          ? `a measurement needs a \`## ${heading}\` heading describing how it was measured`
          : `a field note needs a \`## ${heading}\` heading listing its sources`,
      );
    }

    const statsN = topLevelN(report);
    if (statsN !== null && report.sampleSize !== statsN) {
      fail(
        `\`sampleSize\` is ${report.sampleSize ?? "missing"} but data/stats.json says n = ${statsN}; ` +
          `the headline denominator must match the data`,
      );
    }

    for (const file of report.dataFiles) {
      if (isAbsoluteLike(file)) {
        fail(`dataFiles entry \`${file}\` is an absolute path; use a path inside the report folder`);
        continue;
      }
      const resolved = path.resolve(report.dir, file);
      const relative = path.relative(report.dir, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        fail(`dataFiles entry \`${file}\` points outside the report folder`);
        continue;
      }
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        fail(`dataFiles entry \`${file}\` does not exist in the report folder`);
      }
    }
  }

  return errors;
}
