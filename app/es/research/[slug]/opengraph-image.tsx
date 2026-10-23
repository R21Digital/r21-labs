import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";
import { getPublishedReports } from "@/lib/research";

export const alt = "Informe de investigación de R21 Labs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * An image route does not inherit the page's `generateStaticParams` (see
 * app/[type]/[slug]/opengraph-image.tsx): without these two exports the card
 * renders on demand and the route table shows a dynamic route.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedReports("es").map((report) => ({ slug: report.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getPublishedReports("es").find((candidate) => candidate.slug === slug);

  if (!report) {
    // Unreachable via a generated param; a valid card beats throwing mid-build.
    return ogImage({ eyebrow: "R21 Labs", title: "Not found" });
  }

  return ogImage({
    eyebrow: `Investigación R21 Labs · Edición ${report.issue}`,
    title: report.title,
    subtitle: report.summary,
    meta:
      report.sampleSize !== undefined
        ? `${report.measuredOn} · n = ${report.sampleSize}`
        : undefined,
  });
}
