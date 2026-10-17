import { getPublishedEntries } from "./content";
import { getPublishedNotes, notePath } from "./notes";
import { CATEGORY_LABEL } from "./schema";
import { canonicalPath, entryDescription } from "./site";

/**
 * "Keep reading": three other pages under every entry and every note.
 *
 * The 2026-10-16 fleet audit found the one published note,
 * /blog/keep-secrets-out-of-the-prompt-with-mcp-connectors, still not indexed 14+
 * days after publishing. Nothing linked to it except /blog. The 2026-08-24 pass
 * added prose cross-links only where an entry already named another, which left
 * most pages reachable from the homepage alone.
 *
 * Same rule r21digital.com shipped in r21-digital-site #30/#31: up to two picks
 * by shared tag, then the chronological neighbour, then the newest pages. The
 * neighbour link is what guarantees coverage: every page is linked from the one
 * dated after it, and the oldest wraps around to the newest, so the chain is a
 * closed loop with no orphan. Asserted against the real content in
 * tests/related.test.ts.
 *
 * Entries and notes share one pool here and nowhere else. That does not mix
 * the two readers: both come in through their guarded functions, so a draft
 * cannot be picked.
 */

export interface RelatedInput {
  /** The page's own URL path. Keyed on path, not slug: a slug is unique only within its folder. */
  path: string;
  date: string;
  tags: string[];
}

export interface RelatedItem extends RelatedInput {
  title: string;
  label: string;
  description: string;
}

const norm = (tags: string[]) =>
  new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));

const byDateThenPath = (a: RelatedInput, b: RelatedInput) =>
  a.date.localeCompare(b.date) || a.path.localeCompare(b.path);

export function relatedPages<T extends RelatedInput>(page: T, all: T[], n = 3): T[] {
  const others = all.filter((p) => p.path !== page.path);
  const mine = norm(page.tags);
  const newestFirst = [...others].sort((a, b) => byDateThenPath(b, a));

  const byTag = newestFirst
    .map((p) => ({ p, shared: [...norm(p.tags)].filter((tag) => mine.has(tag)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared);

  const picks: T[] = [];
  const add = (p: T | undefined) => {
    if (p && p.path !== page.path && picks.length < n && !picks.some((x) => x.path === p.path)) {
      picks.push(p);
    }
  };

  byTag.slice(0, Math.max(0, n - 1)).forEach((x) => add(x.p));
  // The newest page older than this one; the oldest wraps to the newest.
  const chain = [...all].sort(byDateThenPath);
  const at = chain.findIndex((p) => p.path === page.path);
  if (at >= 0) add(chain[(at - 1 + chain.length) % chain.length]);
  newestFirst.forEach(add);
  return picks;
}

/**
 * Every published page that can carry or receive a "Keep reading" link.
 *
 * An entry's date is its `verifiedOn` (required once published) and its tag is
 * its category, or its type for a playbook or the stack. Notes are tagged
 * `note` and dated by `publishedOn`.
 */
export function relatedPool(): RelatedItem[] {
  const entries = getPublishedEntries().map((entry) => ({
    path: canonicalPath(entry),
    date: entry.verifiedOn ?? "",
    tags: [entry.category ?? entry.type],
    title: entry.title,
    label: entry.category ? CATEGORY_LABEL[entry.category] : entry.type,
    description: entryDescription(entry),
  }));
  const notes = getPublishedNotes().map((note) => ({
    path: notePath(note),
    date: note.publishedOn,
    tags: ["note"],
    title: note.title,
    label: "Note",
    description: note.summary,
  }));
  return [...entries, ...notes];
}

export function keepReading(path: string): RelatedItem[] {
  const pool = relatedPool();
  const page = pool.find((p) => p.path === path);
  return page ? relatedPages(page, pool) : [];
}
