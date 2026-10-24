"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import SubmitForm from "@/components/site/SubmitForm";
import { ORGANIZATION, SITE_NAME } from "@/lib/site";
import { STRINGS } from "@/lib/strings";

/**
 * The footer.
 *
 * Was deliberately three facts and one link. It now also carries the subscribe
 * box, which is the one thing on this site that belongs on every page rather
 * than on a page of its own: someone decides they want to hear about the next
 * entry while they are reading an entry, not while they are looking for a
 * contact form.
 *
 * It is still not a sitemap in disguise. The two links added — suggest and
 * contact — are the site's only non-entry pages, so this is the complete
 * navigation rather than a sample of it.
 *
 * The feed link is here because it was otherwise reachable only by a machine
 * reading the `<link rel="alternate">` in the head — which is fine for a reader
 * app and useless to a person who wants to follow the catalog. It stays next to
 * the subscribe box on purpose: RSS is the version of this that costs the
 * reader nothing and gives R21 no address, and someone who prefers that should
 * see both options in the same place.
 *
 * Naming the LLC alongside the brand is the same call the JSON-LD makes:
 * R21 Digital is a DBA and R21 Media Group, LLC is the entity, and a public
 * engineering site is a place where saying which is which costs nothing.
 */

const linkClass =
  "font-mono text-[11px] uppercase tracking-widest text-ink-dim transition-colors duration-[var(--dur-control)] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";

/**
 * Language comes from the path, not from a layout split: the root layout stays
 * one layout, every route stays prerendered, and `/es/*` pages get the Spanish
 * strings from `lib/strings.ts`. The link URLs are unchanged; only labels
 * translate, because the pages they point at are English.
 */
export default function Footer() {
  const pathname = usePathname();
  const lang = pathname === "/es" || pathname.startsWith("/es/") ? "es" : "en";
  const f = STRINGS[lang].footer;

  return (
    <footer
      lang={lang === "es" ? "es" : undefined}
      className="mt-auto border-t border-[var(--hairline)]"
    >
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="max-w-md">
            <p className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-muted">
              {f.newEntries}
            </p>
            {/* 🔴 The copy here is deliberately smaller than the obvious version.
                Adversarial review 2026-08-24 caught the first draft promising
                "You're on the list." There is no list — the address is emailed
                to R21 and added by a person. Every word of a subscribe box is a
                promise about future behaviour, and this site cannot afford one
                it has not built. When a real list with confirmed opt-in exists,
                this copy earns the stronger claim. */}
            <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
              {f.subscribeCopy}
            </p>
            <div className="mt-4">
              <SubmitForm
                inline
                kind="subscribe"
                submitLabel={f.subscribe}
                successTitle={f.successTitle}
                successBody={f.successBody}
                fields={[
                  {
                    name: "email",
                    label: f.email,
                    type: "email",
                    required: true,
                    placeholder: f.emailPlaceholder,
                  },
                ]}
              />
            </div>
          </div>

          <nav aria-label={f.navLabel} className="flex flex-col gap-2.5 sm:items-end">
            <Link href="/blog" className={linkClass}>
              {f.notes}
            </Link>
            <Link href="/suggest" className={linkClass}>
              {f.suggest}
            </Link>
            <Link href="/contact" className={linkClass}>
              {f.work}
            </Link>
            <a href="/feed.xml" className={linkClass}>
              RSS
            </a>
            <Link href="/terms" className={linkClass}>
              {f.terms}
            </Link>
            <a href={ORGANIZATION.url} className={linkClass}>
              r21digital.com
            </a>
          </nav>
        </div>

        <p className="tabular mt-9 border-t border-[var(--hairline)] pt-6 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          {SITE_NAME} — {ORGANIZATION.name} · {ORGANIZATION.legalName}
        </p>
      </div>
    </footer>
  );
}
