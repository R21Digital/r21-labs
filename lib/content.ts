import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import {
  type Entry,
  normalizeFrontmatter,
  rolledDateError,
  validateShape,
} from "./schema";
import { checkAttribution } from "./guards/attribution";
import { checkStaleness } from "./guards/staleness";
import { assertNoDrafts, publishedOnly } from "./guards/published";

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

/** Read + shape-validate. Throws listing EVERY problem, not just the first. */
export function readEntries(dir: string = CONTENT_DIR): Entry[] {
  const files = walk(dir);
  const entries: Entry[] = [];
  const errors: string[] = [];

  for (const filePath of files) {
    const relative = path.relative(dir, filePath).split(path.sep).join("/");
    const parsed = matter(fs.readFileSync(filePath, "utf8"));
    const data = normalizeFrontmatter(parsed.data);

    const rolled = rolledDateError(parsed.matter, data.verifiedOn, relative);
    const shapeErrors = [
      ...validateShape(data, relative),
      ...(rolled ? [rolled] : []),
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
  const all = readEntries(dir);

  const errors = [...checkAttribution(all), ...checkStaleness(all)];
  if (errors.length > 0) {
    throw new Error(
      `Content guards failed (${errors.length}):\n  - ${errors.join("\n  - ")}\n\n` +
        `Fix the entry. Never soften a guard to get the build green.`,
    );
  }

  const published = publishedOnly(all);
  assertNoDrafts(published, "getPublishedEntries");
  return published;
}
