import type { Metadata } from "next";
import Link from "next/link";

import Wordmark from "@/components/brand/Wordmark";
import { OG_IMAGE } from "@/lib/site";
import { getPublishedNotes, notePath } from "@/lib/notes";

export const metadata: Metadata = {
  title: "Notes",
  description:
    "First-party notes from R21 about tools it actually runs. Not the catalog — those entries still come from the registry, not from a blog post.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Notes · R21 Labs",
    description:
      "First-party notes from R21 about tools it actually runs. Not the catalog.",
    url: "/blog",
    ...OG_IMAGE,
  },
};

export default function BlogIndexPage() {
  const notes = getPublishedNotes();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14">
      <Link
        href="/"
        className="inline-flex font-mono text-[11px] uppercase tracking-widest text-ink-dim transition-colors duration-[var(--dur-control)] hover:text-ink"
      >
        <Wordmark className="text-sm" />
      </Link>
      <p className="tabular mt-10 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        Notes
      </p>
      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        Written from running it
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-muted">
        The catalog is the registry. These notes are R21 writing about a tool after using it —
        not a secondhand roundup, and not live until someone at R21 marks the file published.
      </p>

      {notes.length === 0 ? (
        <p className="mt-10 rounded-[var(--radius-card)] border border-[var(--hairline)] px-4 py-6 text-base leading-relaxed text-ink-muted">
          Nothing published yet. Drafts sit in the repo until they are reviewed. This page is
          the landing strip; it is empty on purpose.
        </p>
      ) : (
        <ul className="mt-10 space-y-5">
          {notes.map((note) => (
            <li key={note.slug}>
              <Link
                href={notePath(note)}
                className="block rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                <p className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim">
                  {note.publishedOn}
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold text-ink">{note.title}</h2>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">{note.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
