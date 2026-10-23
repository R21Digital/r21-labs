import { createHash } from "node:crypto";

import type { Report } from "../research";

/**
 * Research guard 3 — no real sampled domain appears in published text.
 *
 * The report studies real sites, and naming one is a decision, not an accident.
 * `data/denylist.sha256` holds the SHA-256 of each sampled domain, so the list
 * itself leaks nothing. Every hostname-shaped token in the prose, in
 * `data/METHOD.md` and in `data/results.csv` is hashed and looked up.
 *
 * Errors name the file and a short hash prefix, never the domain: the build log
 * is also published somewhere.
 */

const DOMAIN = /[a-z0-9-]+(?:\.[a-z0-9-]+)+/g;

/** Hostname-shaped tokens, lowercased, in order of first appearance. */
export function domainTokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(DOMAIN) ?? [])];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Hash prefixes of every denylisted domain found in `text`. */
function hits(text: string, denylist: Set<string>): string[] {
  const found = new Set<string>();
  for (const token of domainTokens(text)) {
    for (const form of new Set([token, token.replace(/^www\./, "")])) {
      const hash = sha256(form);
      if (denylist.has(hash)) found.add(hash.slice(0, 8));
    }
  }
  return [...found];
}

export function checkResearchDenylist(
  reports: Report[],
  readDenylist: (report: Report) => Set<string>,
  readDataText: (report: Report) => string,
): string[] {
  const errors: string[] = [];

  for (const report of reports) {
    const denylist = readDenylist(report);
    if (denylist.size === 0) continue;

    for (const prefix of hits(report.body, denylist)) {
      errors.push(
        `${report.filePath}: a denylisted domain (hash ${prefix}…) appears in the text; ` +
          `remove it or take it off data/denylist.sha256 on purpose`,
      );
    }
    for (const prefix of hits(readDataText(report), denylist)) {
      errors.push(
        `${report.filePath}: a denylisted domain (hash ${prefix}…) appears in the report's ` +
          `data files (data/METHOD.md or data/results.csv)`,
      );
    }
  }

  return errors;
}
