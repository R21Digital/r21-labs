import type { MetadataRoute } from "next";

import { getPublishedEntries } from "@/lib/content";
import { SITE_URL, canonicalPath } from "@/lib/site";

/**
 * The sitemap.
 *
 * Reads `getPublishedEntries()`, like every route — so a draft cannot appear
 * here even if someone forgets this file exists. tests/boundary.test.ts fails
 * the suite if anything under app/ reaches for the unguarded reader, and that
 * rule covers this file for the same reason it covers a page.
 *
 * `lastModified` is the entry's own `verifiedOn`, not the build time. Build
 * time would restamp all fifteen URLs on every deploy, telling crawlers the
 * whole site changed when a CSS token moved. `verifiedOn` is the date the
 * claim on the page was actually checked, which is the thing a reader — and a
 * crawler — cares about here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries = getPublishedEntries();

  const newest = entries
    .map((entry) => entry.verifiedOn)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);

  return [
    {
      url: SITE_URL,
      lastModified: newest ? new Date(`${newest}T00:00:00Z`) : undefined,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...entries.map((entry) => ({
      url: `${SITE_URL}${canonicalPath(entry)}`,
      lastModified: entry.verifiedOn
        ? new Date(`${entry.verifiedOn}T00:00:00Z`)
        : undefined,
      changeFrequency: "monthly" as const,
      priority: entry.type === "playbook" ? 0.8 : 0.7,
    })),
  ];
}
