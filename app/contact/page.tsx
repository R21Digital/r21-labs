import type { Metadata } from "next";
import Link from "next/link";

import FrostedCard from "@/components/brand/FrostedCard";
import SubmitForm from "@/components/site/SubmitForm";
import { OG_IMAGE, ORGANIZATION } from "@/lib/site";

/**
 * Work with R21 — scoped to what this site is about.
 *
 * The spec's scope rule is one line: software, agents, MCP servers and
 * developer tools live here; websites and marketing services live on
 * r21digital.com. A general "contact us" form would quietly break that, because
 * the form would start collecting the enquiries the other site is set up to
 * answer, and they would land in an inbox with no pipeline behind them.
 *
 * So the page routes rather than captures: the form is for engineering work,
 * and marketing enquiries get a link out, stated before the form rather than
 * buried under it.
 */

export const metadata: Metadata = {
  title: "Work with R21",
  description:
    "Talk to R21 Digital about MCP servers, agent tooling and custom software. Website and marketing enquiries are handled on r21digital.com.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Work with R21 · R21 Labs",
    description:
      "Talk to R21 Digital about MCP servers, agent tooling and custom software.",
    url: "/contact",
    ...OG_IMAGE,
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        Work with R21
      </p>
      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        Build something on this stack
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-muted">
        The tools in this catalog are the ones R21 runs in production. If you want the same
        machinery pointed at your systems — an MCP server against an internal API, an agent
        that does real work, software that has to hold up — this is the form.
      </p>

      {/* The scope boundary, stated before the form rather than after it.
          Someone who wants a website should find that out in one line, not
          after typing a paragraph into the wrong place. */}
      <p className="mt-5 rounded-[var(--radius-control)] border border-[var(--hairline-strong)] px-4 py-3 text-sm leading-relaxed text-ink-muted">
        Looking for a website, SEO or marketing? That is the same company, different door —{" "}
        <a
          href={ORGANIZATION.url}
          className="text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          r21digital.com
        </a>
        .
      </p>

      <FrostedCard className="mt-9">
        <SubmitForm
          kind="contact"
          submitLabel="Send"
          successTitle="Sent."
          successBody="This goes straight to a person, not a queue. Expect a reply from R21 Digital — check your spam folder if you use a strict filter."
          fields={[
            { name: "name", label: "Name", required: true },
            {
              name: "email",
              label: "Email",
              type: "email",
              required: true,
            },
            { name: "organization", label: "Company", hint: "Optional." },
            {
              name: "message",
              label: "What you are trying to build",
              type: "textarea",
              required: true,
              hint: "The system it has to talk to matters more than the feature list. Rough is fine.",
            },
          ]}
        />
      </FrostedCard>

      <p className="mt-8 text-sm text-ink-muted">
        Want to point R21 at a tool instead?{" "}
        <Link
          href="/suggest"
          className="text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Suggest a tool
        </Link>
        .
      </p>

      <p className="tabular mt-10 border-t border-[var(--hairline)] pt-6 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        {ORGANIZATION.legalName} · Puerto Rico
      </p>
    </div>
  );
}
