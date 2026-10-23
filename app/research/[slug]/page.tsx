import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResearchReport } from "@/components/site/ResearchPages";
import { getPublishedReports } from "@/lib/research";
import { reportMetadata } from "@/lib/research-seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedReports("en").map((report) => ({ slug: report.slug }));
}

function findReport(slug: string) {
  return getPublishedReports("en").find((report) => report.slug === slug);
}

export async function generateMetadata({
  params,
}: PageProps<"/research/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const report = findReport(slug);
  return report ? reportMetadata(report) : {};
}

export default async function ReportPage({
  params,
}: PageProps<"/research/[slug]">) {
  const { slug } = await params;
  const report = findReport(slug);
  if (!report) notFound();
  return <ResearchReport report={report} />;
}
