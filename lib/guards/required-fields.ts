import type { Entry, EntryType } from "../schema";

/**
 * Spec §3 defines required fields PER TYPE. Nothing enforced them until now —
 * `validateShape` checks the fields every entry shares, and `checkAttribution`
 * covers a tool's credit, but a `build` with no repo and no liveUrl, or a
 * `stack` with no integrations, sailed straight through.
 *
 * That gap is exactly the shape of the bug this site exists to avoid: an entry
 * that looks complete, renders fine, and asserts nothing checkable.
 *
 * Published entries only. A draft is allowed to be half-written — that is what
 * draft means.
 */

/** From spec §3's content model table. `|` means "at least one of". */
const REQUIRED: Record<EntryType, string[]> = {
  tool: ["source", "sourceUrl", "license", "situation"],
  build: ["repo|liveUrl", "stack", "problem"],
  playbook: ["situation", "tools"],
  stack: ["integrations"],
};

function present(entry: Entry, field: string): boolean {
  const value = entry[field as keyof Entry];
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim() !== "";
}

export function checkRequiredFields(entries: Entry[]): string[] {
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.status !== "published") continue;

    for (const requirement of REQUIRED[entry.type] ?? []) {
      const alternatives = requirement.split("|");
      if (alternatives.some((field) => present(entry, field))) continue;

      errors.push(
        alternatives.length > 1
          ? `${entry.filePath}: published ${entry.type} needs at least one of ${alternatives
              .map((f) => `\`${f}\``)
              .join(" or ")} (spec §3)`
          : `${entry.filePath}: published ${entry.type} is missing \`${requirement}\` (spec §3)`,
      );
    }
  }

  return errors;
}
