import { getPublishedEntries } from "@/lib/content";
import { getPublishedNotes, notePath } from "@/lib/notes";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  canonicalUrl,
  entryDescription,
} from "@/lib/site";

/**
 * RSS feed.
 *
 * `force-static` because the whole site is static and a route handler is the
 * one place that quietly is not. Without it this becomes the only dynamic
 * response on the site, which breaks the static-only claim in the README the
 * same way the missing `dynamicParams = false` did on the entry route.
 */
export const dynamic = "force-static";

/**
 * XML has five reserved characters and an unescaped one produces a feed that
 * every reader rejects as malformed. Entry titles here contain `&` already.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): Response {
  const entries = getPublishedEntries();
  const notes = getPublishedNotes();

  // Newest verification / publish date first. A feed ordered by filesystem
  // walk order is arbitrary, and readers show it in document order.
  const catalogItems = entries.map((entry) => ({
    title: entry.title,
    url: canonicalUrl(entry),
    date: entry.verifiedOn,
    category: entry.type,
    description: entryDescription(entry),
  }));
  const noteItems = notes.map((note) => ({
    title: note.title,
    url: `${SITE_URL}${notePath(note)}`,
    date: note.publishedOn,
    category: "note",
    description: note.summary,
  }));
  const ordered = [...catalogItems, ...noteItems].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  const items = ordered
    .map((item) => {
      const date = item.date
        ? new Date(`${item.date}T00:00:00Z`).toUTCString()
        : undefined;

      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.url)}</link>`,
        // A feed reader dedupes on guid. It must be stable across rebuilds,
        // so it is the canonical URL and never anything build-time.
        `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
        `      <category>${escapeXml(item.category)}</category>`,
        date ? `      <pubDate>${date}</pubDate>` : null,
        `      <description>${escapeXml(item.description)}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
