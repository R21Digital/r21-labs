import type { Metadata } from "next";

import { ResearchIndex } from "@/components/site/ResearchPages";
import { OG_IMAGE, SITE_URL } from "@/lib/site";
import { STRINGS } from "@/lib/strings";

const s = STRINGS["en"];
const en = `${SITE_URL}/research`;
const es = `${SITE_URL}/es/research`;
const canonical = en;

export const metadata: Metadata = {
  title: s.research,
  description: s.indexIntro,
  alternates: { canonical, languages: { en, es, "x-default": en } },
  openGraph: {
    title: `${s.research} · R21 Labs`,
    description: s.indexIntro,
    url: canonical,
    ...OG_IMAGE,
  },
};

export default function ResearchIndexPage() {
  return <ResearchIndex lang="en" />;
}
