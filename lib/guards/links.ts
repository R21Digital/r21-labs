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

/** Every outbound URL an entry claims. */
export function outboundUrls(entry: Entry): string[] {
  return [entry.sourceUrl, entry.repo, entry.liveUrl].filter(
    (url): url is string => typeof url === "string" && url.trim() !== "",
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
