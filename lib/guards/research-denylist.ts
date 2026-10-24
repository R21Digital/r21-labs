import { createHmac } from "node:crypto";
import path from "node:path";

import type { Report } from "../research";
import { publishedText } from "./research-text";

/**
 * Research guard 3 — no real sampled domain appears in published text.
 *
 * The report studies real sites, and naming one is a decision, not an accident.
 * `data/denylist.sha256` holds the HMAC-SHA256 of each sampled domain under a
 * private key (`RESEARCH_DENYLIST_KEY`). The repository is public: a plain hash
 * would let anyone hash a candidate domain and learn whether it was sampled.
 * Every hostname-shaped token in the prose, in
 * every downloadable `dataFiles` entry (stats.json included), and in
 * `data/METHOD.md` and `data/results.csv` is hashed and looked up, together
 * with its parent domains: `shop.example.org` is caught when `example.org` is
 * on the list.
 *
 * Fails closed. A published measurement that ships `results.csv` must have a
 * denylist, and a report with a denylist needs the key; without either this
 * guard would check nothing and say nothing. A line that is not 64 hex
 * characters fails too, because a typo there silently drops a domain from the
 * check.
 *
 * Errors name the file and a short hash prefix or a line number, never the
 * domain: the build log is also published somewhere.
 */

const DOMAIN = /[a-z0-9-]+(?:\.[a-z0-9-]+)+/g;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface Denylist {
  hashes: Set<string>;
  /** 1-based line numbers that are not exactly 64 lowercase hex characters. */
  malformedLines: number[];
}

/** Parse a denylist file. Blank lines are fine; `\r` and surrounding spaces are stripped. */
export function parseDenylist(raw: string): Denylist {
  const hashes = new Set<string>();
  const malformedLines: number[] = [];
  raw.split("\n").forEach((line, index) => {
    const value = line.trim();
    if (value === "") return;
    if (SHA256_HEX.test(value)) hashes.add(value);
    else malformedLines.push(index + 1);
  });
  return { hashes, malformedLines };
}

/** Hostname-shaped tokens, lowercased, in order of first appearance. */
export function domainTokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(DOMAIN) ?? [])];
}

/**
 * Every form of a token that could name a sampled domain: the token, its
 * `www.`-stripped form, and each parent suffix with at least two labels
 * (`a.shop.example.org` → `shop.example.org`, `example.org`).
 */
export function domainForms(token: string): string[] {
  const forms = new Set([token, token.replace(/^www\./, "")]);
  const labels = token.split(".");
  for (let start = 1; start <= labels.length - 2; start += 1) {
    forms.add(labels.slice(start).join("."));
  }
  return [...forms];
}

export function denylistHash(key: string, domain: string): string {
  return createHmac("sha256", key).update(domain).digest("hex");
}

/** Hash prefixes of every denylisted domain found in `text`. */
function hits(text: string, denylist: Set<string>, key: string): string[] {
  const found = new Set<string>();
  for (const token of domainTokens(text)) {
    for (const form of domainForms(token)) {
      const hash = denylistHash(key, form);
      if (denylist.has(hash)) found.add(hash.slice(0, 8));
    }
  }
  return [...found];
}

/** A measurement that publishes site-level rows cannot run without a denylist. */
function needsDenylist(report: Report): boolean {
  return (
    report.kind === "measurement" &&
    report.dataFiles.some((file) => path.posix.basename(file.replace(/\\/g, "/")) === "results.csv")
  );
}

export function checkResearchDenylist(
  reports: Report[],
  readDenylist: (report: Report) => Denylist,
  readDataText: (report: Report) => string,
  key: string | undefined,
): string[] {
  const errors: string[] = [];

  for (const report of reports) {
    const { hashes, malformedLines } = readDenylist(report);

    if (malformedLines.length > 0) {
      errors.push(
        `${report.filePath}: data/denylist.sha256 line${malformedLines.length === 1 ? "" : "s"} ` +
          `${malformedLines.join(", ")} ${malformedLines.length === 1 ? "is" : "are"} not an ` +
          `HMAC-SHA256 (exactly 64 lowercase hex characters)`,
      );
    }
    if (hashes.size === 0) {
      if (needsDenylist(report)) {
        errors.push(
          `${report.filePath}: ships data/results.csv but data/denylist.sha256 is missing or ` +
            `empty, so no sampled domain can be checked; add the denylist`,
        );
      }
      continue;
    }
    if (!key) {
      errors.push(
        `${report.filePath}: RESEARCH_DENYLIST_KEY is not set, so data/denylist.sha256 ` +
          `cannot be checked; set it (Vercel env, or the key file in _secrets/ locally)`,
      );
      continue;
    }

    for (const prefix of hits(publishedText(report), hashes, key)) {
      errors.push(
        `${report.filePath}: a denylisted domain (hash ${prefix}…) appears in the text; ` +
          `remove it or take it off data/denylist.sha256 on purpose`,
      );
    }
    for (const prefix of hits(readDataText(report), hashes, key)) {
      errors.push(
        `${report.filePath}: a denylisted domain (hash ${prefix}…) appears in the report's ` +
          `data files (a downloadable dataFiles entry, data/METHOD.md or data/results.csv)`,
      );
    }
  }

  return errors;
}
