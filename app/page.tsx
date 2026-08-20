import AuroraWash from "@/components/brand/AuroraWash";
import FrostedCard from "@/components/brand/FrostedCard";
import Wordmark from "@/components/brand/Wordmark";
import StatRow from "@/components/site/StatRow";
import SystemTrace from "@/components/site/SystemTrace";
import { getPublishedEntries } from "@/lib/content";
import Link from "next/link";

export default function Home() {
  const entries = getPublishedEntries();
  const catalogue = entries.filter((entry) => entry.type !== "stack");

  return (
    <>
      {/* DARK CHAPTER — hero. The direction pairs a boundary-led headline with
          one deliberate operational visual, and puts verified numbers directly
          beneath it. */}
      <section className="relative isolate overflow-hidden border-b border-[var(--hairline)]">
        <AuroraWash intensity={0.16} />
        <div className="relative mx-auto grid w-full max-w-5xl gap-10 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <Wordmark className="text-2xl" />
            <h1 className="mt-8 font-display text-4xl font-bold leading-[1.08] text-ink sm:text-5xl">
              We build the tools
              <br />
              we run on.
            </h1>
            <p className="mt-5 max-w-prose text-ink-muted">
              Tools we tested, software we built, and the playbooks that tie
              them together. Every entry says where it came from and when we
              last checked it.
            </p>
          </div>

          <div className="lg:pt-4">
            <SystemTrace />
            <StatRow entries={entries} />
          </div>
        </div>
      </section>

      {/* Directory */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-dim">
          Builds &amp; tools
        </h2>

        {catalogue.length === 0 ? (
          <p className="mt-6 text-ink-muted">
            No published entries yet. Every candidate stays a draft until its
            source, licence, and links are verified against the registry.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {catalogue.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/${entry.filePath.split("/")[0]}/${entry.slug}`}
                  className="block rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {/* `interactive` is earned now — these ARE links. */}
                  <FrostedCard interactive>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">
                      {entry.type}
                    </p>
                    <h3 className="mt-1.5 font-display text-lg font-semibold text-ink">
                      {entry.title}
                    </h3>
                    {entry.problem ? (
                      <p className="mt-2 text-sm text-ink-muted">{entry.problem}</p>
                    ) : null}
                    <p className="tabular mt-3 font-mono text-[11px] text-ink-dim">
                      {entry.stack ?? entry.source} · verified {entry.verifiedOn}
                    </p>
                  </FrostedCard>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
