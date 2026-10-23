import type { Metadata } from "next";

import type { Report } from "./research";
import { SITE_URL } from "./site";

/**
 * Metadata for a report page, shared by the English and Spanish routes so the
 * hreflang pair cannot drift between them. Absolute URLs on purpose: an
 * hreflang that resolves against the wrong origin is silently ignored.
 *
 * No `images` here on purpose: the segment's `opengraph-image` route supplies
 * the per-report card, and an explicit `images` entry would override it with the
 * site card.
 */
export function reportMetadata(report: Report): Metadata {
  const en = `${SITE_URL}/research/${report.slug}`;
  const es = `${SITE_URL}/es/research/${report.slug}`;
  const canonical = report.lang === "es" ? es : en;

  return {
    title: report.title,
    description: report.summary,
    alternates: {
      canonical,
      languages: { en, es, "x-default": en },
    },
    openGraph: {
      title: `${report.title} · R21 Labs`,
      description: report.summary,
      url: canonical,
    },
  };
}
