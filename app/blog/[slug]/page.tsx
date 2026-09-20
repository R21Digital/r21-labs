import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import Wordmark from "@/components/brand/Wordmark";
import EntryBody from "@/components/site/EntryBody";
import { OG_IMAGE, SITE_URL } from "@/lib/site";
import { getPublishedNotes } from "@/lib/notes";

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
      title: `${note.title} · R21 Labs`,
      description: note.summary,
      url: `/blog/${note.slug}`,
      ...OG_IMAGE,
    },
  };
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
        <p className="mt-12 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          <Link href="/blog" className="hover:text-ink">
            All notes
          </Link>
          <span className="mx-2">·</span>
          <a href={SITE_URL}>Catalog</a>
        </p>
      </div>
    </article>
  );
}
