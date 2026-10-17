import Link from "next/link";

import type { RelatedItem } from "@/lib/related";

/**
 * Three other pages at the foot of an entry or a note. Picks come from
 * lib/related.ts; this only renders them, in the blog index's list style.
 *
 * `isChapter` switches the ink for a playbook's white chapter, the same flag
 * EntryBody takes.
 */
export default function KeepReading({
  items,
  isChapter,
}: {
  items: RelatedItem[];
  isChapter: boolean;
}) {
  if (items.length === 0) return null;

  const dim = isChapter ? "text-chapter-ink/60" : "text-ink-dim";
  const strong = isChapter ? "text-chapter-ink" : "text-ink";
  const muted = isChapter ? "text-chapter-ink/70" : "text-ink-muted";
  const rule = isChapter ? "border-black/10" : "border-[var(--hairline)]";

  return (
    <nav aria-labelledby="keep-reading" className={`mt-14 border-t pt-8 ${rule}`}>
      <h2
        id="keep-reading"
        className={`font-mono text-[11px] uppercase tracking-widest ${dim}`}
      >
        Keep reading
      </h2>
      <ul className="mt-5 space-y-6">
        {items.map((item) => (
          <li key={item.path}>
            <Link
              href={item.path}
              className="group block rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <p className={`font-mono text-[11px] uppercase tracking-widest ${dim}`}>
                {item.label}
              </p>
              <p
                className={`mt-1.5 font-display text-lg font-semibold underline-offset-4 group-hover:underline ${strong}`}
              >
                {item.title}
              </p>
              <p className={`mt-1.5 text-sm leading-relaxed ${muted}`}>{item.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
