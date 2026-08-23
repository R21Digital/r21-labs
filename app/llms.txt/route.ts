import { getPublishedEntries } from "@/lib/content";
import {
  ORGANIZATION,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  canonicalUrl,
  entryDescription,
} from "@/lib/site";

export const dynamic = "force-static";

/**
 * /llms.txt — the llmstxt.org convention: a single markdown file that tells an
 * assistant what this site is and where its content lives, without making it
 * infer that from scraped HTML.
 *
 * This one is not optional decoration. R21 sells GEO — getting clients cited
 * by AI search — and `robots_ai` and `llms_txt` are two of the checks R21's own
 * fleet canary runs against client sites. R21 Labs failing a check R21 bills
 * clients for is the kind of contradiction a technical prospect finds
 * immediately, and it was failing: the canary reported
 * `MISSING r21labs/llms_txt` on 2026-08-22.
 *
 * Generated from the same guarded read as every other route, so it lists
 * exactly what is published and cannot name a draft.
 */
export function GET(): Response {
  const entries = getPublishedEntries();

  const section = (heading: string, type: string) => {
    const matching = entries.filter((entry) => entry.type === type);
    if (matching.length === 0) return null;
    return [
      `## ${heading}`,
      "",
      ...matching.map(
        (entry) => `- [${entry.title}](${canonicalUrl(entry)}): ${entryDescription(entry)}`,
      ),
      "",
    ].join("\n");
  };

  const body = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `${SITE_NAME} is published by ${ORGANIZATION.name} (${ORGANIZATION.legalName}).`,
    "It is a curation site, not a republishing platform: third-party tools are credited and",
    "linked, never hosted or redistributed.",
    "",
    "Every entry carries the source it came from, its licence, and the date its claims were",
    "last checked against the registry — GitHub, npm, PyPI. Entries whose verification has",
    "aged out are withdrawn from the site's own counts and say so on the page. Nothing is",
    "published from a secondhand blog post or a video.",
    "",
    section("Software R21 built", "build"),
    section("Tools R21 tested and recommends", "tool"),
    section("Playbooks", "playbook"),
    section("Stack", "stack"),
    "## Also",
    "",
    `- [Full index](${SITE_URL}/sitemap.xml): every published URL`,
    `- [Feed](${SITE_URL}/feed.xml): RSS`,
    `- [R21 Digital](${ORGANIZATION.url}): websites and marketing services live here, not on Labs`,
    "",
  ]
    .filter((part) => part !== null)
    .join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
