import type { Entry } from "../schema";
import { isIsoDate } from "../schema";

/** Six months, in days. Spec §4 guard 3. */
export const MAX_AGE_DAYS = 183;

/**
 * Guard 3 — staleness.
 *
 * A published entry whose `verifiedOn` is older than six months FAILS THE
 * BUILD, and a published entry with no `verifiedOn` at all fails too.
 *
 * Spec §4 calls this one deliberate: "a handpicking policy you have to remember
 * is not handpicking, it is hoping." The build is what remembers.
 *
 * `now` is injectable so the tests are not time-bombs — a test that hardcodes
 * today's date starts failing on its own six months from now, which teaches the
 * next person to distrust the suite.
 */
export function checkStaleness(entries: Entry[], now: Date = new Date()): string[] {
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
    const ageDays = Math.floor(
      (now.getTime() - verified.getTime()) / 86_400_000,
    );

    if (ageDays > MAX_AGE_DAYS) {
      errors.push(
        `${entry.filePath}: \`verifiedOn\` is ${ageDays} days old (limit ${MAX_AGE_DAYS}) — re-verify against the registry and update the date`,
      );
    }

    // A future date is not "fresh", it is a typo or a fabrication. Either way it
    // would make this guard sleep for months.
    if (ageDays < 0) {
      errors.push(
        `${entry.filePath}: \`verifiedOn\` is ${Math.abs(ageDays)} days in the FUTURE — a verification date cannot be ahead of the build`,
      );
    }
  }

  return errors;
}
