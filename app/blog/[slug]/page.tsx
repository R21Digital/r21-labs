import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import Wordmark from "@/components/brand/Wordmark";
import EntryBody from "@/components/site/EntryBody";
import JsonLd from "@/components/site/JsonLd";
import KeepReading from "@/components/site/KeepReading";
import { OG_IMAGE, ORGANIZATION, SITE_NAME, SITE_URL } from "@/lib/site";
import { getPublishedNotes, notePath } from "@/lib/notes";
import { keepReading } from "@/lib/related";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedNotes().map((note) => ({ slug: note.slug }));
}

function findNote(slug: string) {
  return getPublishedNotes().find((note) => note.slug === slug);
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const note = findNote(slug);
  if (!note) return {};

  return {
    title: note.title,
    description: note.summary,
    alternates: { canonical: `/blog/${note.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      publishedTime: note.publishedOn,
      title: `${note.title} · R21 Labs`,
      description: note.summary,
      url: `/blog/${note.slug}`,
      ...OG_IMAGE,
    },
  };
}

/**
 * Structured data for a note. Entry pages already carry Article and
 * BreadcrumbList; notes carried only the site-wide WebSite block, so a crawler
 * had no machine-readable date, author or place in the site for them.
 * `publishedOn` is the only date a note has, so it is both published and
 * modified; no author name is invented, the publisher is the organisation.
 */
function noteSchema(note: NonNullable<ReturnType<typeof findNote>>) {
  const url = `${SITE_URL}/blog/${note.slug}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: note.title,
      description: note.summary,
      url,
      mainEntityOfPage: url,
      datePublished: note.publishedOn,
      dateModified: note.publishedOn,
      inLanguage: "en",
      author: { "@type": "Organization", name: ORGANIZATION.name, url: ORGANIZATION.url },
      publisher: { "@type": "Organization", name: ORGANIZATION.name, url: ORGANIZATION.url },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Notes", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: note.title, item: url },
      ],
    },
  ];
}

export default async function NotePage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const note = findNote(slug);
  if (!note) notFound();

  return (
    <article className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="inline-flex font-mono text-[11px] uppercase tracking-widest text-ink-dim transition-colors duration-[var(--dur-control)] hover:text-ink"
        >
          <Wordmark className="text-sm" />
        </Link>
        <p className="tabular mt-10 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          Note · {note.publishedOn}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{note.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">{note.summary}</p>
        <EntryBody body={note.body} isChapter={false} />
        <KeepReading items={keepReading(notePath(note))} isChapter={false} />
        <p className="mt-12 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          <Link href="/blog" className="hover:text-ink">
            All notes
          </Link>
          <span className="mx-2">·</span>
          <a href={SITE_URL}>Catalog</a>
        </p>
      </div>
      {noteSchema(note).map((data) => (
        <JsonLd key={data["@type"]} data={data} />
      ))}
    </article>
  );
}
