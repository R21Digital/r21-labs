import Link from "next/link";

import AuroraWash from "@/components/brand/AuroraWash";
import FrostedCard from "@/components/brand/FrostedCard";
import Wordmark from "@/components/brand/Wordmark";
import EntryLogo from "@/components/site/EntryLogo";
import { getPublishedEntries } from "@/lib/content";
import { CATEGORY_LABEL, type Category, type Entry } from "@/lib/schema";
import { canonicalPath, entryDescription } from "@/lib/site";

/**
 * The catalog.
 *
 * 🔴 Rebuilt 2026-08-23. The previous homepage was a portfolio hero — "We build
 * the tools we run on" — over one flat grid mixing R21's own builds with
 * third-party tools, separated only by an 11px label. Carlos's read was that it
 * "feels void", and that was accurate rather than a matter of taste: the page
 * was ~90% background, every element was text, and there was not one image,
 * icon or colour block anywhere on it.
 *
 * Three things changed, in order of how much each fixed:
 *
 * 1. **Marks on every row.** A software directory with no product logos cannot
 *    be scanned — the eye has no anchor and all ten rows weigh the same.
 * 2. **The visitor is the subject, not R21.** Someone arriving to find a free
 *    alternative to a paid tool was being shown R21's identity statement. The
 *    catalog leads; R21's own builds moved to a section at the bottom.
 * 3. **Grouped by what the thing IS.** `category` (MCP / skills / tool / app)
 *    rather than by R21's relationship to it. Section headings also break up
 *    the single long grid that produced the empty feeling.
 *
 * Density comes from content, not from tighter spacing. The old page had ~1,100
 * words across the whole site to work with; adding a logo, a category and a
 * replaces badge to each row is what actually fills it.
 */

/** Catalog order. Most-asked-for first, R21's own apps last. */
const CATALOG_ORDER: Category[] = ["mcp", "skills", "tool"];

const CARD_LINE_MAX = 118;

function cardLine(entry: Entry): string {
  const text = entryDescription(entry);
  return text.length > CARD_LINE_MAX
    ? `${text.slice(0, CARD_LINE_MAX).replace(/\s+\S*$/, "")}…`
    : text;
}

/**
 * The replaces badge.
 *
 * The reason the field is structured rather than prose: it renders here, on the
 * entry page, in the OG card and in the page title, all from one checked fact.
 * The price is shown WITH the product name because "replaces Cypress Cloud" is
 * an opinion and "replaces Cypress Cloud, $75/mo" is a reason to click.
 */
function ReplacesBadge({ entry }: { entry: Entry }) {
  if (!entry.replaces?.length) return null;
  return (
    <p className="mt-2.5 flex flex-wrap gap-1.5">
      {entry.replaces.map((replacement) => (
        <span
          key={replacement.tool}
          className="tabular inline-flex items-baseline gap-1.5 rounded-[var(--radius-control)] border border-accent/30 bg-accent/[0.07] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-accent"
        >
          replaces {replacement.tool}
          <span className="text-accent/70">{replacement.pricedAt}</span>
        </span>
      ))}
    </p>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <li>
      <Link
        href={canonicalPath(entry)}
        className="block h-full rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <FrostedCard interactive className="h-full">
          {/* Logo left, content right. The horizontal shape is deliberate: it
              gives the row a fixed anchor point, which is what makes a column
              of cards scannable rather than a wall of paragraphs. */}
          <div className="flex gap-3.5">
            <EntryLogo entry={entry} size={40} />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-base font-semibold leading-tight text-ink">
                {entry.title}
              </h3>
              <p className="mt-1.5 text-sm leading-snug text-ink-muted">{cardLine(entry)}</p>
              <ReplacesBadge entry={entry} />
              <p className="tabular mt-2.5 truncate font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                {entry.source ?? entry.stack} · {entry.license ?? "R21"} · {entry.verifiedOn}
              </p>
            </div>
          </div>
        </FrostedCard>
      </Link>
    </li>
  );
}

function Section({
  id,
  heading,
  blurb,
  entries,
}: {
  id: string;
  heading: string;
  blurb: string;
  entries: Entry[];
}) {
  if (entries.length === 0) return null;
  return (
    <section id={id} className="scroll-mt-8">
      {/* The count sits ON the heading, not pushed to the far right edge. At
          this width `justify-between` parked a lone digit ~600px away from the
          word it counted, reading as a stray artifact rather than as a label. */}
      <div className="flex items-baseline gap-2.5 border-b border-[var(--hairline)] pb-3">
        <h2 className="font-display text-xl font-semibold text-ink">{heading}</h2>
        <span className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          {entries.length}
        </span>
      </div>
      <p className="mt-2.5 max-w-2xl text-sm text-ink-muted">{blurb}</p>
      <ul className="mt-5 grid gap-3.5 sm:grid-cols-2">
        {entries.map((entry) => (
          <EntryCard key={entry.slug} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Playbooks get their own row shape rather than reusing `EntryCard`.
 *
 * 🔴 They were unreachable until 2026-08-23. The homepage groups by `category`,
 * and `category` is only required on a published `tool` or `build` — so
 * `byCategory()` never matched a playbook and nothing on the site linked to one.
 * Both playbooks would have published as orphan pages reachable only from the
 * sitemap, on the surface spec §1 goal 2 calls the site's main SEO asset.
 *
 * Same shape as the missing discovery layer: no task row ever owned the route
 * in, while `EntryBody` was already built to render their tables.
 *
 * Not an `EntryCard` because that card's footer is `source · licence · date`,
 * and a playbook has no source and no licence — it would render " · R21 · " and
 * assert nothing, which is the failure the guards exist to prevent. A playbook
 * is something you read, so the row shows what it is about and how long it is.
 */
function PlaybookSection({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return null;
  return (
    <section id="playbooks" className="scroll-mt-8">
      <div className="flex items-baseline gap-2.5 border-b border-[var(--hairline)] pb-3">
        <h2 className="font-display text-xl font-semibold text-ink">Playbooks</h2>
        <span className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          {entries.length}
        </span>
      </div>
      <p className="mt-2.5 max-w-2xl text-sm text-ink-muted">
        How R21 wires and runs the things above, written from the real thing rather than
        assembled from a tool list. Long-form.
      </p>
      <ul className="mt-5 space-y-3.5">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={canonicalPath(entry)}
              className="block rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <FrostedCard interactive>
                <h3 className="font-display text-base font-semibold leading-tight text-ink">
                  {entry.title}
                </h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-snug text-ink-muted">
                  {entry.situation}
                </p>
                <p className="tabular mt-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                  {readingMinutes(entry)} min read · {entry.verifiedOn}
                </p>
              </FrostedCard>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Reading time, counted from the body rather than typed in frontmatter.
 *
 * Same rule as every other number on this page: a typed one drifts the moment
 * the text is edited and nobody notices. 220 wpm is the usual prose estimate;
 * the floor of 1 stops a short entry rendering "0 min read".
 */
function readingMinutes(entry: Entry): number {
  const words = entry.body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

const BLURB: Record<Category, string> = {
  mcp: "Servers that connect an assistant to a real system — a database, an EHR, a docs index — without handing it credentials.",
  skills: "Instruction libraries that change how a coding agent works, rather than what it can reach.",
  tool: "Things R21 runs alongside the agents: browsers, code understanding, verification.",
  app: "Software R21 designed and shipped. Listed for what it demonstrates, not as something you install.",
};

export default function Home() {
  const entries = getPublishedEntries();
  const catalogue = entries.filter((entry) => entry.type !== "stack");

  const byCategory = (category: Category) =>
    catalogue.filter((entry) => entry.category === category);

  const recommended = CATALOG_ORDER.flatMap(byCategory);
  const ours = byCategory("app");
  const playbooks = catalogue.filter((entry) => entry.type === "playbook");
  const replacements = catalogue.flatMap((entry) => entry.replaces ?? []);

  return (
    <>
      {/* DARK CHAPTER — hero. */}
      <section className="relative isolate overflow-hidden border-b border-[var(--hairline)]">
        <AuroraWash intensity={0.22} />
        <div className="relative mx-auto w-full max-w-5xl px-6 pb-14 pt-16 sm:pb-16 sm:pt-20">
          <Wordmark className="text-xl" />

          {/* 🔴 Was "Open source we actually run." until 2026-08-23.
              `/codex:adversarial-review` flagged it against the n8n entry
              published the same day, which states its Sustainable Use License
              is fair-code and NOT OSI-approved. Both claims rendered on the
              same page: the headline asserted open source while an entry below
              it disproved that for one of its own items.

              Small wording, but this is the one site where it cannot stand —
              the whole product is that its claims survive being checked. The
              replaces hook moves into the subline, which is conditional and
              therefore stays true as the catalog grows. */}
          <h1 className="mt-10 max-w-3xl font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl">
            The tools we actually run.
          </h1>

          {/* Honest about the hook: `replaces` is prominent where it is true and
              silent where it is not. The catalog is not yet chosen for it, and a
              hero that promised otherwise would be the exact defect this site
              exists to avoid. */}
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
            Open-source and source-available MCP servers, agent skills and developer tools R21
            uses in production — each one credited, licence-checked and dated. Where something
            replaces a product you would otherwise pay for, we say so and link the price.
          </p>

          {/* Jump strip. Doubles as the "what's in here" summary that the old
              2×2 label grid was trying and failing to be, at a fraction of the
              space and with real counts in it. */}
          <nav
            aria-label="Catalog sections"
            className="mt-9 flex flex-wrap gap-x-2.5 gap-y-2 border-t border-[var(--hairline)] pt-6"
          >
            {CATALOG_ORDER.map((category) => {
              const count = byCategory(category).length;
              if (count === 0) return null;
              return (
                <a
                  key={category}
                  href={`#${category}`}
                  className="tabular inline-flex items-baseline gap-2 rounded-[var(--radius-control)] border border-[var(--hairline-strong)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-muted transition-colors duration-[var(--dur-control)] hover:border-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {CATEGORY_LABEL[category]}
                  <span className="text-ink-dim">{count}</span>
                </a>
              );
            })}
            {replacements.length > 0 ? (
              <span className="tabular inline-flex items-baseline gap-2 rounded-[var(--radius-control)] border border-accent/30 bg-accent/[0.07] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
                replacing paid tools
                <span className="text-accent/70">{replacements.length}</span>
              </span>
            ) : null}
          </nav>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl space-y-14 px-6 py-14">
        {CATALOG_ORDER.map((category) => (
          <Section
            key={category}
            id={category}
            heading={CATEGORY_LABEL[category]}
            blurb={BLURB[category]}
            entries={byCategory(category)}
          />
        ))}

        {/* R21's own work, demoted on purpose — see the note at the top. */}
        <Section
          id="app"
          heading="Built by R21"
          blurb={BLURB.app}
          entries={ours}
        />

        <PlaybookSection entries={playbooks} />

        {catalogue.length === 0 ? (
          <p className="text-ink-muted">
            No published entries yet. Every candidate stays a draft until its source, licence
            and links are verified against the registry.
          </p>
        ) : null}
      </div>
    </>
  );
}
