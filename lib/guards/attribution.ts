import type { Entry } from "../schema";

/**
 * Guard 2 — attribution.
 *
 * A published `tool` entry missing `source`, `sourceUrl`, or `license` FAILS
 * THE BUILD. Not a warning.
 *
 * This is the guard the whole site rests on. R21 Labs credits and links
 * third-party tools; it does not host or redistribute them. An uncredited tool
 * entry is the exact failure the site exists to avoid, and "we'll remember to
 * fill it in" is not a policy — the standing R21 rule is that every fix ships
 * with a guard.
 *
 * Spec §4 guard 2, §7.
 */
export function checkAttribution(entries: Entry[]): string[] {
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.status !== "published") continue;
    if (entry.type !== "tool") continue;

    const missing = (["source", "sourceUrl", "license"] as const).filter(
      (field) => {
        const value = entry[field];
        return typeof value !== "string" || value.trim() === "";
      },
    );

    if (missing.length > 0) {
      errors.push(
        `${entry.filePath}: published tool is missing ${missing
          .map((f) => `\`${f}\``)
          .join(", ")} — a third-party tool cannot be published uncredited`,
      );
    }

    // "unverified" is the honest placeholder a draft carries while its licence
    // is still being checked against the registry. It must never survive to
    // publication — it reads as a real value in a table.
    if (typeof entry.license === "string" && entry.license.trim() === "unverified") {
      errors.push(
        `${entry.filePath}: \`license: unverified\` cannot be published — verify against the registry (GitHub API / npm / PyPI) and record the SPDX id`,
      );
    }
  }

  return errors;
}
