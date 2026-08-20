import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import {
  DIR_FOR_TYPE,
  type Entry,
  type EntryType,
  normalizeFrontmatter,
  rolledDateError,
  validateShape,
} from "./schema";
import { checkAttribution } from "./guards/attribution";
import { checkVerificationIntegrity } from "./guards/staleness";
import { assertNoDrafts, publishedOnly } from "./guards/published";
import { checkRequiredFields } from "./guards/required-fields";

export const CONTENT_DIR = path.join(process.cwd(), "content");

/**
 * The single place a malformed entry is caught.
 *
 * Guards run HERE rather than in a separate lint step, so there is no way to
 * render a page without them having run. A guard that lives in a script someone
 * has to remember to invoke is a guard that eventually is not consulted.
 */

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) return walk(full);
    return item.isFile() && full.endsWith(".mdx") ? [full] : [];
  });
}

/**
 * Raw reader. Returns DRAFTS. Shape-validated only — no publishing guard has run.
 *
 * 🔴 NOT for routes, sitemaps, feeds, or route handlers. Those call
 * `getPublishedEntries()`. The name is deliberately awkward so it cannot be
 * imported by accident, and `tests/boundary.test.ts` fails the suite if anything
 * under `app/` imports it.
 *
 * Adversarial review 2026-08-20: the old name was `readEntries`, exported and
 * inviting. Calling the choke point "enforced" was wrong — it was a convention.
 */
export function readEntriesUnguarded(dir: string = CONTENT_DIR): Entry[] {
  const files = walk(dir);
  const entries: Entry[] = [];
  const errors: string[] = [];

  for (const filePath of files) {
    const relative = path.relative(dir, filePath).split(path.sep).join("/");
    const parsed = matter(fs.readFileSync(filePath, "utf8"));
    const data = normalizeFrontmatter(parsed.data);

    const rolled = rolledDateError(parsed.matter, data.verifiedOn, relative);
    const declared = data.type as EntryType;
    const expectedDir = DIR_FOR_TYPE[declared];
    const actualDir = relative.includes("/") ? relative.split("/")[0] : "(content root)";
    const dirMismatch =
      expectedDir && actualDir !== expectedDir
        ? `${relative}: \`type: ${declared}\` but the file sits in \`${actualDir}/\` ` +
          `(expected \`${expectedDir}/\`). Routing uses the PATH and the attribution guard ` +
          `uses the TYPE — a mismatch publishes at /${actualDir}/ while escaping that type's rules.`
        : null;

    const shapeErrors = [
      ...validateShape(data, relative),
      ...(rolled ? [rolled] : []),
      ...(dirMismatch ? [dirMismatch] : []),
    ];
    if (shapeErrors.length > 0) {
      errors.push(...shapeErrors);
      continue;
    }

    entries.push({
      ...(data as Omit<Entry, "slug" | "filePath" | "body">),
      slug: path.basename(filePath, ".mdx"),
      filePath: relative,
      body: parsed.content,
    });
  }

  // Reporting only the first error means a batch of bad entries takes N builds
  // to fix, and people start disabling the check.
  if (errors.length > 0) {
    throw new Error(
      `Content schema validation failed (${errors.length}):\n  - ${errors.join("\n  - ")}`,
    );
  }

  const duplicates = entries
    .map((entry) => entry.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate slugs: ${[...new Set(duplicates)].join(", ")} — slugs become URLs, so one would silently shadow the other`,
    );
  }

  return entries;
}

/**
 * Publishable entries, with the publishing guards enforced.
 *
 * Every route, the sitemap, and the RSS feed read through this. Nothing calls
 * `readEntries` directly to render.
 *
 * Link checking is NOT here — it is async and network-bound, so it runs in
 * `scripts/check-links.mjs` at prebuild. Everything synchronous fails here.
 */
export function getPublishedEntries(dir: string = CONTENT_DIR): Entry[] {
  const all = readEntriesUnguarded(dir);

  const errors = [
    ...checkRequiredFields(all),
    ...checkAttribution(all),
    ...checkVerificationIntegrity(all),
  ];
  if (errors.length > 0) {
    throw new Error(
      `Content guards failed (${errors.length}):\n  - ${errors.join("\n  - ")}\n\n` +
        `Fix the entry. Never soften a guard to get the build green.`,
    );
  }

  const published = publishedOnly(all);
  // Belt and braces. This used to be the only draft defence and it ran AFTER
  // publishedOnly, so it could never fire — flagged by adversarial review. It is
  // kept as a post-condition; the real boundary is tests/boundary.test.ts.
  assertNoDrafts(published, "getPublishedEntries");
  return published;
}
