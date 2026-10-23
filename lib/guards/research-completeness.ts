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
