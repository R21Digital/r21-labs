import type { Entry } from "../schema";
import { isIsoDate } from "../schema";

/** Six months, in days. Spec §4 guard 3. */
export const MAX_AGE_DAYS = 183;

/**
 * Adversarial review 2026-08-20 landed a real hit on the original design, and
 * this file is the response.
 *
 * The old guard failed the build on age. That meant an unchanged, previously
 * valid commit became unbuildable after 183 days — blocking rebuild and
 * ROLLBACK — while doing nothing about the stale claims already deployed. It
 * preserved the integrity failure and removed the recovery path, and it quietly
 * rewarded bumping a date instead of re-verifying.
 *
 * So the two concerns are now separated:
 *
 *   INTEGRITY  (structural, fails the build) — a published entry with a
 *   missing, malformed, or future `verifiedOn`. These are defects in the file,
 *   they never become true with time, and no rollback needs them.
 *
 *   FRESHNESS  (temporal, does NOT fail the build) — an entry whose
 *   verification has aged out. The site marks it visibly stale and excludes it
 *   from every derived count, which is a STRONGER remedy than refusing to
 *   build: it tells the reader, and it fixes the deployed page rather than
 *   protecting a future one.
 */

/** Fails the build. Defects in the file, not the passage of time. */
export function checkVerificationIntegrity(entries: Entry[], now: Date = new Date()): string[] {
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.status !== "published") continue;

    if (!isIsoDate(entry.verifiedOn)) {
      errors.push(
        `${entry.filePath}: published entry needs a real \`verifiedOn\` (YYYY-MM-DD) — got ${JSON.stringify(entry.verifiedOn)}`,
      );
      continue;
    }

    const verified = new Date(`${entry.verifiedOn}T00:00:00Z`);
    if (verified.getTime() > now.getTime()) {
      const days = Math.ceil((verified.getTime() - now.getTime()) / 86_400_000);
      errors.push(
        `${entry.filePath}: \`verifiedOn\` is ${days} days in the FUTURE — a verification date cannot be ahead of the build`,
      );
    }
  }

  return errors;
}

/** Days since verification, or null when the date is unusable. */
export function ageInDays(entry: Entry, now: Date = new Date()): number | null {
  if (!isIsoDate(entry.verifiedOn)) return null;
  const verified = new Date(`${entry.verifiedOn}T00:00:00Z`);
  return Math.floor((now.getTime() - verified.getTime()) / 86_400_000);
}

/**
 * Aged out. Renders with a visible marker and is excluded from derived counts.
 *
 * `now` is injectable so tests are not time bombs — a test that hardcodes today
 * starts failing on its own six months from now, which teaches people to
 * distrust the suite.
 */
export function isStale(entry: Entry, now: Date = new Date()): boolean {
  const age = ageInDays(entry, now);
  return age !== null && age > MAX_AGE_DAYS;
}

export function staleEntries(entries: Entry[], now: Date = new Date()): Entry[] {
  return entries.filter((entry) => entry.status === "published" && isStale(entry, now));
}
