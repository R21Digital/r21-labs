/**
 * Guard 4 runner — prebuild.
 *
 * DEAD links (404/410) fail the build. INDETERMINATE ones are reported and do
 * not, because a DNS blip on a dependency R21 does not control must never be
 * able to block a security rollback while the previous deploy keeps serving the
 * same link. Adversarial review 2026-08-20.
 */
import { readEntriesUnguarded } from "../lib/content";
import { checkLinks, deadInternalLinks } from "../lib/guards/links";

/**
 * Non-entry pages a body is allowed to link to. Listed rather than discovered,
 * for the same reason the sitemap lists them: a filesystem walk would make the
 * claim by accident.
 */
const STATIC_PATHS = ["/suggest", "/contact"];

const entries = readEntriesUnguarded();
const published = entries.filter((entry) => entry.status === "published");

// Offline and first: a broken internal link is knowable without the network,
// so it should never wait on it — or be masked by it being down.
const brokenInternal = deadInternalLinks(entries, STATIC_PATHS);
if (brokenInternal.length > 0) {
  console.error(
    `\nBROKEN INTERNAL LINKS (${brokenInternal.length}):\n  - ${brokenInternal.join("\n  - ")}\n\n` +
      `These point at pages this site does not publish. Fix the path, or publish the entry.\n`,
  );
  process.exit(1);
}

const { dead, indeterminate } = await checkLinks(entries);

if (indeterminate.length > 0) {
  console.warn(
    `\nlink check: ${indeterminate.length} INDETERMINATE (reported, not fatal):\n  - ${indeterminate.join("\n  - ")}\n`,
  );
}

if (dead.length > 0) {
  console.error(
    `\nDEAD outbound links (${dead.length}):\n  - ${dead.join("\n  - ")}\n\n` +
      `These returned 404/410 — the resource is gone. Fix or remove the link.\n`,
  );
  process.exit(1);
}

console.log(
  `link check: ${published.length} published entr${published.length === 1 ? "y" : "ies"}, no dead links`,
);
