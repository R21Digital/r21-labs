import type { Metadata } from "next";
import Link from "next/link";

import FrostedCard from "@/components/brand/FrostedCard";
import SubmitForm from "@/components/site/SubmitForm";
import { getPublishedEntries } from "@/lib/content";
import { OG_IMAGE } from "@/lib/site";

/**
 * Suggest a tool.
 *
 * The page states plainly that most suggestions will not be published, because
 * the alternative is collecting submissions under an implied promise the
 * curation model cannot keep. Curation here is opt-in by design — the spec
 * rejects generating the catalog from whatever happens to be installed — so a
 * suggestion is a candidate for review and nothing more. Saying so up front is
 * cheaper than saying it later in a reply nobody sends.
 */

export const metadata: Metadata = {
  title: "Suggest a tool",
  description:
    "Tell R21 Labs about an open-source or source-available tool worth testing. Every suggestion is reviewed by hand; most are not published.",
  alternates: { canonical: "/suggest" },
  openGraph: {
    title: "Suggest a tool · R21 Labs",
    description:
      "Tell R21 Labs about an open-source or source-available tool worth testing.",
    url: "/suggest",
    ...OG_IMAGE,
  },
};

export default function SuggestPage() {
  // Counted, not typed — the same rule the homepage follows. A hand-written
  // "we've reviewed 15 tools" is wrong the day after the next entry lands.
  const published = getPublishedEntries().length;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        Contribute
      </p>
      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        Suggest a tool
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-muted">
        If something belongs in this catalog and is not here, send it. R21 is especially
        interested in tools that do a job people currently pay for.
      </p>

      <FrostedCard className="mt-9">
        <SubmitForm
          kind="suggestion"
          submitLabel="Send suggestion"
          successTitle="Got it."
          successBody="Someone at R21 reads every one of these. If it makes the catalog you will see it on the site — and if you left an address, you will hear back either way."
          fields={[
            {
              name: "toolName",
              label: "Tool",
              required: true,
              placeholder: "ripgrep",
            },
            {
              name: "toolUrl",
              label: "Link",
              type: "url",
              required: true,
              placeholder: "https://github.com/BurntSushi/ripgrep",
              hint: "The repo, or the project's own site. Not a blog post about it.",
            },
            {
              name: "replaces",
              label: "Replaces",
              placeholder: "Algolia, $500/mo",
              hint: "Optional. If it does a job you would otherwise pay for, name the product and the price.",
            },
            {
              name: "why",
              label: "What it does for you",
              type: "textarea",
              required: true,
              hint: "Written from using it, not from its README. That is the whole bar.",
            },
            {
              name: "email",
              label: "Your email",
              type: "email",
              hint: "Optional, and only used to reply to you about this.",
            },
          ]}
        />
      </FrostedCard>

      <section className="mt-12 border-t border-[var(--hairline)] pt-8">
        <h2 className="font-display text-lg font-semibold text-ink">What happens to it</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
          <li>
            <strong className="text-ink">It is read by a person.</strong> Nothing here is
            generated from a crawl of what R21 happens to have installed. That was considered
            and rejected: a catalog assembled that way publishes whatever gets added next.
          </li>
          <li>
            <strong className="text-ink">Most suggestions are not published.</strong> An entry
            only goes up once R21 has actually run the thing, and once its source, licence and
            links have been checked against the registry rather than a blog post. There are{" "}
            {published} entries on the site today; the candidate list is considerably longer.
          </li>
          <li>
            <strong className="text-ink">Credit stays with the author.</strong> R21 links and
            credits third-party tools. It does not host, mirror or redistribute them, and it
            does not publish a licence value it has not read.
          </li>
        </ul>
        <p className="mt-6 text-sm text-ink-muted">
          Wrong form?{" "}
          <Link
            href="/contact"
            className="text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Talk to R21 about building something
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
