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
 * There is no SKIP_LINK_CHECK escape hatch on purpose. An env flag to bypass a
 * guard gets set once during a bad afternoon and never unset.
 */

export interface LinkCheckOptions {
  timeoutMs?: number;
  /** Injectable for tests — no test should touch the real network. */
  fetchImpl?: typeof fetch;
}

/** Every outbound URL an entry claims. */
export function outboundUrls(entry: Entry): string[] {
  return [entry.sourceUrl, entry.repo, entry.liveUrl].filter(
    (url): url is string => typeof url === "string" && url.trim() !== "",
  );
}

export async function checkLinks(
  entries: Entry[],
  options: LinkCheckOptions = {},
): Promise<string[]> {
  const { timeoutMs = 10_000, fetchImpl = fetch } = options;
  const errors: string[] = [];

  const targets = entries
    .filter((entry) => entry.status === "published")
    .flatMap((entry) =>
      outboundUrls(entry).map((url) => ({ url, filePath: entry.filePath })),
    );

  // Same URL cited by two entries is one request.
  const seen = new Map<string, string[]>();
  for (const { url, filePath } of targets) {
    seen.set(url, [...(seen.get(url) ?? []), filePath]);
  }

  await Promise.all(
    [...seen.entries()].map(async ([url, filePaths]) => {
      const where = filePaths.join(", ");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // HEAD first — cheap. Plenty of hosts answer 403/405 to HEAD while
        // serving GET fine, so a non-ok HEAD is retried as GET rather than
        // reported. Reporting a live URL as dead would be worse than missing
        // one: it trains people to disable the guard.
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

        if (!response.ok) {
          errors.push(
            `${where}: outbound link is dead — ${url} returned HTTP ${response.status}`,
          );
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        errors.push(`${where}: outbound link unreachable — ${url} (${reason})`);
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return errors;
}
