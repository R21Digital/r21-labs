import type { Report } from "../research";

/**
 * Research guard 4 — every published report is published in both languages,
 * and the two files describe the same measurement.
 *
 * Receives the published reports of ALL languages. A twin that is a draft was
 * filtered out upstream, so it looks the same as a twin that does not exist:
 * either way the published side has no published twin, and that is the error.
 */

const SHARED_FIELDS = ["issue", "measuredOn", "sampleSize", "publishedOn"] as const;

export function checkResearchPairing(reports: Report[]): string[] {
  const errors: string[] = [];

  for (const report of reports) {
    const fail = (msg: string) => errors.push(`${report.filePath}: ${msg}`);
    const otherLang = report.lang === "en" ? "es" : "en";
    const expectedPair = `index.${otherLang}.mdx`;

    if (report.pair !== expectedPair) {
      fail(`\`pair\` is \`${report.pair}\` but this file's twin is \`${expectedPair}\``);
    }

    const twin = reports.find((r) => r.slug === report.slug && r.lang === otherLang);
    if (!twin) {
      fail(
        `no published twin: \`${expectedPair}\` is a draft or missing; ` +
          `publish both languages together`,
      );
      continue;
    }

    // Compare once per pair, from the English side.
    if (report.lang !== "en") continue;
    for (const field of SHARED_FIELDS) {
      if (report[field] !== twin[field]) {
        fail(
          `\`${field}\` differs from its twin ${twin.filePath} ` +
            `(${String(report[field])} vs ${String(twin[field])})`,
        );
      }
    }
  }

  return errors;
}
