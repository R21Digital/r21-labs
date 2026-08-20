import { isStale } from "@/lib/guards/staleness";
import type { Entry } from "@/lib/schema";

/**
 * The stat row beneath the hero trace.
 *
 * 🔴 EVERY NUMBER HERE IS A count() OVER PUBLISHED CONTENT. None is typed.
 *
 * That is the rule the whole site rests on, and it has bitten R21 before: a
 * client site once advertised 8 cemeteries while serving 130, because the number
 * came from a status enum instead of from the store. A hardcoded "17
 * integrations" would drift the moment the list changed and nobody would notice.
 *
 * The corollary is that a stat can be UNAVAILABLE, and that has to render
 * honestly. The connector-stack entry is a draft until a human confirms it, so
 * the integration count is not publishable yet — the row says so rather than
 * printing a number that happens to be sitting in a draft file.
 */

export interface StatRowProps {
  entries: Entry[];
}

export function StatRow({ entries }: StatRowProps) {
  // Aged-out entries are excluded from every count. Staleness no longer fails
  // the build (that blocked rollback without unpublishing anything) - it
  // withdraws the claim from the numbers instead, which is the stronger remedy.
  const fresh = entries.filter((entry) => !isStale(entry));
  const builds = fresh.filter((entry) => entry.type === "build").length;
  const playbooks = fresh.filter((entry) => entry.type === "playbook").length;

  // Published stack entries only — a draft's integration list must not surface.
  const integrations = fresh
    .filter((entry) => entry.type === "stack")
    .flatMap((entry) => entry.integrations ?? []).length;

  const stats: Array<{ value: string; label: string; pending?: boolean }> = [
    {
      value: integrations > 0 ? String(integrations) : "—",
      label: integrations > 0 ? "integrations" : "integrations · pending verification",
      pending: integrations === 0,
    },
    { value: String(builds), label: builds === 1 ? "build shipped" : "builds shipped" },
    { value: String(playbooks), label: playbooks === 1 ? "playbook" : "playbooks" },
  ];

  return (
    <dl className="mt-px grid grid-cols-3 gap-px bg-[var(--hairline)]">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-canvas px-4 py-5">
          <dd
            className={`tabular font-display text-2xl font-bold ${
              stat.pending ? "text-ink-dim" : "text-ink"
            }`}
          >
            {stat.value}
          </dd>
          <dt className="mt-1 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
            {stat.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}

export default StatRow;
