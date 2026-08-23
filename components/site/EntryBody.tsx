import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The rendered body of an entry.
 *
 * Until 2026-08-22 this was `body.split(/\n{2,}/).map(block => <p>{block}</p>)`,
 * which meant every heading, list, table, link and code fence in an entry
 * rendered as literal markdown characters. Fine for a two-paragraph tool note;
 * a hard ceiling for the two long-form playbooks, which are the site's only
 * real SEO surface.
 *
 * 🔴 Rendered from the body STRING, deliberately — not by importing the .mdx.
 *
 * `await import(`@/content/${type}/${slug}.mdx`)` would reuse the @next/mdx
 * pipeline that is already configured and looks like the obvious move. It is a
 * trap: a dynamic import specifier makes the bundler build a context module
 * over every file matching the pattern, so DRAFT bodies get compiled into the
 * JS chunks. They would never appear in HTML, so draft-leak.test.ts — which
 * scans .html/.xml/.txt — would stay green while the drafts shipped inside
 * .js. Rendering from a string keeps the guarded read path as the only way
 * content reaches a page.
 *
 * `isChapter` switches the prose colours for a playbook's white chapter. The
 * two surfaces need different ink, and passing a flag beats duplicating the
 * component.
 */
export default function EntryBody({
  body,
  isChapter,
}: {
  body: string;
  isChapter: boolean;
}) {
  const ink = isChapter ? "text-chapter-ink/80" : "text-ink-muted";
  const strong = isChapter ? "text-chapter-ink" : "text-ink";
  const rule = isChapter ? "border-black/10" : "border-[var(--hairline)]";
  const chip = isChapter ? "bg-black/[0.04]" : "bg-surface";

  return (
    <div className={`mt-8 leading-relaxed ${ink}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2
              className={`mt-10 mb-3 font-display text-xl font-semibold ${strong}`}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`mt-8 mb-2 font-display text-base font-semibold ${strong}`}>
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-4">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-1.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-1.5 pl-5">{children}</ol>
          ),
          a: ({ href, children }) => {
            // Only outbound links exist in these bodies today, but an internal
            // one must not get target="_blank" — leaving the site to read the
            // next page on the site is a bug, not a feature.
            const external = Boolean(href && /^https?:/.test(href));
            return (
              <a
                href={href}
                className="text-accent underline underline-offset-4"
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
          strong: ({ children }) => (
            <strong className={`font-semibold ${strong}`}>{children}</strong>
          ),
          code: ({ children }) => (
            <code
              className={`rounded-[var(--radius-control)] ${chip} px-1.5 py-0.5 font-mono text-[0.85em]`}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className={`my-5 overflow-x-auto rounded-[var(--radius-card)] border ${rule} ${chip} p-4 font-mono text-xs leading-relaxed`}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`my-5 border-l-2 border-accent/40 pl-4 ${isChapter ? "text-chapter-ink/70" : "text-ink-muted"}`}
            >
              {children}
            </blockquote>
          ),
          hr: () => <hr className={`my-8 border-t ${rule}`} />,
          // Tables carry the comparison content in both playbooks, so they get
          // real treatment rather than browser defaults on a dark canvas.
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className={`border-b ${rule} px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-widest ${isChapter ? "text-chapter-ink/60" : "text-ink-dim"}`}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`border-b ${rule} px-3 py-2 align-top`}>{children}</td>
          ),
        }}
      >
        {body.trim()}
      </Markdown>
    </div>
  );
}
