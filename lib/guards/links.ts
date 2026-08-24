import type { Entry } from "../schema";

/**
 * Guard 4 — dead outbound links.
 *
 * Spec §4: "On a recommendations site a dead link is not cosmetic — it makes the
 * page look abandoned."
 *
 * PUBLISHED ENTRIES ONLY, deliberately. Two reasons, and the second is the one
 * that matters:
 *   1. A draft's URL is often still a guess. Checking it is noise.
 *   2. It keeps the whole guard offline until something is actually published.
 *      A build that needs the network to compile a directory of drafts is a
 *      build that gets skipped, and a skipped guard is not a guard.
 *
 * Adversarial review 2026-08-20: the original treated every failure as dead.
 * One timeout, DNS blip, throttle or upstream 5xx on a dependency R21 does not
 * control would exit prebuild and make EVERY deployment impossible - including
 * a security rollback - while the previous deploy kept serving that same link.
 * Blocking recovery without removing the bad content is the wrong trade.
 *
 * So failures are now split:
 *   DEAD          - 404/410, deterministic and repeatable. Fails the build.
 *   INDETERMINATE - timeout, DNS/TLS, 429, 5xx. Retried with backoff, then
 *                   REPORTED, not fatal. An unreachable host is a fact about
 *                   the network, not a fact about the link.
 *
 * Still no skip flag. An env var to bypass a guard gets set once during a bad
 * afternoon and never unset - the fix was to make the guard correct, not
 * optional.
 */

export interface LinkCheckOptions {
  timeoutMs?: number;
  /** Attempts after the first, for indeterminate failures only. */
  retries?: number;
  /** Injectable for tests — no test should touch the real network. */
  fetchImpl?: typeof fetch;
}

/**
 * Every outbound URL an entry claims.
 *
 * 🔴 Includes each `replaces[].sourceUrl` — the vendor pricing page a price
 * figure was read off. Added 2026-08-23 with the re-point.
 *
 * Leaving those out would have been the worst possible omission here: the
 * price is the site's headline claim, vendors reorganise pricing pages far more
 * often than they move a repo, and a dead pricing link is precisely how "$29/mo"
 * quietly becomes a number nobody can check. The guard has to cover the claim
 * that is most likely to rot, not just the ones that were already listed.
 */
export function outboundUrls(entry: Entry): string[] {
  return [
    entry.sourceUrl,
    entry.repo,
    entry.liveUrl,
    ...(entry.replaces ?? []).map((replacement) => replacement.sourceUrl),
    ...bodyLinks(entry).external,
  ].filter((url): url is string => typeof url === "string" && url.trim() !== "");
}

/**
 * Links written in an entry's PROSE, which this guard did not see until
 * 2026-08-24.
 *
 * 🔴 The gap: `outboundUrls` read frontmatter only, while the README stated the
 * guard rejects "a dead outbound link on a published entry" — no qualifier. So
 * the moment an entry cited a vendor's documentation inline, that citation was
 * unchecked, on the one site whose product is that its claims survive being
 * followed. The first such link went in the same day this was found.
 *
 * Internal links are the more interesting half. They cost no network call and
 * they are the ones most likely to break silently: a slug gets renamed, an
 * entry goes back to draft, and a page that still renders now links into a 404.
 * Those are validated against the published set rather than fetched.
 */
export function bodyLinks(entry: Entry): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];

  // Markdown inline links. Deliberately not a markdown parser: the bodies are
  // hand-written MDX and this only has to find `](...)`.
  for (const [, href] of entry.body.matchAll(/\]\(\s*([^)\s]+)/g)) {
    if (href.startsWith("http://") || href.startsWith("https://")) external.push(href);
    else if (href.startsWith("/")) internal.push(href.split("#")[0]);
  }
  return { internal, external };
}

/**
 * Internal links that do not resolve to something this site publishes.
 *
 * Synchronous and offline on purpose. A broken internal link is a fact about
 * the repository, knowable at build time, and it should never depend on the
 * network being up to be caught.
 */
export function deadInternalLinks(entries: Entry[], staticPaths: string[]): string[] {
  const published = entries.filter((entry) => entry.status === "published");

  const valid = new Set<string>([
    "/",
    ...staticPaths,
    ...published.map((entry) => `/${entry.filePath.split("/")[0]}/${entry.slug}`),
  ]);

  return published.flatMap((entry) =>
    bodyLinks(entry)
      .internal.filter((href) => !valid.has(href.replace(/\/$/, "") || "/"))
      .map(
        (href) =>
          `${entry.filePath}: ${href} does not resolve — no published entry or page at that path`,
      ),
  );
}

export interface LinkReport {
  /** Deterministically dead. Fails the build. */
  dead: string[];
  /** Could not be established. Reported, never fatal. */
  indeterminate: string[];
}

/** 404/410 mean the resource is gone. Everything else is the network talking. */
const DEAD_STATUSES = new Set([404, 410]);

export async function checkLinks(
  entries: Entry[],
  options: LinkCheckOptions = {},
): Promise<LinkReport> {
  const { timeoutMs = 10_000, fetchImpl = fetch, retries = 2 } = options;
  const report: LinkReport = { dead: [], indeterminate: [] };

  const targets = entries
    .filter((entry) => entry.status === "published")
    .flatMap((entry) =>
      outboundUrls(entry).map((url) => ({ url, filePath: entry.filePath })),
    );

  const seen = new Map<string, string[]>();
  for (const { url, filePath } of targets) {
    seen.set(url, [...(seen.get(url) ?? []), filePath]);
  }

  await Promise.all(
    [...seen.entries()].map(async ([url, filePaths]) => {
      const where = filePaths.join(", ");
      let lastReason = "unknown";

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          // HEAD first. Plenty of hosts answer 403/405 to HEAD but serve GET
          // fine, so a non-ok HEAD is retried as GET rather than reported -
          // calling a live URL dead is what trains people to disable a guard.
          let response = await fetchImpl(url, {
            method: "HEAD",
            redirect: "follow",
            signal: controller.signal,
          });
          if (!response.ok) {
            response = await fetchImpl(url, {
              method: "GET",
              redirect: "follow",
              signal: controller.signal,
            });
          }

          if (response.ok) return;

          if (DEAD_STATUSES.has(response.status)) {
            report.dead.push(`${where}: ${url} returned HTTP ${response.status}`);
            return;
          }

          lastReason = `HTTP ${response.status}`;
        } catch (error) {
          lastReason = error instanceof Error ? error.message : String(error);
        } finally {
          clearTimeout(timer);
        }

        // Linear backoff. Enough to ride out a blip without stalling a build.
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }

      report.indeterminate.push(
        `${where}: ${url} could not be checked after ${retries + 1} attempts (${lastReason})`,
      );
    }),
  );

  return report;
}
