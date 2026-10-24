import { OG_CONTENT_TYPE, OG_SIZE, ogImage, ogSubtitle } from "@/lib/og";
import { getPublishedReports } from "@/lib/research";

export const alt = "R21 Labs research report";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * An image route does not inherit the page's `generateStaticParams` (see
 * app/[type]/[slug]/opengraph-image.tsx): without these two exports the card
 * renders on demand and the route table shows a dynamic route.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedReports("en").map((report) => ({ slug: report.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getPublishedReports("en").find((candidate) => candidate.slug === slug);

  if (!report) {
    // Unreachable via a generated param; a valid card beats throwing mid-build.
    return ogImage({ eyebrow: "R21 Labs", title: "Not found" });
  }

  return ogImage({
    eyebrow: `R21 Labs Research · Issue ${report.issue}`,
    title: report.title,
    subtitle: ogSubtitle(report.summary),
    meta:
      report.sampleSize !== undefined
        ? `${report.measuredOn} · n = ${report.sampleSize}`
        : undefined,
  });
}
