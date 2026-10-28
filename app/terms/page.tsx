import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OG_PAGE, ORGANIZATION } from "@/lib/site";

/**
 * Terms of use.
 *
 * The site had none until 2026-10-13. The boilerplate (operator, disclaimer,
 * liability, governing law, contact) is copied from r21digital.com/en/terms so
 * the two sites under one LLC say the same thing; only what is specific to
 * Labs is written here.
 *
 * The automated-access section is R21's shared clause, v1.0.0, from
 * `R21-Brain/clients/r21/templates/legal/automated-access-clause.md`. Keep its
 * wording in step with that file rather than editing it here. Its first
 * sentence defers to robots.txt, which allows every crawler (app/robots.ts),
 * so it does not contradict the GEO decision recorded there.
 *
 * Not reviewed by a lawyer.
 */

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms for using R21 Labs, including what automated access, reverse engineering and AI tools may and may not do with the site.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms · R21 Labs",
    description:
      "The terms for using R21 Labs, including automated access, reverse engineering and AI tools.",
    url: "/terms",
    ...OG_PAGE,
  },
};

const UPDATED = "2026-10-13";

const link =
  "text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-ink">{heading}</h2>
      {children}
    </section>
  );
}

const robotsTxt = (
  <a href="/robots.txt" className={link}>
    <code className="font-mono text-[0.9em]">robots.txt</code>
  </a>
);

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        Terms
      </p>
      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        Terms of use
      </h1>
      <p className="tabular mt-3 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
        Last updated <time dateTime={UPDATED}>{UPDATED}</time>
      </p>

      <div className="mt-8 leading-relaxed text-ink-muted [&_p]:my-4">
        <p>
          These Terms govern your use of r21labs.com, operated by {ORGANIZATION.name} (a brand of{" "}
          {ORGANIZATION.legalName}). By using this site, you agree to these Terms.
        </p>

        <Section heading="Use of the site">
          <p>
            The entries and notes here record what R21 tested, built and runs. They are
            informational, not legal, security or other professional advice. Any client engagement
            is governed by a separate written agreement, which controls if it conflicts with these
            Terms. You agree to use this site lawfully and not to misuse its forms (for example,
            for spam).
          </p>
        </Section>

        <Section heading="Intellectual property">
          <p>
            The writing, design and branding on this site are owned by R21 or used with
            permission, and may not be copied or reused without our written consent. The
            third-party tools listed here belong to their authors: each entry credits its source
            and states its licence, and their names and logos remain the property of their
            respective owners. We are not responsible for the content, policies or practices of
            the third-party sites we link to.
          </p>
        </Section>

        <Section heading="Automated access, reverse engineering and AI tools">
          <p>
            Search engines and AI answer services may index and cite the public pages of this site
            as our {robotsTxt} file allows. Unless we agree otherwise in writing, you may not, by
            hand or with any tool (including AI agents, browser automation and reverse-engineering
            software):
          </p>
          <ul className="my-4 list-disc space-y-1.5 pl-5">
            <li>
              decompile, disassemble, deobfuscate or otherwise reverse engineer the site&rsquo;s
              code, bundles, APIs or data formats, or use them to reconstruct its source code,
              features or design;
            </li>
            <li>
              scrape, crawl or extract content or data in bulk beyond what {robotsTxt} allows, or
              use material collected in breach of this section to build a database, dataset or
              competing product;
            </li>
            <li>
              copy or clone the site&rsquo;s design, layout, code or content to build another site
              or app;
            </li>
            <li>
              bypass, probe or test logins, rate limits or other access controls, or call endpoints
              that are not public;
            </li>
            <li>use scripts or automated agents to submit forms;</li>
            <li>send traffic that degrades the site&rsquo;s performance or availability.</li>
          </ul>
          <p>
            This section does not limit an official API, feed or integration we provide, which is
            governed by its own terms. We may block access, suspend accounts and pursue any remedy
            the law allows. Where applicable law grants a right to reverse engineer that cannot be
            waived by contract, this section applies only as far as that law permits.
          </p>
        </Section>

        <Section heading="Disclaimer">
          <p>
            This site and its content are provided &ldquo;as is&rdquo; without warranties of any
            kind. We make no guarantee that the site will be uninterrupted, error-free, or that any
            information is complete or current.
          </p>
        </Section>

        <Section heading="Limitation of liability">
          <p>
            To the fullest extent permitted by law, R21 is not liable for any indirect, incidental,
            or consequential damages arising from your use of this site.
          </p>
        </Section>

        <Section heading="Governing law">
          <p>
            These Terms are governed by the laws of the State of Arizona, USA, without regard to
            conflict-of-law rules.
          </p>
        </Section>

        <Section heading="Changes to these Terms">
          <p>
            We may update these Terms from time to time. Continued use of the site after changes
            means you accept the updated Terms.
          </p>
        </Section>

        <Section heading="Contact">
          <p>
            Questions about these Terms? Email{" "}
            <a href="mailto:info@r21digital.com" className={link}>
              info@r21digital.com
            </a>{" "}
            or call (480) 997-4639.
          </p>
        </Section>
      </div>
    </div>
  );
}
