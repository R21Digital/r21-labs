/**
 * Frontmatter schema for R21 Labs content entries.
 *
 * Pure and side-effect free on purpose — every guard is a function of an entry,
 * so each one is testable without touching the filesystem or the network.
 *
 * Spec: docs/superpowers/specs/2026-08-19-r21-labs-design.md §3, §4
 */

export const ENTRY_TYPES = ["tool", "build", "playbook", "stack"] as const;
export const DEPTHS = ["deep", "partial", "showcase"] as const;
export const STATUSES = ["draft", "published"] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];
export type Depth = (typeof DEPTHS)[number];
export type Status = (typeof STATUSES)[number];

export interface Entry {
  /** Derived from the file path, not frontmatter — a slug cannot drift from its file. */
  slug: string;
  filePath: string;

  title: string;
  type: EntryType;
  status: Status;
  depth: Depth;

  /** Required on every PUBLISHED entry — see guards/staleness.ts. */
  verifiedOn?: string;

  /** Required on a published `tool` — see guards/attribution.ts. */
  source?: string;
  sourceUrl?: string;
  license?: string;

  /** `build` entries. */
  repo?: string;
  liveUrl?: string;
  stack?: string;
  problem?: string;

  /** `playbook` / `stack` entries. */
  situation?: string;
  tools?: string[];
  integrations?: string[];

  body: string;
}

/** An ISO date, and a real one — `2026-02-31` parses in JS and must not pass. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Round-trip: Date rolls 2026-02-31 forward to 03-03, so compare it back.
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * YAML parses an unquoted `2026-08-19` into a JS `Date`, so `verifiedOn` arrives
 * as a Date object unless the author happened to quote it. Normalizing here
 * means quoting is optional and behaviour is identical either way.
 *
 * Without this the failure mode is nasty: quoted dates validate, unquoted dates
 * do not, and the error message shows a full ISO timestamp for a value the file
 * clearly spells `1970-01-01`.
 */
export function normalizeFrontmatter(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...data };
  // YAML dates are parsed at UTC midnight, so this round-trips exactly.
  if (out.verifiedOn instanceof Date && !Number.isNaN(out.verifiedOn.getTime())) {
    out.verifiedOn = out.verifiedOn.toISOString().slice(0, 10);
  }
  return out;
}

/**
 * Catch YAML silently rolling an impossible date forward.
 *
 * `verifiedOn: 2026-02-31` does not error — YAML parses it to 2026-03-03, and
 * once normalized it is a perfectly valid ISO string. The author's typo becomes
 * a verification date three days from the one they wrote, silently.
 *
 * On a site whose whole product is that its claims are checkable, quietly
 * rewriting a date is the wrong failure. Compare the normalized value against
 * the literal text in the frontmatter and reject any mismatch.
 *
 * `rawMatter` is gray-matter's `.matter` — the frontmatter block as written.
 */
export function rolledDateError(
  rawMatter: string,
  normalized: unknown,
  filePath: string,
): string | null {
  const written = /^\s*verifiedOn:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?\s*$/m.exec(
    rawMatter,
  )?.[1];

  if (!written || typeof normalized !== "string") return null;
  if (written === normalized) return null;

  return `${filePath}: \`verifiedOn: ${written}\` is not a real date — YAML rolled it to ${normalized}. Write the date you mean.`;
}

/**
 * Shape validation only — "is this a well-formed entry?"
 *
 * Publishing rules (attribution, staleness, links) are deliberately NOT here.
 * They live in lib/guards/ because they apply only to published entries, and
 * keeping them separate is what lets a draft stay deliberately incomplete
 * while it is being worked on.
 */
export function validateShape(
  data: Record<string, unknown>,
  filePath: string,
): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`${filePath}: ${msg}`);

  if (typeof data.title !== "string" || data.title.trim() === "") {
    fail("`title` is required and must be a non-empty string");
  }

  if (!ENTRY_TYPES.includes(data.type as EntryType)) {
    fail(
      `\`type\` must be one of ${ENTRY_TYPES.join(" | ")} (got ${JSON.stringify(data.type)})`,
    );
  }

  if (!STATUSES.includes(data.status as Status)) {
    fail(
      `\`status\` must be one of ${STATUSES.join(" | ")} (got ${JSON.stringify(data.status)})`,
    );
  }

  if (!DEPTHS.includes(data.depth as Depth)) {
    fail(
      `\`depth\` must be one of ${DEPTHS.join(" | ")} (got ${JSON.stringify(data.depth)})`,
    );
  }

  // `verifiedOn` is optional on a draft, but if present it must be a real date.
  // A malformed date that silently became `Invalid Date` would make the
  // staleness guard pass by accident, which is the worst possible failure here.
  if (data.verifiedOn !== undefined && !isIsoDate(data.verifiedOn)) {
    fail(
      `\`verifiedOn\` must be a real YYYY-MM-DD date (got ${JSON.stringify(data.verifiedOn)})`,
    );
  }

  return errors;
}
