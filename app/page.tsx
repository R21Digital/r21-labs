import AuroraWash from "@/components/brand/AuroraWash";
import FrostedCard from "@/components/brand/FrostedCard";
import Wordmark from "@/components/brand/Wordmark";
import { getPublishedEntries } from "@/lib/content";

/**
 * Phase 3 skeleton. Brand primitives are wired; the full visual system
 * (`operational-enterprise-ai` hero system-trace, hairline grid, stat row,
 * dark→white chapter handoff) lands in Phase 4.
 *
 * Reads through getPublishedEntries(), never readEntries() — that is what makes
 * the draft-leak test meaningful rather than vacuous.
 */
export default function Home() {
  const entries = getPublishedEntries();

  return (
    <main className="relative isolate mx-auto w-full max-w-3xl px-6 py-20">
      <AuroraWash intensity={0.14} />

      <Wordmark className="relative text-3xl" />

      <h1 className="relative mt-8 font-display text-4xl font-bold text-ink">
        Tools we tested. Software we built.
      </h1>
      <p className="relative mt-4 max-w-prose text-ink-muted">
        The AI tools R21 tested and recommends, the software R21 built, and the
        playbooks that connect them.
      </p>

      {entries.length === 0 ? (
        <p className="relative mt-12 font-mono text-sm text-ink-dim">
          No published entries yet. Every candidate stays a draft until its
          source, licence, and links are verified against the registry.
        </p>
      ) : (
        <ul className="relative mt-12 space-y-4">
          {entries.map((entry) => (
            <li key={entry.slug}>
              {/* No `interactive` yet — a hover lift is an affordance promising
                  clickability, and these are not links until Phase 4. */}
              <FrostedCard>
                <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {entry.type}
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-ink">
                  {entry.title}
                </h2>
                {entry.source ? (
                  <p className="tabular mt-2 font-mono text-xs text-ink-dim">
                    {entry.source} · {entry.license} · verified {entry.verifiedOn}
                  </p>
                ) : null}
              </FrostedCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
