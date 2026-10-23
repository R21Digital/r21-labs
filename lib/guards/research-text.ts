import type { Report } from "../research";

/** Everything a reader sees: title and summary are published text, not just the body. */
export function publishedText(report: Report): string {
  return `${report.title}\n${report.summary}\n${report.body}`;
}
