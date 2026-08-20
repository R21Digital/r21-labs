import { notFound } from "next/navigation";

import { getPublishedEntries } from "@/lib/content";
import { ageInDays, isStale } from "@/lib/guards/staleness";
import type { Entry } from "@/lib/schema";

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

function AttributionBlock({ entry }: { entry: Entry }) {
  // 🔴 Always rendered. The attribution guard makes a published `tool` without
  // source/sourceUrl/licence fail the build, so if one reaches here it HAS the
  // fields — but the guard protects the data, and this protects the display.
  // A credited tool whose credit is not shown is uncredited to a reader.
  const rows: Array<[string, string | undefined]> = [
    ["source", entry.source],
    ["licence", entry.license],
    ["stack", entry.stack],
    ["verified", entry.verifiedOn],
  ];

  return (
    <dl className="mt-8 grid gap-px border-y border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2">
      {rows
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => (
          <div key={label} className="bg-canvas px-4 py-3">
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
  const entry = getPublishedEntries().find(
    (candidate) => candidate.slug === slug && candidate.filePath.startsWith(`${type}/`),
  );

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
        <p
          className={`font-mono text-[11px] uppercase tracking-widest ${
            isPlaybook ? "text-chapter-ink/60" : "text-ink-dim"
          }`}
        >
          {entry.type}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          {entry.title}
        </h1>
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

        <AttributionBlock entry={entry} />

        {/* Body is plain prose today. Rich MDX rendering is a follow-on — the
            attribution block is the part that must never be missing, and it is
            frontmatter-driven, so it does not wait on the MDX pipeline. */}
        <div
          className={`mt-8 space-y-4 leading-relaxed ${
            isPlaybook ? "text-chapter-ink/80" : "text-ink-muted"
          }`}
        >
          {entry.body
            .trim()
            .split(/\n{2,}/)
            .filter((block) => !block.startsWith(">"))
            .map((block, index) => (
              <p key={index}>{block.replace(/\n/g, " ")}</p>
            ))}
        </div>
      </div>
    </article>
  );
}
