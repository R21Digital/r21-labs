/**
 * Frontmatter schema for R21 Labs content entries.
 *
 * Pure and side-effect free on purpose — every guard is a function of an entry,
 * so each one is testable without touching the filesystem or the network.
 *
 * Spec: docs/superpowers/specs/2026-08-19-r21-labs-design.md §3, §4
 */

export const ENTRY_TYPES = ["tool", "build", "playbook", "stack"] as const;

/**
 * What the thing IS, as opposed to `type`, which is how R21 relates to it.
 *
 * The two are genuinely different axes and collapsing them was the old model's
 * limit: `type: tool` covers an MCP server, a skill library and a CLI, which a
 * visitor looking for "an MCP for my EHR" cannot browse. `type` drives the
 * guards and the URL; `category` drives what a reader filters on.
 *
 * Added 2026-08-23 when the site was re-pointed from an R21 portfolio to a
 * resource people use.
 */
export const CATEGORIES = ["mcp", "skills", "tool", "app"] as const;

export const CATEGORY_LABEL: Record<Category, string> = {
  mcp: "MCP servers",
  skills: "Agent skills",
  tool: "Developer tools",
  app: "Apps",
};

/**
 * Directory -> type. Routing derives the URL from `filePath` while the
 * attribution guard keys off `type`, so if those two disagree the guard can be
 * walked straight past: `content/tools/x.mdx` declaring `type: build` satisfies
 * the weaker build fields, publishes at `/tools/x`, and never has to name a
 * source or a licence.
 *
 * Found by adversarial review 2026-08-20. Two identifiers for one fact is the
 * bug; this makes the directory authoritative and rejects any mismatch.
 */
export const DIR_FOR_TYPE: Record<EntryTypeName, string> = {
  tool: "tools",
  build: "builds",
  playbook: "playbooks",
  stack: "stack",
};

type EntryTypeName = "tool" | "build" | "playbook" | "stack";
export const DEPTHS = ["deep", "partial", "showcase"] as const;
export const STATUSES = ["draft", "published"] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Depth = (typeof DEPTHS)[number];
export type Status = (typeof STATUSES)[number];

/**
 * "This replaces a paid thing" — the site's whole hook after the 2026-08-23
 * re-point, so it is structured data rather than a sentence in the body. It
 * drives the card, the page, the OG card and the SEO title.
 *
 * 🔴 `pricedAt` and `sourceUrl` are BOTH required, and that is the point. A
 * price is a claim, and this site's only real product is that its claims are
 * checkable. "Replaces Zapier" with no figure is marketing; "Replaces Zapier,
 * $29.99/mo, checked against their pricing page on this date" is a fact a
 * reader can audit — and prices move, so the URL is what makes the staleness
 * model mean anything here.
 */
export interface Replacement {
  /** The paid product, as ITS owner writes it. */
  tool: string;
  /** Verbatim from the vendor's pricing page, e.g. "$29/mo". Never computed. */
  pricedAt: string;
  /** The vendor pricing page the figure came from. Checked by the link guard. */
  sourceUrl: string;
}

export interface Entry {
  /** Derived from the file path, not frontmatter — a slug cannot drift from its file. */
  slug: string;
  filePath: string;

  title: string;
  type: EntryType;
  status: Status;
  depth: Depth;

  /** What the thing is. Required on a published tool or build — see guards. */
  category?: Category;

  /** Paid products this replaces. Absent is fine; empty-but-present is not. */
  replaces?: Replacement[];

  /** One copy-pasteable command. The single most useful line on the page. */
  install?: string;

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

  // Array fields are CAST from YAML, never checked. A scalar `integrations:
  // "A, B"` passes as a string and the homepage then reports ONE integration -
  // a wrong derived number, which is the exact failure this site exists to
  // prevent. Validate the container and every element.
  for (const field of ["integrations", "tools"] as const) {
    const value = data[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      fail(
        `\`${field}\` must be a LIST, got ${typeof value} (${JSON.stringify(value)}). ` +
          `A scalar here silently becomes a count of 1.`,
      );
      continue;
    }
    const bad = value.filter((item) => typeof item !== "string" || item.trim() === "");
    if (bad.length > 0) {
      fail(`\`${field}\` contains ${bad.length} non-string or empty entr(y/ies)`);
    }
  }

  if (data.category !== undefined && !CATEGORIES.includes(data.category as Category)) {
    fail(
      `\`category\` must be one of ${CATEGORIES.join(" | ")} (got ${JSON.stringify(data.category)})`,
    );
  }

  if (data.install !== undefined && typeof data.install !== "string") {
    fail(`\`install\` must be a string (got ${typeof data.install})`);
  }

  /**
   * `replaces` is the site's headline claim, so its shape is checked hard.
   *
   * An empty ARRAY is rejected rather than treated as absent: `replaces: []`
   * reads to an author as "I recorded that it replaces nothing", and would
   * render as no badge at all — indistinguishable from having forgotten the
   * field. Same failure family as the scalar-list bug above, where a wrong
   * container silently became a count of 1.
   */
  if (data.replaces !== undefined) {
    if (!Array.isArray(data.replaces)) {
      fail(
        `\`replaces\` must be a LIST of {tool, pricedAt, sourceUrl} (got ${typeof data.replaces})`,
      );
    } else if (data.replaces.length === 0) {
      fail("`replaces` is present but empty — omit the field instead");
    } else {
      data.replaces.forEach((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          fail(`\`replaces[${index}]\` must be an object with tool, pricedAt, sourceUrl`);
          return;
        }
        for (const field of ["tool", "pricedAt", "sourceUrl"] as const) {
          const value = (item as Record<string, unknown>)[field];
          if (typeof value !== "string" || value.trim() === "") {
            fail(
              `\`replaces[${index}].${field}\` is required — a price with no source is not a checkable claim`,
            );
          }
        }
        const url = (item as Record<string, unknown>).sourceUrl;
        if (typeof url === "string" && !/^https?:\/\//.test(url)) {
          fail(`\`replaces[${index}].sourceUrl\` must be an absolute http(s) URL`);
        }
      });
    }
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
