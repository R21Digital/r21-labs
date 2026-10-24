import path from "node:path";

import { apaParts, bibtexEntry } from "@/lib/citation";
import type { Report } from "@/lib/research";
import { STRINGS } from "@/lib/strings";

/**
 * How to cite a report, and where its numbers live.
 *
 * Every figure in a report is checked against `data/stats.json` at build, and
 * the same files are what this block offers for download, so a reader can
 * verify the claim instead of trusting it. Data sits under
 * `/research/<slug>/data/` for both languages; the files are copied there by
 * `scripts/copy-research-data.ts`.
 */

const linkClass =
  "text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";

export default function CitationBlock({
  report,
  pdfPath,
}: {
  report: Report;
  pdfPath: string;
}) {
  const s = STRINGS[report.lang];
  const apa = apaParts(report);

  return (
    <section
      aria-labelledby="cite-heading"
      className="mt-14 rounded-[var(--radius-card)] border border-[var(--hairline)] bg-surface p-5"
    >
      <h2
        id="cite-heading"
        className="font-mono text-[11px] uppercase tracking-widest text-ink-dim"
      >
        {s.citeThis}
      </h2>
      {/* One citation, in APA: the same text a reader copies, with the URL as a link. */}
      <p className="mt-3 break-words text-sm leading-relaxed text-ink-muted">
        {apa.text}{" "}
        <a href={apa.url} className={linkClass}>
          {apa.url}
        </a>
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-ink-dim hover:text-ink">
          {s.bibtex}
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-[var(--radius-control)] bg-canvas p-3 font-mono text-xs leading-relaxed text-ink-muted">
          {bibtexEntry(report)}
        </pre>
      </details>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {report.dataFiles.map((file) => {
          const name = path.posix.basename(file);
          return (
            <li key={file}>
              <a href={`/research/${report.slug}/data/${name}`} className={linkClass} download>
                {s.download} {name}
              </a>
            </li>
          );
        })}
        <li>
          <a href={pdfPath} className={linkClass}>
            {s.download} {s.pdf}
          </a>
        </li>
      </ul>
    </section>
  );
}
