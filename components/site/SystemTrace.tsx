/**
 * The hero's system trace — the structural signature of
 * `operational-enterprise-ai`: numbered nodes, hairline connectors, mono
 * labels, and a stat row directly beneath.
 *
 * The direction pairs a boundary-led headline with "one deliberate operational
 * visual". For R21 Labs that visual is the pipeline itself, because the sharpest
 * available credential is that R21 builds MCP servers rather than only consuming
 * them — and a diagram of the real pipeline is evidence, where a logo wall is
 * decoration.
 *
 * 🔴 Every label here is structural, not a claim. No counts, no customer names,
 * no metrics. Anything numeric lives in StatRow, where it is derived from
 * content rather than typed.
 */

export interface TraceNode {
  step: string;
  label: string;
  detail: string;
}

export const PIPELINE: TraceNode[] = [
  { step: "01", label: "CONNECT", detail: "Agents run against live client systems" },
  { step: "02", label: "BUILD", detail: "Where no server exists, R21 writes one" },
  { step: "03", label: "GUARD", detail: "Claims fail the build before they reach the page" },
  { step: "04", label: "SHIP", detail: "Static on Vercel, verified at build time" },
];

export function SystemTrace() {
  return (
    <div
      className="rounded-[var(--radius-card)] border border-[var(--hairline)] p-4"
      // The direction requires a text equivalent for any diagram.
      role="list"
      aria-label="How R21 Labs works, in four stages"
    >
      <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2">
        {PIPELINE.map((node) => (
          <div key={node.step} role="listitem" className="bg-canvas p-4">
            <p className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim">
              {node.step} · {node.label}
            </p>
            <p className="mt-1.5 text-sm text-ink-muted">{node.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SystemTrace;
