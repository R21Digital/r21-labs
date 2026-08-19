/**
 * Guard 4 runner — prebuild.
 *
 * Split out from lib/content.ts because it is the only async, network-bound
 * guard; everything synchronous fails inside getPublishedEntries().
 *
 * With no published entries this makes zero requests, so it costs nothing until
 * the site actually publishes something. There is no skip flag on purpose.
 */
import { readEntries } from "../lib/content";
import { checkLinks } from "../lib/guards/links";

const entries = readEntries();
const published = entries.filter((entry) => entry.status === "published");

const errors = await checkLinks(entries);

if (errors.length > 0) {
  console.error(
    `\nDead outbound links (${errors.length}):\n  - ${errors.join("\n  - ")}\n\n` +
      `Fix or remove the link. On a recommendations site a dead link makes the page look abandoned.\n`,
  );
  process.exit(1);
}

console.log(
  `link check: ${published.length} published entr${published.length === 1 ? "y" : "ies"} checked, no dead links`,
);
