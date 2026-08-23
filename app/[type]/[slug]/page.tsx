import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Link from "next/link";

import { getPublishedEntries } from "@/lib/content";
import { ageInDays, isStale } from "@/lib/guards/staleness";
import Wordmark from "@/components/brand/Wordmark";
import EntryBody from "@/components/site/EntryBody";
import EntryLogo from "@/components/site/EntryLogo";
import JsonLd from "@/components/site/JsonLd";
import {
  ORGANIZATION,
  SITE_NAME,
  canonicalPath,
  canonicalUrl,
  entryDescription,
} from "@/lib/site";
import { CATEGORY_LABEL, type Entry } from "@/lib/schema";

/**
 * Entry pages.
 *
 * `generateStaticParams` is fed by getPublishedEntries(), so a draft never gets
 * a route generated for it. That is guard 1 enforced at the routing layer as
 * well as the render layer — the draft-leak test checks the built output, and
 * this is the reason there is nothing for it to find.
 *
 * A PLAYBOOK renders as a white chapter. The direction reserves white sections
 * for operational explanation, and long-form reading is where SEO lives
 * (spec §1 goal 2), so the light surface is functional rather than decorative.
 */

/**
 * 🔴 Without this, Next's default `dynamicParams: true` leaves the route as
 * blocking compute in the prerender manifest: an unknown /anything/anything hits
 * the renderer at REQUEST time. That breaks the static-only claim in the README
 * and makes draft safety depend on the runtime lookup staying guarded forever.
 *
 * Flagged by adversarial review 2026-08-20. Unknown paths now 404 statically.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedEntries().map((entry) => ({
    type: entry.filePath.split("/")[0],
    slug: entry.slug,
  }));
}

/** The one lookup both the page and its metadata use, so they cannot disagree. */
function findEntry(type: string, slug: string): Entry | undefined {
  return getPublishedEntries().find(
    (candidate) => candidate.slug === slug && candidate.filePath.startsWith(`${type}/`),
  );
}

/**
 * Per-entry metadata.
 *
 * 🔴 This is the fix for the site's worst defect. Until 2026-08-22 no page
 * exported metadata, so all eleven entry pages inherited the root layout's
 * title and description verbatim — eleven identical rows in a search result,
 * and eleven identical link previews, on a site whose second stated goal is
 * SEO. Asserted in tests/discovery.test.ts, which fails on ANY duplicate.
 *
 * The description is the entry's own `problem`/`situation` line, which is the
 * sentence a human already wrote to say what the thing is for. Reusing it
 * beats generating a summary that could drift from the page.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[type]/[slug]">): Promise<Metadata> {
  const { type, slug } = await params;
  const entry = findEntry(type, slug);
  if (!entry) return {};

  const description = entryDescription(entry);
  const url = canonicalUrl(entry);

  return {
    title: entry.title,
    description,
    alternates: { canonical: canonicalPath(entry) },
    openGraph: {
      type: "article",
      url,
      title: `${entry.title} · ${SITE_NAME}`,
      description,
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title: `${entry.title} · ${SITE_NAME}`,
      description,
    },
  };
}

/**
 * Structured data, shaped by what the entry actually IS.
 *
 * A tool R21 recommends and an app R21 built are different claims, and
 * flattening both to `Article` would misdescribe them. A playbook genuinely is
 * an article. `SoftwareSourceCode` carries the licence and repository fields
 * that this site's whole guard model exists to keep honest, so the machine
 * reading matches the attribution block a human sees.
 */
function entrySchema(entry: Entry): Record<string, unknown> {
  const base = {
    "@context": "https://schema.org",
    name: entry.title,
    url: canonicalUrl(entry),
    description: entryDescription(entry),
    ...(entry.verifiedOn ? { dateModified: entry.verifiedOn } : {}),
    publisher: {
      "@type": "Organization",
      name: ORGANIZATION.name,
      url: ORGANIZATION.url,
    },
  };

  if (entry.type === "playbook") {
    return {
      ...base,
      "@type": "Article",
      headline: entry.title,
      author: { "@type": "Organization", name: ORGANIZATION.name },
    };
  }

  return {
    ...base,
    "@type": "SoftwareSourceCode",
    ...(entry.license ? { license: entry.license } : {}),
    ...(entry.sourceUrl ? { codeRepository: entry.sourceUrl } : {}),
    ...(entry.repo ? { codeRepository: entry.repo } : {}),
    ...(entry.stack ? { programmingLanguage: entry.stack } : {}),
    ...(entry.source ? { creditText: entry.source } : {}),
  };
}

/**
 * What this replaces, and what that costs.
 *
 * Rendered above the attribution block because after the 2026-08-23 re-point it
 * is the reason most visitors are on the page. Every figure links to the
 * vendor's own pricing page — the link guard checks those URLs alongside the
 * repo links, precisely because a pricing page moves more often than a repo
 * does and a dead one is how "$29/mo" becomes a number nobody can check.
 */
function ReplacesBlock({ entry }: { entry: Entry }) {
  if (!entry.replaces?.length) return null;

  return (
    <section className="mt-8 rounded-[var(--radius-card)] border border-accent/25 bg-accent/[0.05] p-5">
      <h2 className="font-mono text-[11px] uppercase tracking-widest text-accent">
        Replaces
      </h2>
      <ul className="mt-3 space-y-2.5">
        {entry.replaces.map((replacement) => (
          <li
            key={replacement.tool}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
          >
            <span className="font-display text-lg font-semibold text-ink">
              {replacement.tool}
            </span>
            <a
              href={replacement.sourceUrl}
              className="tabular font-mono text-sm text-accent underline underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              {replacement.pricedAt}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-dim">
        Prices are quoted from the vendor&apos;s own pricing page on {entry.verifiedOn} and
        link to it. Vendors change pricing; check before you decide.
      </p>
    </section>
  );
}

/**
 * The install command.
 *
 * One copy-pasteable line, high on the page. On a resource site this is the
 * single most useful element there is, and its absence was a fair part of why
 * an entry page gave a reader nothing they could not get from the repo in one
 * click.
 */
function InstallBlock({ entry, isChapter }: { entry: Entry; isChapter: boolean }) {
  if (!entry.install) return null;
  return (
    <section className="mt-8">
      <h2
        className={`font-mono text-[11px] uppercase tracking-widest ${
          isChapter ? "text-chapter-ink/60" : "text-ink-dim"
        }`}
      >
        Install
      </h2>
      <pre
        className={`mt-2 overflow-x-auto rounded-[var(--radius-card)] border p-4 font-mono text-sm ${
          isChapter
            ? "border-black/10 bg-black/[0.04] text-chapter-ink"
            : "border-[var(--hairline)] bg-surface text-ink"
        }`}
      >
        <code>{entry.install}</code>
      </pre>
    </section>
  );
}

function AttributionBlock({ entry }: { entry: Entry }) {
  // 🔴 Always rendered. The attribution guard makes a published `tool` without
  // source/sourceUrl/licence fail the build, so if one reaches here it HAS the
  // fields — but the guard protects the data, and this protects the display.
  // A credited tool whose credit is not shown is uncredited to a reader.
  // The hairline grid reads as a glitch when an odd row leaves a blank panel,
  // so the last cell of an odd count spans both columns.
  const rows: Array<[string, string | undefined]> = [
    ["source", entry.source],
    ["licence", entry.license],
    ["stack", entry.stack],
    ["verified", entry.verifiedOn],
  ];
  const filled = rows.filter(([, value]) => Boolean(value));
  const lastSpan = filled.length % 2 === 1;

  return (
    <dl className="mt-8 grid gap-px border-y border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2">
      {filled.map(([label, value], index) => (
        <div
          key={label}
          className={`bg-canvas px-4 py-3 ${
            lastSpan && index === filled.length - 1 ? "sm:col-span-2" : ""
          }`}
        >
          <dt className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">
            {label}
          </dt>
          <dd className="tabular mt-1 text-sm text-ink">{value}</dd>
        </div>
      ))}
      {entry.sourceUrl || entry.liveUrl ? (
        <div className="bg-canvas px-4 py-3 sm:col-span-2">
          <dt className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">
            link
          </dt>
          <dd className="mt-1 text-sm">
            <a
              href={entry.sourceUrl ?? entry.liveUrl}
              className="text-accent underline underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              {entry.sourceUrl ?? entry.liveUrl}
            </a>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export default async function EntryPage({ params }: PageProps<"/[type]/[slug]">) {
  const { type, slug } = await params;
  const entry = findEntry(type, slug);

  if (!entry) notFound();

  const isPlaybook = entry.type === "playbook";

  return (
    <article
      className={
        isPlaybook
          ? "min-h-dvh bg-chapter text-chapter-ink"
          : "min-h-dvh bg-canvas text-ink"
      }
    >
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="inline-flex font-mono text-[11px] uppercase tracking-widest text-ink-dim transition-colors duration-[var(--dur-control)] hover:text-ink"
        >
          <Wordmark className="text-sm" />
        </Link>
        <p
          className={`mt-10 font-mono text-[11px] uppercase tracking-widest ${
            isPlaybook ? "text-chapter-ink/60" : "text-ink-dim"
          }`}
        >
          {entry.category ? CATEGORY_LABEL[entry.category] : entry.type}
        </p>

        {/* The mark sits beside the title rather than above it: at this size it
            reads as identification, which is what it is, instead of as a hero
            image the entry does not have. */}
        <div className="mt-3 flex items-center gap-4">
          {isPlaybook ? null : <EntryLogo entry={entry} size={52} />}
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{entry.title}</h1>
        </div>
        {entry.problem ?? entry.situation ? (
          <p
            className={`mt-4 text-lg ${
              isPlaybook ? "text-chapter-ink/70" : "text-ink-muted"
            }`}
          >
            {entry.problem ?? entry.situation}
          </p>
        ) : null}

        {isStale(entry) ? (
          <p className="mt-6 rounded-[var(--radius-control)] border border-accent/40 px-4 py-3 font-mono text-xs text-accent">
            Last verified {ageInDays(entry)} days ago. Treat this entry as
            unverified until it is re-checked against the registry.
          </p>
        ) : null}

        <ReplacesBlock entry={entry} />

        <InstallBlock entry={entry} isChapter={isPlaybook} />

        <AttributionBlock entry={entry} />

        <EntryBody body={entry.body} isChapter={isPlaybook} />
      </div>

      <JsonLd data={entrySchema(entry)} />
    </article>
  );
}
