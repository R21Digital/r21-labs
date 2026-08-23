import { ORGANIZATION, SITE_NAME } from "@/lib/site";

/**
 * The footer.
 *
 * Deliberately three facts and one link, not a sitemap in disguise. The site is
 * one directory and a set of entries; a column layout would be scaffolding for
 * navigation that does not exist.
 *
 * The feed link is here because it was otherwise reachable only by a machine
 * reading the `<link rel="alternate">` in the head — which is fine for a reader
 * app and useless to a person who wants to follow the catalog.
 *
 * Naming the LLC alongside the brand is the same call the JSON-LD makes:
 * R21 Digital is a DBA and R21 Media Group, LLC is the entity, and a public
 * engineering site is a place where saying which is which costs nothing.
 */
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--hairline)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          {SITE_NAME} — {ORGANIZATION.name}
        </p>
        <div className="flex items-center gap-5">
          <a
            href="/feed.xml"
            className="font-mono text-[11px] uppercase tracking-widest text-ink-dim transition-colors duration-[var(--dur-control)] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            RSS
          </a>
          <a
            href={ORGANIZATION.url}
            className="font-mono text-[11px] uppercase tracking-widest text-ink-dim transition-colors duration-[var(--dur-control)] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            r21digital.com
          </a>
        </div>
      </div>
    </footer>
  );
}
