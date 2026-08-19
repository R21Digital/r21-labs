import { getPublishedEntries } from "@/lib/content";

/**
 * Phase 2 skeleton. Structure and guard wiring only — the visual system
 * (`operational-enterprise-ai`: hairline grid, frosted cards, hero system
 * trace) arrives in Phase 4.
 *
 * It reads through getPublishedEntries() rather than readEntries(), which is
 * what makes the draft-leak test real: a draft entry cannot reach this page
 * without the guard throwing first.
 */
export default function Home() {
  const entries = getPublishedEntries();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
        R21 Labs
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-ink">
        Tools we tested. Software we built.
      </h1>

      {entries.length === 0 ? (
        <p className="mt-10 text-ink-muted">
          No published entries yet. Every candidate is a draft until its source,
          licence, and links are verified against the registry.
        </p>
      ) : (
        <ul className="mt-10 space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.slug}
              className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-surface p-5"
            >
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
