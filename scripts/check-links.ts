/**
 * Guard 4 runner — prebuild.
 *
 * DEAD links (404/410) fail the build. INDETERMINATE ones are reported and do
 * not, because a DNS blip on a dependency R21 does not control must never be
 * able to block a security rollback while the previous deploy keeps serving the
 * same link. Adversarial review 2026-08-20.
 */
import { readEntriesUnguarded } from "../lib/content";
import { checkLinks } from "../lib/guards/links";

const entries = readEntriesUnguarded();
const published = entries.filter((entry) => entry.status === "published");
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
