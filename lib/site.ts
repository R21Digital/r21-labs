import type { Entry } from "./schema";

/**
 * Site-level identity: the one place that knows what this site is called and
 * where it lives.
 *
 * Everything in the discovery layer — canonical URLs, the sitemap, the feed,
 * OpenGraph images — has to agree on an absolute origin, and the failure when
 * they disagree is silent: a canonical pointing at the preview domain tells
 * Google the preview is the real page.
 */

/**
 * 🔴 The LAUNCH domain, not the current one.
 *
 * `r21labs.com` is bought (Cloudflare, 2026-08-19) but not yet pointed at
 * Vercel, so today the site answers on `r21-labs.vercel.app`. Canonicals still
 * name `r21labs.com`, deliberately:
 *
 * - Nothing is indexed yet (there was no sitemap until now and the domain does
 *   not resolve), so there is no existing ranking to send to a dead URL.
 * - The alternative — canonicalising the preview alias — is the worse failure.
 *   It survives the DNS cutover silently and permanently tells crawlers the
 *   `.vercel.app` copy is the original. That is how a site ends up competing
 *   with itself, and nobody notices because every page still renders.
 *
 * Overridable so a fork or a staging deploy is not stuck claiming production.
 * `NEXT_PUBLIC_` because metadata is evaluated during static generation.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://r21labs.com"
).replace(/\/$/, "");

export const SITE_NAME = "R21 Labs";

export const SITE_DESCRIPTION =
  "The AI tools R21 tested and recommends, the software R21 built, and the playbooks that connect them.";

/** The legal entity behind the site — used for Organization structured data. */
export const ORGANIZATION = {
  name: "R21 Digital",
  legalName: "R21 Media Group, LLC",
  url: "https://r21digital.com",
} as const;

/**
 * An entry's URL path.
 *
 * Derived from `filePath`, matching how the route itself resolves. Deriving it
 * from `type` instead would reintroduce the two-identifiers-for-one-fact bug
 * that adversarial review caught in schema.ts: routing uses the PATH, so
 * anything that builds a URL from the declared TYPE can disagree with the page
 * that actually exists.
 */
export function canonicalPath(entry: Entry): string {
  return `/${entry.filePath.split("/")[0]}/${entry.slug}`;
}

export function canonicalUrl(entry: Entry): string {
  return `${SITE_URL}${canonicalPath(entry)}`;
}

/**
 * The one-line description used for an entry's `<meta name="description">`,
 * its OpenGraph description, and its feed summary.
 *
 * Falls back through the fields each entry type actually carries, then to the
 * body's opening sentence, and finally to a constructed line. It never returns
 * empty: an empty description is how eleven pages ended up sharing the site
 * default, and a page with no description of its own is a page Google writes
 * a description for.
 */
export function entryDescription(entry: Entry): string {
  const stated = entry.problem ?? entry.situation;
  if (stated && stated.trim().length > 0) return stated.trim();

  const firstSentence = entry.body
    .trim()
    .split(/\n{2,}/)
    .find((block) => !block.startsWith(">") && !block.startsWith("#"))
    ?.replace(/\s+/g, " ")
    .trim();

  if (firstSentence && firstSentence.length > 0) {
    return firstSentence.length > 200
      ? `${firstSentence.slice(0, 197).trimEnd()}…`
      : firstSentence;
  }

  // Last resort, and still specific to this entry rather than to the site.
  return `${entry.title} — ${entry.type} on ${SITE_NAME}.`;
}
