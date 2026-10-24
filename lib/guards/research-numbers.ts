import type { Report } from "../research";
import { publishedText } from "./research-text";

/**
 * Research guard 2 — every figure in the prose is backed by the data.
 *
 * A measurement ships `data/stats.json` with a `labels` list holding every
 * figure the prose quotes, written the way the numbers are computed. The prose
 * may format them for its language (`3,3 %` in Spanish, `3.3%` in English), so
 * tokens are normalised before lookup, never forced into one formatting.
 *
 * A field note has no dataset. If it ships no stats file, each sentence that
 * quotes a figure has to carry a link or a footnote to where the figure came from.
 */

const PERCENT = String.raw`\d+(?:[.,]\d+)?\s?%`;
// A range is ONE token. It is tried first so its trailing percent is not
// reported a second time.
const RANGE = String.raw`\d+(?:[.,]\d+)?\s?%?\s?[–-]\s?\d+(?:[.,]\d+)?\s?%`;
// `*n*`, `_n_` and `**n**` are the same count in prose; emphasis must not hide it.
const COUNT = String.raw`(?<![A-Za-z])(?:\*\*|\*|__|_)?[nN](?:\*\*|\*|__|_)?\s*=\s*\d+(?:[.,]\d{3})*`;
const FIGURE = new RegExp(`(?<![\\d.,])(?:${RANGE}|${PERCENT})|${COUNT}`, "g");

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const ISSUE_NUMBER = /\b(?:issue|edici[oó]n)\s+\d+/gi;

/** Figures quoted in prose, as written. Years, ISO dates and issue numbers are not figures. */
export function figureTokens(body: string): string[] {
  const text = body.replace(ISO_DATE, " ").replace(ISSUE_NUMBER, " ");
  return text.match(FIGURE) ?? [];
}

function normalizeFigure(token: string): string {
  const compact = token
    .toLowerCase()
    .replace(/[\s*_]+/g, "")
    .replace(/-/g, "–");
  return compact.startsWith("n=")
    ? `n=${compact.slice(2).replace(/[.,]/g, "")}`
    : compact;
}

function candidates(token: string): string[] {
  const normal = normalizeFigure(token);
  if (normal.startsWith("n=")) return [normal];
  const swapped = normal.replace(/[.,]/g, (c) => (c === "," ? "." : ","));
  return [normal, swapped];
}

function sentencesWithFigures(body: string): string[] {
  return body
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => figureTokens(sentence).length > 0);
}

export function checkResearchNumbers(
  reports: Report[],
  readStats: (report: Report) => { labels: string[] } | null,
): string[] {
  const errors: string[] = [];

  for (const report of reports) {
    const stats = readStats(report);

    if (stats === null) {
      if (report.kind === "field-note") {
        for (const sentence of sentencesWithFigures(publishedText(report))) {
          if (!sentence.includes("](") && !sentence.includes("[^")) {
            errors.push(
              `${report.filePath}: figure without a source in "${sentence.trim().slice(0, 80)}": ` +
                `a field note with no data/stats.json must link or footnote every figure`,
            );
          }
        }
      } else if (figureTokens(publishedText(report)).length > 0) {
        errors.push(
          `${report.filePath}: the text quotes figures but there is no data/stats.json to check them against`,
        );
      }
      continue;
    }

    const known = new Set(stats.labels.map(normalizeFigure));
    for (const token of new Set(figureTokens(publishedText(report)))) {
      if (!candidates(token).some((candidate) => known.has(candidate))) {
        errors.push(
          `${report.filePath}: figure "${token}" is not in data/stats.json labels; ` +
            `the prose and the data must agree`,
        );
      }
    }
  }

  return errors;
}
