import type { Entry } from "../schema";

/**
 * Guard 1 — nothing renders unless `status: published`.
 *
 * This is the load-bearing one. The whole curation model in spec §4 rests on
 * drafts staying invisible, and §10 names that as the assumption most likely to
 * break quietly during a refactor.
 *
 * So it is expressed as a single choke point rather than a filter callers are
 * trusted to remember. Every route, the sitemap, and the RSS feed read entries
 * through `publishedOnly()` — there is no second path to the entry list.
 */
export function publishedOnly(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.status === "published");
}

/**
 * Belt and braces: assert no draft survived into a set about to be rendered.
 *
 * `publishedOnly` already filters. This catches the refactor where someone
 * bypasses it and hands raw entries to a route — the failure §10 predicts.
 */
export function assertNoDrafts(entries: Entry[], context: string): void {
  const leaked = entries.filter((entry) => entry.status !== "published");

  if (leaked.length > 0) {
    const names = leaked.map((entry) => entry.filePath).join(", ");
    throw new Error(
      `Draft leak in ${context}: ${leaked.length} non-published entry/entries reached render — ${names}. ` +
        `Read entries through publishedOnly() rather than filtering at the call site.`,
    );
  }
}
