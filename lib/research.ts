import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { checkResearchCompleteness } from "./guards/research-completeness";
import { checkResearchDenylist, parseDenylist, type Denylist } from "./guards/research-denylist";
import { checkResearchNumbers } from "./guards/research-numbers";
import { checkResearchPairing } from "./guards/research-pairing";
import { isIsoDate } from "./schema";

/**
 * Research reports. A third surface, next to catalog entries and notes.
 *
 * A report is a folder, `content/research/<slug>/`, holding a paired
 * `index.en.mdx` / `index.es.mdx` and a `data/` folder with the numbers the
 * prose quotes. Entries are third-party tools and notes are single-file posts,
 * so neither reader walks this folder, and this reader walks neither of theirs.
 *
 * Same choke-point shape as notes: routes call `getPublishedReports()`. The raw
 * reader keeps drafts and is fenced off from `app/` by tests/boundary.test.ts.
 */

export const RESEARCH_DIR = path.join(process.cwd(), "content", "research");

export type Lang = "en" | "es";
export type ReportKind = "measurement" | "field-note";

export interface Report {
  /** Folder name; becomes the URL segment. */
  slug: string;
  /** Absolute path of the report folder, so guards can read `data/`. */
  dir: string;
  /** Path of the .mdx file relative to the research root, for error messages. */
  filePath: string;
  lang: Lang;
  kind: ReportKind;
  title: string;
  status: "draft" | "published";
  publishedOn: string;
  summary: string;
  author: string;
  /** File name of the other-language twin, e.g. `index.es.mdx`. */
  pair: string;
  issue: number;
  measuredOn: string;
  sampleSize?: number;
  dataFiles: string[];
  body: string;
}

const FILE_NAME = /^index\.(en|es)\.mdx$/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) return walk(full);
    return item.isFile() && full.endsWith(".mdx") ? [full] : [];
  });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function validateReport(
  data: Record<string, unknown>,
  filePath: string,
  fileLang: Lang | undefined,
): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`${filePath}: ${msg}`);

  if (!fileLang) {
    fail("file name must be `index.en.mdx` or `index.es.mdx`");
  }
  if (data.lang !== "en" && data.lang !== "es") {
    fail("`lang` must be `en` or `es`");
  } else if (fileLang && data.lang !== fileLang) {
    fail(`\`lang\` is \`${data.lang}\` but the file name says \`${fileLang}\``);
  }
  if (!nonEmptyString(data.title)) {
    fail("`title` is required and must be a non-empty string");
  }
  if (data.status !== "draft" && data.status !== "published") {
    fail("`status` must be `draft` or `published`");
  }
  if (data.kind !== "measurement" && data.kind !== "field-note") {
    fail("`kind` must be `measurement` or `field-note`");
  }
  if (!nonEmptyString(data.author)) {
    fail("`author` is required and must be a non-empty string");
  }
  if (!nonEmptyString(data.pair)) {
    fail("`pair` is required (the file name of the other-language twin)");
  }
  if (!Number.isInteger(data.issue) || (data.issue as number) < 1) {
    fail("`issue` is required and must be an integer >= 1");
  }
  if (!isIsoDate(data.measuredOn)) {
    fail("`measuredOn` is required (YYYY-MM-DD)");
  }
  if (
    data.sampleSize !== undefined &&
    (!Number.isInteger(data.sampleSize) || (data.sampleSize as number) < 1)
  ) {
    fail("`sampleSize` must be an integer >= 1 when present");
  }
  if (
    data.dataFiles !== undefined &&
    (!Array.isArray(data.dataFiles) || !data.dataFiles.every(nonEmptyString))
  ) {
    fail("`dataFiles` must be a list of file paths");
  }
  if (data.status === "published") {
    if (!isIsoDate(data.publishedOn)) {
      fail("`publishedOn` is required on a published report (YYYY-MM-DD)");
    }
    if (typeof data.summary !== "string" || data.summary.trim().length < 40) {
      fail("`summary` is required on a published report (one sentence, >=40 chars)");
    }
  }
  return errors;
}

function normalize(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const key of ["publishedOn", "measuredOn"]) {
    const value = out[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      out[key] = value.toISOString().slice(0, 10);
    }
  }
  return out;
}

/**
 * Raw reader. Returns DRAFTS. Not for routes, sitemaps, feeds, or handlers.
 * tests/boundary.test.ts fails the suite if anything under app/ imports this.
 */
export function readResearchUnguarded(dir: string = RESEARCH_DIR): Report[] {
  const reports: Report[] = [];
  const errors: string[] = [];

  for (const file of walk(dir)) {
    const relative = path.relative(dir, file).split(path.sep).join("/");
    const fileLang = FILE_NAME.exec(path.basename(file))?.[1] as Lang | undefined;
    const parsed = matter(fs.readFileSync(file, "utf8"));
    const data = normalize(parsed.data);
    const shapeErrors = validateReport(data, relative, fileLang);
    if (shapeErrors.length > 0) {
      errors.push(...shapeErrors);
      continue;
    }
    reports.push({
      slug: path.basename(path.dirname(file)),
      dir: path.dirname(file),
      filePath: relative,
      lang: data.lang as Lang,
      kind: data.kind as ReportKind,
      title: data.title as string,
      status: data.status as Report["status"],
      publishedOn: (data.publishedOn as string) ?? "",
      summary: (data.summary as string) ?? "",
      author: data.author as string,
      pair: data.pair as string,
      issue: data.issue as number,
      measuredOn: data.measuredOn as string,
      sampleSize: data.sampleSize as number | undefined,
      dataFiles: (data.dataFiles as string[] | undefined) ?? [],
      body: parsed.content,
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `Research schema validation failed (${errors.length}):\n  - ${errors.join("\n  - ")}`,
    );
  }

  const keys = reports.map((r) => `${r.slug}/${r.lang}`);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate research reports: ${[...new Set(duplicates)].join(", ")}`);
  }

  return reports;
}

function readDataFile(report: Report, name: string): string | null {
  const file = path.join(report.dir, "data", name);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

/** `data/stats.json` of a report, or null when it ships none. */
export function readReportStats(report: Report): { labels: string[] } | null {
  const raw = readDataFile(report, "stats.json");
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  const labels = (parsed as { labels?: unknown } | null)?.labels;
  if (!Array.isArray(labels) || !labels.every((l) => typeof l === "string")) {
    throw new Error(`${report.filePath}: data/stats.json needs a \`labels\` list of strings`);
  }
  return { labels };
}

/**
 * HMAC-SHA256 hashes from `data/denylist.sha256`. Empty when the file is absent;
 * the guard decides whether absence is allowed. A line that is not exactly 64
 * lowercase hex characters is reported by line number, never by content.
 */
export function readReportDenylist(report: Report): Denylist {
  const raw = readDataFile(report, "denylist.sha256") ?? "";
  return parseDenylist(raw);
}

/**
 * The data text a published report could leak a domain through: every file it
 * offers for download (`dataFiles`, stats.json included), plus METHOD.md and
 * results.csv whether or not they are listed. A path outside the report folder
 * is skipped here; the completeness guard reports it.
 */
export function readReportDataText(report: Report): string {
  const files = new Set(
    ["data/METHOD.md", "data/results.csv", ...report.dataFiles].map((file) =>
      path.resolve(report.dir, file),
    ),
  );
  const texts: string[] = [];
  for (const file of files) {
    const relative = path.relative(report.dir, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) texts.push(fs.readFileSync(file, "utf8"));
  }
  return texts.join("\n");
}

/**
 * Publishing guards for research. Takes the published reports of ALL languages
 * so pairing can see both twins. Returns error strings; empty means clean.
 */
export function runResearchGuards(
  reports: Report[],
  denylistKey: string | undefined = process.env.RESEARCH_DENYLIST_KEY,
): string[] {
  return [
    ...checkResearchCompleteness(reports),
    ...checkResearchNumbers(reports, readReportStats),
    ...checkResearchDenylist(reports, readReportDenylist, readReportDataText, denylistKey),
    ...checkResearchPairing(reports),
  ];
}

export function getPublishedReports(lang: Lang, dir: string = RESEARCH_DIR): Report[] {
  const published = readResearchUnguarded(dir).filter((r) => r.status === "published");

  const errors = runResearchGuards(published);
  if (errors.length > 0) {
    throw new Error(
      `Research guards failed (${errors.length}):\n  - ${errors.join("\n  - ")}\n\n` +
        `Fix the report. Never soften a guard to get the build green.`,
    );
  }

  return published
    .filter((r) => r.lang === lang)
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}

export function reportPath(report: Report): string {
  return report.lang === "es"
    ? `/es/research/${report.slug}`
    : `/research/${report.slug}`;
}

export function twinOf(report: Report, all: Report[]): Report | undefined {
  return all.find((r) => r.slug === report.slug && r.lang !== report.lang);
}
