import path from "node:path";

import { reportPath, type Report } from "@/lib/research";
import { SITE_URL } from "@/lib/site";
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const BIBTEX_MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];

/** `YYYY-MM-DD` split without a Date, so the output cannot shift with the build machine's timezone. */
function parts(isoDate: string): { year: string; month: number; day: number } {
  const [year, month, day] = isoDate.split("-");
  return { year, month: Number(month), day: Number(day) };
}

function bibtexEscape(value: string): string {
  return value.replace(/([&%#_$])/g, "\$1");
}

export function apaLine(report: Report): string {
  const { year, month, day } = parts(report.publishedOn);
  const url = `${SITE_URL}${reportPath(report)}`;
  return `${report.author} (${year}, ${MONTHS[month - 1]} ${day}). ${report.title}. R21 Labs. ${url}`;
}

export function bibtexEntry(report: Report): string {
  const { year, month } = parts(report.publishedOn);
  const url = `${SITE_URL}${reportPath(report)}`;
  return [
    `@misc{r21labs_${report.slug}_${report.lang},`,
    `  author = {${bibtexEscape(report.author)}},`,
    `  title = {${bibtexEscape(report.title)}},`,
    `  year = {${year}},`,
    `  month = ${BIBTEX_MONTHS[month - 1]},`,
    `  publisher = {R21 Labs},`,
    `  url = {${url}}`,
    `}`,
  ].join("\n");
}

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
  const url = `${SITE_URL}${reportPath(report)}`;

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
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        {report.author}. <span className="text-ink">{report.title}</span>. R21 Labs,{" "}
        <time dateTime={report.publishedOn} className="tabular">
          {report.publishedOn}
        </time>
        .{" "}
        <a href={url} className={linkClass}>
          {url}
        </a>
      </p>
      <p className="mt-3 break-words text-sm leading-relaxed text-ink-muted">{apaLine(report)}</p>
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
