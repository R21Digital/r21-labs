import type { Metadata } from "next";
import Link from "next/link";

import Wordmark from "@/components/brand/Wordmark";

/**
 * The 404.
 *
 * `dynamicParams = false` on the entry route means every unknown path lands
 * here statically, so this is the page an expired or mistyped link produces —
 * and R21 Labs will produce those, because an entry that fails re-verification
 * is meant to be unpublished rather than left standing with a stale claim.
 * Saying that plainly is more useful than "page not found", and it explains
 * the site's own model to whoever arrived on a dead link.
 */
export const metadata: Metadata = {
  title: "Not found",
  description:
    "That page is not here. An entry may have been unpublished pending re-verification.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-24">
      <Wordmark className="text-lg" />
      <p className="mt-12 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        404
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        That page is not here.
      </h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        Either the address is wrong, or the entry was unpublished pending
        re-verification. Entries here come down rather than stand with a claim
        nobody has re-checked.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex w-fit rounded-[var(--radius-control)] border border-[var(--hairline-strong)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink transition-colors duration-[var(--dur-control)] hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        Back to the catalog
      </Link>
    </main>
  );
}
