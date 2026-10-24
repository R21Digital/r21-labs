import Link from "next/link";

import Wordmark from "@/components/brand/Wordmark";
import CitationBlock from "@/components/site/CitationBlock";
import EntryBody from "@/components/site/EntryBody";
import { getPublishedReports, reportPath, twinOf, type Lang, type Report } from "@/lib/research";
import { STRINGS } from "@/lib/strings";

/**
 * The two research pages, rendered once for both languages.
 *
 * The routes under `app/research/` and `app/es/research/` are thin: they pick a
 * language, and everything visible comes from here, so the English and Spanish
 * pages cannot grow apart. The Spanish page puts `lang="es"` on its own
 * container; the root layout's `<html lang>` stays as it is.
 */

const eyebrowClass =
  "tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim";
const wordmarkLink =
  "inline-flex font-mono text-[11px] uppercase tracking-widest text-ink-dim transition-colors duration-[var(--dur-control)] hover:text-ink";

function homeHref(lang: Lang): string {
  return lang === "es" ? "/es/research" : "/research";
}

export function ResearchIndex({ lang }: { lang: Lang }) {
  const s = STRINGS[lang];
  const twinLang: Lang = lang === "es" ? "en" : "es";
  const reports = getPublishedReports(lang);

  return (
    <main lang={lang} className="mx-auto w-full max-w-3xl px-6 py-14">
      <Link href="/" className={wordmarkLink}>
        <Wordmark className="text-sm" />
      </Link>
      <p className={`${eyebrowClass} mt-10`}>{s.research}</p>
      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
        {s.indexTitle}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-muted">{s.indexIntro}</p>

      {reports.length === 0 ? (
        <p className="mt-10 rounded-[var(--radius-card)] border border-[var(--hairline)] px-4 py-6 text-base leading-relaxed text-ink-muted">
          {s.empty}
        </p>
      ) : (
        <ul className="mt-10 space-y-8">
          {reports.map((report) => (
            <li key={report.slug}>
              <p className={eyebrowClass}>
                {s.issue} {report.issue} · {report.publishedOn}
              </p>
              <Link
                href={reportPath(report)}
                className="mt-2 block rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                <h2 className="font-display text-xl font-semibold text-ink">{report.title}</h2>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">{report.summary}</p>
              </Link>
              <p className="mt-2 text-sm">
                <Link
                  href={`${twinLang === "es" ? "/es" : ""}/research/${report.slug}`}
                  hrefLang={twinLang}
                  className="text-accent underline underline-offset-4"
                >
                  {s.readIn}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export function ResearchReport({ report }: { report: Report }) {
  const s = STRINGS[report.lang];
  const twin = twinOf(report, getPublishedReports(report.lang === "es" ? "en" : "es"));

  return (
    <article lang={report.lang} className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <Link href="/" className={wordmarkLink}>
          <Wordmark className="text-sm" />
        </Link>
        <p className={`${eyebrowClass} mt-10`}>
          {s.research} · {s.issue} {report.issue} · {report.publishedOn}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{report.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">{report.summary}</p>
        <p className={`${eyebrowClass} mt-5`}>
          {s.by} {report.author} · {s.measuredOn} {report.measuredOn}
          {report.sampleSize !== undefined && (
            <>
              {" "}
              · {s.sample} n = {report.sampleSize}
            </>
          )}
        </p>
        <EntryBody body={report.body} isChapter={false} />
        <CitationBlock
          report={report}
          pdfPath={`/research/${report.slug}/${report.slug}.${report.lang}.pdf`}
        />
        <p className="mt-12 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          <Link href={homeHref(report.lang)} className="hover:text-ink">
            {s.allReports}
          </Link>
          {twin && (
            <>
              <span className="mx-2">·</span>
              <Link href={reportPath(twin)} hrefLang={twin.lang} className="hover:text-ink">
                {s.readIn}
              </Link>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
