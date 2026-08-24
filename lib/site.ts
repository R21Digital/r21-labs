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
 * The live domain.
 *
 * Written here BEFORE it resolved. `r21labs.com` was bought on 2026-08-19 and
 * the DNS cutover landed on 2026-08-23; in between, the site answered only on
 * `r21-labs.vercel.app` while every canonical already named the real domain.
 *
 * That was the deliberate call and it is worth keeping the reasoning, because
 * the tempting alternative fails silently. Canonicalising the preview alias
 * survives the cutover and permanently tells crawlers the `.vercel.app` copy is
 * the original — a site competing with itself, with every page still rendering
 * and nothing to notice. Pointing at a URL that did not resolve yet cost
 * nothing by comparison: nothing was indexed, so there was no ranking to send
 * anywhere.
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

/**
 * The site-wide OpenGraph card.
 *
 * 🔴 A page that declares its own `openGraph` block does NOT inherit the root
 * one, and the `app/opengraph-image.tsx` file convention covers `/` rather than
 * cascading to every route. So `/suggest` and `/contact` shipped with a
 * page-specific og:title and NO og:image at all — a card that renders blank
 * everywhere it is shared, while view-source looks complete.
 *
 * Caught by `tests/discovery.test.ts` the first time it ran against them, which
 * is the same defect it was written for in August: the OpenGraph block looking
 * right and doing nothing. Any new page that sets `openGraph` must spread this.
 *
 * Relative on purpose — `metadataBase` in app/layout.tsx makes it absolute, and
 * that resolution is itself asserted.
 */
export const OG_IMAGE = { images: ["/opengraph-image"] };

/**
 * The legal entity behind the site — used for Organization structured data.
 *
 * 🔴 `sameAs` added 2026-08-24 after a GEO audit of this site with R21's own
 * tooling. The Organization block carried a name, a legal name and a URL and
 * nothing else, which leaves an assistant no way to tell this entity apart from
 * the several it collides with by name: AI21 Labs, Bio21, InfoLab21,
 * CrunchLabs, and — most awkwardly — R21, a widely covered malaria vaccine.
 *
 * `sameAs` is the primary disambiguation signal in schema.org. On a site whose
 * entire second goal is being cited correctly by AI search, being confusable
 * with a vaccine is not a small problem, and it is not one more prose can fix.
 *
 * Both profiles were verified against the GitHub API on 2026-08-24 rather than
 * assumed: `R21Digital` resolves as an Organization, `CDVolvik` as a User. A
 * `sameAs` pointing at a 404 is worse than none — it asserts an identity that
 * cannot be confirmed, which is the opposite of what the property is for.
 */
export const ORGANIZATION = {
  name: "R21 Digital",
  legalName: "R21 Media Group, LLC",
  url: "https://r21digital.com",
  sameAs: [
    "https://github.com/R21Digital",
    "https://github.com/CDVolvik",
  ],
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
/**
 * Search engines render roughly 155 characters. Below this, a description is
 * leaving the majority of its own SERP row empty.
 *
 * 🔴 The GEO audit on 2026-08-24 measured the live entry pages at 50–76
 * characters, because `problem` and `situation` are deliberately pithy
 * one-liners and this function returned them alone. Two consequences, and the
 * second is the one that costs: a half-empty snippet, and Google substituting
 * its own text — which on a site whose product is carefully worded claims means
 * the claim a searcher sees is not the one that was written.
 */
const TARGET_LENGTH = 110;
const MAX_LENGTH = 155;

/** The body's opening prose, flattened — no headings, quotes, lists or tables. */
function openingSentence(entry: Entry): string | undefined {
  return entry.body
    .trim()
    .split(/\n{2,}/)
    .find(
      (block) =>
        !block.startsWith(">") && !block.startsWith("#") && !block.startsWith("|") &&
        !block.startsWith("-") && !block.startsWith("*"),
    )
    ?.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links → their text
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  return `${text.slice(0, MAX_LENGTH - 1).replace(/\s+\S*$/, "")}…`;
}

export function entryDescription(entry: Entry): string {
  const stated = (entry.problem ?? entry.situation)?.trim();
  const opening = openingSentence(entry);

  if (stated && stated.length > 0) {
    // Long enough on its own — leave it exactly as written.
    if (stated.length >= TARGET_LENGTH || !opening) return clamp(stated);

    // Otherwise extend with the entry's own opening line. Composed rather than
    // padded: both halves are text somebody wrote about THIS entry, so the
    // result stays unique, which `tests/discovery.test.ts` asserts.
    return clamp(`${stated} ${opening}`);
  }

  if (opening && opening.length > 0) return clamp(opening);

  // Last resort, and still specific to this entry rather than to the site.
  return `${entry.title} — ${entry.type} on ${SITE_NAME}.`;
}
