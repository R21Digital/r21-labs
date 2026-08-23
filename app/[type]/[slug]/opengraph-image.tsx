import { getPublishedEntries } from "@/lib/content";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";
import { entryDescription } from "@/lib/site";


export const alt = "R21 Labs entry";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * 🔴 An image route does NOT inherit the page's `generateStaticParams`.
 *
 * Without these two exports the build printed `ƒ /[type]/[slug]/opengraph-image
 * — server-rendered on demand`: the only dynamic route on an otherwise static
 * site, invoking Satori at request time for every scraper hit, and quietly
 * contradicting the static-only claim in the README.
 *
 * It was easy to miss because the page beside it was already static and the
 * cards rendered correctly either way. tests/boundary.test.ts now fails on any
 * dynamic route, so the next one cannot slip through on a green suite.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedEntries().map((entry) => ({
    type: entry.filePath.split("/")[0],
    slug: entry.slug,
  }));
}

/**
 * Per-entry share cards.
 *
 * `generateStaticParams` is inherited from the page in the same segment, so
 * only PUBLISHED entries get an image generated — a draft has no route and
 * therefore no card. That is guard 1 reaching the image layer for free, and it
 * is the reason there is no separate draft check here.
 */
export default async function Image({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  const entry = getPublishedEntries().find(
    (candidate) => candidate.slug === slug && candidate.filePath.startsWith(`${type}/`),
  );

  if (!entry) {
    // Unreachable via a generated param, but returning a valid card beats
    // throwing during static generation for a route that cannot be requested.
    return ogImage({ eyebrow: "R21 Labs", title: "Not found" });
  }

  const description = entryDescription(entry);

  return ogImage({
    eyebrow: entry.type,
    title: entry.title,
    // A share card is a glance, not a read. Long problem statements get cut at
    // a word boundary rather than mid-word.
    subtitle:
      description.length > 150
        ? `${description.slice(0, 150).replace(/\s+\S*$/, "")}…`
        : description,
    meta: entry.verifiedOn ? `verified ${entry.verifiedOn}` : undefined,
  });
}
