import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * robots.txt.
 *
 * 🔴 Everything is allowed, INCLUDING the AI crawlers, and that is a decision
 * rather than a default.
 *
 * R21 sells GEO — getting clients cited by ChatGPT, Perplexity, Claude and
 * Google AI Overviews. A site that blocks GPTBot while its owner bills for AI
 * visibility is arguing against its own product, and it is the kind of
 * contradiction a prospect finds in ten seconds.
 *
 * There is nothing here worth withholding: every page is a public claim about
 * public software, with a source link and a verification date attached. Being
 * quoted by an assistant IS the goal.
 *
 * Drafts are not excluded by a rule here, on purpose. A `Disallow` line is a
 * public index of the things you did not want read. Drafts get no route, no
 * sitemap entry and no rendered bytes — they are absent, which is stronger
 * than being forbidden.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
